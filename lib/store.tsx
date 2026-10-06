'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { addDays, setCurrency, today, uid } from './calc';
import { demoData, emptyData } from './defaults';
import type { StorageAdapter } from './db/adapter';
import { LocalAdapter, migrate } from './db/local';
import { SupabaseAdapter, getSupabase, supabaseConfigured } from './db/supabase';
import { allOutboxes, storeOutbox } from './db/outbox';
import { SyncError, mergeOps, opsEmpty, opsSize } from './db/ops';
import type { Ops, Rejection } from './db/ops';
import { countUsage, usageQuota } from './plans';
import { taxProfile } from './tax';
import type { Role } from './team';
import type { Company, CompanySummary, Customer, Data, DocKind, Expense, InvoiceDesign, Material, SalesDoc, Settings, StorageLocation, UsageKind } from './types';

/**
 * idle    – alles gespeichert
 * saving  – Änderungen werden übertragen
 * offline – keine Verbindung; Änderungen liegen in der Warteschlange und werden nachgesendet
 * error   – Laden/Speichern dauerhaft fehlgeschlagen
 */
export type SyncState = 'idle' | 'saving' | 'offline' | 'error';
export type SyncInfo = {
  state: SyncState;
  error: string | null;
  /** Anzahl noch nicht übertragener Änderungen */
  pending: number;
  /** Hinweis zu abgelehnten Änderungen (z. B. Limit erreicht) */
  notice: string | null;
};

export type Auth = {
  /** 'local' = Browser-Speicher ohne Konto, 'supabase' = Datenbank mit Login */
  mode: 'local' | 'supabase';
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type Store = {
  data: Data;
  ready: boolean;
  auth: Auth;
  /** Angemeldet bzw. im lokalen Modus ohne Anmeldung nutzbar */
  authenticated: boolean;
  sync: SyncInfo;
  dismissSyncNotice: () => void;
  /** Alle Firmen des Nutzers und die gerade geöffnete */
  companies: CompanySummary[];
  activeCompanyId: string | null;
  /** Rolle des Nutzers in der aktiven Firma (lokal immer Inhaber). */
  role: Role;
  /** true, während eine weitere Firma angelegt wird (Onboarding mit „Abbrechen“) */
  creatingCompany: boolean;
  switchCompany: (id: string) => Promise<void>;
  startNewCompany: () => Promise<void>;
  cancelNewCompany: () => Promise<void>;
  /** Hinweis „Monatslimit erreicht“ für diese Art (null = kein Hinweis) */
  upgradeNotice: UsageKind | null;
  dismissUpgrade: () => void;
  saveCompany: (company: Company) => void;
  /** Speichert einen Kunden; `null`, wenn ein neuer Kunde das Monatslimit überschreiten würde. */
  saveCustomer: (customer: Customer) => Promise<Customer | null>;
  deleteCustomer: (id: string) => void;
  saveMaterial: (material: Material) => Promise<Material | null>;
  deleteMaterial: (id: string) => void;
  bookStock: (materialId: string, quantity: number, note: string, date?: string) => void;
  /** Legt einen Beleg an; `null`, wenn das Monatslimit des Tarifs erreicht ist. */
  createDoc: (kind: DocKind, customerId?: string) => Promise<SalesDoc | null>;
  saveDoc: (doc: SalesDoc) => void;
  deleteDoc: (id: string) => void;
  setDocStatus: (id: string, status: SalesDoc['status'], paidDate?: string) => void;
  offerToInvoice: (offerId: string) => Promise<SalesDoc | null>;
  duplicateDoc: (id: string) => Promise<SalesDoc | null>;
  /** Speichert eine Buchung; `false`, wenn eine neue Buchung das Monatslimit überschreiten würde. */
  saveExpense: (expense: Expense) => boolean;
  deleteExpense: (id: string) => void;
  saveDesign: (design: InvoiceDesign) => void;
  saveSettings: (settings: Settings) => void;
  saveLocation: (location: StorageLocation) => StorageLocation;
  deleteLocation: (id: string) => void;
  /** Protokolliert den E-Mail-Versand eines Belegs (Angebote gelten danach als versendet). */
  markSent: (id: string, to: string) => void;
  replaceAll: (data: unknown) => void;
  loadDemo: () => void;
  reset: () => void;
};

const StoreContext = createContext<Store | null>(null);

const rejectionText = (list: Rejection[]) =>
  `${list.length === 1 ? 'Eine Änderung wurde' : `${list.length} Änderungen wurden`} nicht gespeichert: ${list[0].message}`;

/** Adjusts stock for all material positions of a document (sign -1 = Abgang, +1 = Zugang). */
function applyStock(data: Data, doc: SalesDoc, sign: 1 | -1, note: string): Material[] {
  const date = today();
  return data.materials.map((m) => {
    const qty = doc.items.filter((i) => i.materialId === m.id).reduce((s, i) => s + i.quantity, 0);
    if (!qty) return m;
    return {
      ...m,
      stock: m.stock + sign * qty,
      movements: [{ id: uid(), date, quantity: sign * qty, note }, ...m.movements],
    };
  });
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const adapter = useMemo<StorageAdapter>(() => (supabaseConfigured ? new SupabaseAdapter() : new LocalAdapter()), []);
  const [data, setData] = useState<Data>(emptyData);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabaseConfigured);
  const [sync, setSync] = useState<SyncInfo>({ state: 'idle', error: null, pending: 0, notice: null });
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState<UsageKind | null>(null);
  const previousCompany = useRef<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  // Währung für alle Beträge (EUR, in der Schweiz CHF) – vor dem Rendern der Seiten setzen
  setCurrency(taxProfile(data.company).currency);
  /**
   * Stand, der bereits gespeichert ist oder in der Warteschlange liegt – die nächste Änderung
   * wird als Differenz dazu geplant.
   */
  const serverRef = useRef<Data | null>(null);
  /** Lokales Speichern bzw. Anlegen/Löschen einer Firma (der Reihe nach) */
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** Noch nicht übertragene Änderungen (Supabase) */
  const outbox = useRef<Ops | null>(null);
  const sending = useRef(false);
  const retry = useRef<{ timer: number | null; attempt: number }>({ timer: null, attempt: 0 });
  const needsRefresh = useRef(false);
  const companyChanged = useRef(false);
  const supa = adapter instanceof SupabaseAdapter ? adapter : null;
  const userId = session?.user.id ?? null;
  const userRef = useRef(userId);
  userRef.current = userId;
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const authenticated = !supabaseConfigured || !!session;

  // Anmeldestatus (nur Supabase)
  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setAuthChecked(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Lädt eine Firma (oder die zuletzt genutzte) – vorher werden offene Änderungen gespeichert. */
  const loadCompany = useCallback(async (companyId?: string | null) => {
    await queue.current;
    await flushRef.current();
    setReady(false);
    serverRef.current = null;
    outbox.current = null;
    try {
      // Auf dem Gerät gespeicherte Änderungen (z. B. vor dem Neuladen offline erfasst) zuerst senden
      if (supa) {
        for (const ops of allOutboxes(userRef.current)) {
          try {
            const rejected = await supa.apply(ops);
            if (rejected.length) setSync((s) => ({ ...s, notice: rejectionText(rejected) }));
          } catch (e) {
            if (e instanceof SyncError && e.transient) throw e;
          }
          storeOutbox(userRef.current, null, ops.companyId);
        }
      }
      const loaded = await adapter.load(companyId);
      serverRef.current = loaded;
      needsRefresh.current = false;
      setData(loaded);
      setActiveCompanyId(adapter.activeCompanyId());
      setCompanies(await adapter.listCompanies());
      setCreatingCompany(false);
      setSync((s) => ({ ...s, state: 'idle', error: null, pending: 0 }));
    } catch (e) {
      setSync((s) => ({ ...s, state: 'error', error: (e as Error).message }));
    } finally {
      setReady(true);
    }
  }, [adapter, supa]);

  // Daten laden (lokal sofort, bei Supabase nach der Anmeldung bzw. bei Nutzerwechsel)
  useEffect(() => {
    if (!authChecked) return;
    if (supabaseConfigured && !userId) {
      serverRef.current = null;
      outbox.current = null;
      setData(emptyData());
      setCompanies([]);
      setActiveCompanyId(null);
      setReady(true);
      return;
    }
    loadCompany();
  }, [authChecked, userId, loadCompany]);

  /** Sendet die Warteschlange; bei Netzfehlern erneuter Versuch mit wachsendem Abstand. */
  const flush = useCallback(async () => {
    if (!supa || sending.current) return;
    const batch = outbox.current;
    if (!batch || opsEmpty(batch)) return;
    if (retry.current.timer) { window.clearTimeout(retry.current.timer); retry.current.timer = null; }
    sending.current = true;
    outbox.current = null;
    setSync((s) => ({ ...s, state: 'saving', pending: opsSize(batch) }));
    let sent = false;
    try {
      await queue.current;
      const rejected = await supa.apply(batch);
      sent = true;
      if (rejected.length) onRejected(rejected);
    } catch (e) {
      if (e instanceof SyncError && !e.transient) {
        // Ganzes Paket dauerhaft abgelehnt – verwerfen und Stand vom Server holen
        sent = true;
        onRejected([{ table: '', id: '', message: e.message, hint: e.hint }]);
      } else {
        outbox.current = outbox.current ? mergeOps(batch, outbox.current) : batch;
      }
    } finally {
      sending.current = false;
    }
    storeOutbox(userRef.current, outbox.current, batch.companyId);
    const rest = opsSize(outbox.current);
    if (!sent) {
      const delays = [2000, 5000, 15000, 30000, 60000];
      const delay = delays[Math.min(retry.current.attempt++, delays.length - 1)];
      setSync((s) => ({ ...s, state: 'offline', pending: rest }));
      retry.current.timer = window.setTimeout(() => { retry.current.timer = null; flushRef.current(); }, delay);
      return;
    }
    retry.current.attempt = 0;
    if (rest) { await flushRef.current(); return; }
    setSync((s) => ({ ...s, state: 'idle', error: null, pending: 0 }));
    if (companyChanged.current) {
      companyChanged.current = false;
      setCompanies(await adapter.listCompanies());
    }
    if (needsRefresh.current) await refreshRef.current();
  // onRejected nutzt nur stabile Setter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supa, adapter]);
  flushRef.current = flush;

  /** Abgelehnte Änderungen melden; danach den Stand vom Server holen. */
  const onRejected = (list: Rejection[]) => {
    const hint = list.find((r) => r.hint.startsWith('upgrade:'))?.hint;
    if (hint) setUpgradeNotice(hint.slice('upgrade:'.length) as UsageKind);
    setSync((s) => ({ ...s, notice: rejectionText(list) }));
    needsRefresh.current = true;
  };

  /** Lädt die aktive Firma still neu (nur ohne ungespeicherte lokale Änderungen). */
  const refresh = useCallback(async () => {
    if (!supa || sending.current || !opsEmpty(outbox.current)) return;
    const id = supa.activeCompanyId();
    if (!id) return;
    const before = dataRef.current;
    try {
      const loaded = await supa.load(id);
      if (dataRef.current !== before || !opsEmpty(outbox.current)) return; // inzwischen geändert – später erneut
      needsRefresh.current = false;
      serverRef.current = loaded;
      setData(loaded);
    } catch {
      /* beim nächsten Anlass erneut */
    }
  }, [supa]);
  refreshRef.current = refresh;

  // Wieder online, App wieder im Vordergrund: sofort senden
  useEffect(() => {
    const kick = () => {
      retry.current.attempt = 0;
      flushRef.current();
    };
    const visible = () => { if (document.visibilityState === 'visible') kick(); };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  // Jede Änderung: Differenz planen, in die Warteschlange legen, senden
  useEffect(() => {
    const prev = serverRef.current;
    if (!ready || !prev || prev === data) return;
    serverRef.current = data;

    if (supa && supa.activeCompanyId() && !(prev.company && !data.company)) {
      const ops = supa.plan(prev, data);
      if (!ops) return;
      if (prev.company !== data.company) companyChanged.current = true;
      outbox.current = outbox.current ? mergeOps(outbox.current, ops) : ops;
      storeOutbox(userId, outbox.current);
      setSync((s) => ({ ...s, pending: opsSize(outbox.current) }));
      flush();
      return;
    }

    // Lokaler Modus sowie Anlegen/Löschen einer Firma: direkt und der Reihe nach speichern
    setSync((s) => ({ ...s, state: 'saving' }));
    const companyBefore = adapter.activeCompanyId();
    queue.current = queue.current
      .then(() => adapter.persist(prev, data))
      .then(async () => {
        setSync((s) => ({ ...s, state: 'idle', error: null }));
        if (prev.company && !data.company) {
          // Firma gelöscht → nächste vorhandene Firma öffnen (oder Einrichtung)
          setTimeout(() => loadCompany(null), 0);
          return;
        }
        if (adapter.activeCompanyId() !== companyBefore || prev.company !== data.company) {
          setActiveCompanyId(adapter.activeCompanyId());
          setCompanies(await adapter.listCompanies());
          if (data.company) setCreatingCompany(false);
        }
      })
      .catch((e: Error) => {
        console.error(e);
        setSync((s) => ({ ...s, state: 'error', error: e.message || 'Speichern fehlgeschlagen' }));
      });
  }, [adapter, supa, data, ready, loadCompany, flush, userId]);

  const switchCompany = useCallback((id: string) => loadCompany(id), [loadCompany]);

  const startNewCompany = useCallback(async () => {
    await queue.current;
    await flushRef.current();
    previousCompany.current = adapter.activeCompanyId();
    adapter.detach();
    outbox.current = null;
    const blank = emptyData();
    serverRef.current = blank;
    setData(blank);
    setActiveCompanyId(null);
    setCreatingCompany(true);
  }, [adapter]);

  const cancelNewCompany = useCallback(() => loadCompany(previousCompany.current), [loadCompany]);
  const dismissUpgrade = useCallback(() => setUpgradeNotice(null), []);
  const dismissSyncNotice = useCallback(() => setSync((s) => ({ ...s, notice: null })), []);
  const role: Role = !supabaseConfigured ? 'owner' : ((companies.find((c) => c.id === activeCompanyId)?.role as Role) || 'member');

  const auth = useMemo<Auth>(() => ({
    mode: supabaseConfigured ? 'supabase' : 'local',
    email: session?.user.email ?? null,
    signIn: async (email, password) => {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (email, password) => {
      const { data: d, error } = await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/app` } });
      if (error) throw error;
      return { needsConfirmation: !d.session };
    },
    resetPassword: async (email) => {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/app` });
      if (error) throw error;
    },
    signOut: async () => {
      if (supabaseConfigured) await getSupabase().auth.signOut();
    },
  }), [session]);

  const update = useCallback((fn: (d: Data) => Data) => setData((d) => fn(d)), []);

  /** Prüft das Monatslimit vor dem Anlegen; zeigt sonst den Upgrade-Hinweis. */
  const allow = useCallback((kind: UsageKind) => {
    if (!usageQuota(dataRef.current, kind).reached) return true;
    setUpgradeNotice(kind);
    return false;
  }, []);

  const saveCompany = useCallback((company: Company) => update((d) => ({ ...d, company })), [update]);

  const saveCustomer = useCallback(async (customer: Customer) => {
    let saved = customer;
    if (!customer.id) {
      if (!allow('customer')) return null;
      const n = customer.number ? 0 : await adapter.allocate('customer', dataRef.current.counters.customer + 1);
      saved = { ...customer, id: uid(), number: customer.number || `KD-${String(n).padStart(4, '0')}`, createdAt: today() };
      update((d) => countUsage({ ...d, customers: [saved, ...d.customers], counters: { ...d.counters, customer: Math.max(d.counters.customer, n) } }, 'customer'));
    } else {
      update((d) => ({ ...d, customers: d.customers.map((c) => (c.id === customer.id ? customer : c)) }));
    }
    return saved;
  }, [adapter, update, allow]);

  const deleteCustomer = useCallback((id: string) => update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) })), [update]);

  const saveMaterial = useCallback(async (material: Material) => {
    let saved = material;
    if (!material.id) {
      if (!allow('material')) return null;
      const n = material.number ? 0 : await adapter.allocate('material', dataRef.current.counters.material + 1);
      const movements = material.stock ? [{ id: uid(), date: today(), quantity: material.stock, note: 'Anfangsbestand' }] : [];
      saved = { ...material, id: uid(), number: material.number || `ART-${String(n).padStart(4, '0')}`, movements };
      update((d) => countUsage({ ...d, materials: [saved, ...d.materials], counters: { ...d.counters, material: Math.max(d.counters.material, n) } }, 'material'));
    } else {
      update((d) => ({ ...d, materials: d.materials.map((m) => (m.id === material.id ? material : m)) }));
    }
    return saved;
  }, [adapter, update, allow]);

  const deleteMaterial = useCallback((id: string) => update((d) => ({ ...d, materials: d.materials.filter((m) => m.id !== id) })), [update]);

  const bookStock = useCallback((materialId: string, quantity: number, note: string, date = today()) => {
    update((d) => ({
      ...d,
      materials: d.materials.map((m) =>
        m.id === materialId ? { ...m, stock: m.stock + quantity, movements: [{ id: uid(), date, quantity, note }, ...m.movements] } : m,
      ),
    }));
  }, [update]);

  const createDoc = useCallback(async (kind: DocKind, customerId = ''): Promise<SalesDoc | null> => {
    if (!allow(kind)) return null;
    const date = today();
    const year = date.slice(0, 4);
    const n = await adapter.allocate(`${kind}:${year}`, (dataRef.current.counters[kind][year] || 0) + 1);
    const d = dataRef.current;
    const prefix = (kind === 'invoice' ? d.company?.invoicePrefix : d.company?.offerPrefix) || (kind === 'invoice' ? 'RE' : 'AN');
    const number = `${prefix}-${year}-${String(n).padStart(4, '0')}`;
    const customer = d.customers.find((c) => c.id === customerId);
    const company = d.company;
    const doc: SalesDoc = {
      id: uid(),
      kind,
      number,
      status: 'draft',
      customerId,
      recipient: customer
        ? { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: customer.country, vatId: customer.vatId }
        : { name: '', contactPerson: '', street: '', zip: '', city: '', country: 'Deutschland', vatId: '' },
      subject: '',
      date,
      dueDate: addDays(date, kind === 'invoice' ? company?.paymentTermDays ?? 14 : company?.offerValidityDays ?? 30),
      serviceDate: kind === 'invoice' ? date.split('-').reverse().join('.') : '',
      intro: '',
      outro: '',
      items: [],
      paidDate: '',
      sourceId: '',
      stockBooked: false,
      createdAt: new Date().toISOString(),
      sentAt: '',
      sentTo: '',
    };
    update((s) => countUsage({
      ...s,
      documents: [doc, ...s.documents],
      counters: { ...s.counters, [kind]: { ...s.counters[kind], [year]: Math.max(s.counters[kind][year] || 0, n) } },
    }, kind));
    return doc;
  }, [adapter, update, allow]);

  const saveDoc = useCallback((doc: SalesDoc) => update((d) => ({ ...d, documents: d.documents.map((x) => (x.id === doc.id ? doc : x)) })), [update]);

  const deleteDoc = useCallback((id: string) => update((d) => {
    const doc = d.documents.find((x) => x.id === id);
    // Bereits gebuchter Materialverbrauch wird beim Löschen zurückgebucht.
    const materials = doc && doc.stockBooked ? applyStock(d, doc, 1, `${doc.number} gelöscht`) : d.materials;
    return { ...d, materials, documents: d.documents.filter((x) => x.id !== id) };
  }), [update]);

  const setDocStatus = useCallback((id: string, status: SalesDoc['status'], paidDate?: string) => update((d) => {
    const doc = d.documents.find((x) => x.id === id);
    if (!doc) return d;
    let materials = d.materials;
    let stockBooked = doc.stockBooked;
    if (doc.kind === 'invoice') {
      if (!stockBooked && (status === 'sent' || status === 'paid')) {
        materials = applyStock(d, doc, -1, `Rechnung ${doc.number}`);
        stockBooked = true;
      } else if (stockBooked && status === 'cancelled') {
        materials = applyStock(d, doc, 1, `Storno ${doc.number}`);
        stockBooked = false;
      }
    }
    const next: SalesDoc = { ...doc, status, stockBooked, paidDate: status === 'paid' ? paidDate || doc.paidDate || today() : '' };
    return { ...d, materials, documents: d.documents.map((x) => (x.id === id ? next : x)) };
  }), [update]);

  const offerToInvoice = useCallback(async (offerId: string) => {
    const offer = dataRef.current.documents.find((x) => x.id === offerId);
    if (!offer) return null;
    const invoice = await createDoc('invoice', '');
    if (!invoice) return null;
    const full: SalesDoc = {
      ...invoice,
      customerId: offer.customerId,
      recipient: { ...offer.recipient },
      subject: offer.subject,
      items: offer.items.map((i) => ({ ...i, id: uid() })),
      sourceId: offer.id,
    };
    update((d) => ({
      ...d,
      documents: d.documents.map((x) => (x.id === invoice.id ? full : x.id === offer.id && x.status !== 'accepted' ? { ...x, status: 'accepted' } : x)),
    }));
    return full;
  }, [createDoc, update]);

  const duplicateDoc = useCallback(async (id: string) => {
    const src = dataRef.current.documents.find((x) => x.id === id);
    if (!src) return null;
    const copy = await createDoc(src.kind, '');
    if (!copy) return null;
    const full: SalesDoc = { ...copy, customerId: src.customerId, recipient: { ...src.recipient }, subject: src.subject, intro: src.intro, outro: src.outro, items: src.items.map((i) => ({ ...i, id: uid() })) };
    update((d) => ({ ...d, documents: d.documents.map((x) => (x.id === copy.id ? full : x)) }));
    return full;
  }, [createDoc, update]);

  const saveExpense = useCallback((expense: Expense) => {
    const exists = !!expense.id && dataRef.current.expenses.some((e) => e.id === expense.id);
    if (exists) {
      update((d) => ({ ...d, expenses: d.expenses.map((e) => (e.id === expense.id ? expense : e)) }));
      return true;
    }
    if (!allow('booking')) return false;
    update((d) => countUsage({ ...d, expenses: [{ ...expense, id: expense.id || uid() }, ...d.expenses] }, 'booking'));
    return true;
  }, [update, allow]);

  const deleteExpense = useCallback((id: string) => update((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) })), [update]);
  const saveDesign = useCallback((design: InvoiceDesign) => update((d) => ({ ...d, design })), [update]);
  const saveSettings = useCallback((settings: Settings) => update((d) => ({ ...d, settings })), [update]);

  const saveLocation = useCallback((location: StorageLocation) => {
    const saved = location.id ? location : { ...location, id: uid() };
    update((d) => ({
      ...d,
      locations: (d.locations.some((l) => l.id === saved.id) ? d.locations.map((l) => (l.id === saved.id ? saved : l)) : [...d.locations, saved])
        .sort((a, b) => a.code.localeCompare(b.code, 'de', { numeric: true })),
    }));
    return saved;
  }, [update]);

  const deleteLocation = useCallback((id: string) => update((d) => ({
    ...d,
    locations: d.locations.filter((l) => l.id !== id),
    materials: d.materials.map((m) => (m.locationId === id ? { ...m, locationId: '' } : m)),
  })), [update]);

  const markSent = useCallback((id: string, to: string) => update((d) => ({
    ...d,
    documents: d.documents.map((x) => (x.id === id
      ? { ...x, sentAt: new Date().toISOString(), sentTo: to, status: x.kind === 'offer' && x.status === 'draft' ? 'sent' : x.status }
      : x)),
  })), [update]);
  const replaceAll = useCallback((raw: unknown) => setData(migrate(raw)), []);
  const loadDemo = useCallback(() => setData(demoData()), []);
  const reset = useCallback(() => setData(emptyData()), []);

  const value = useMemo<Store>(() => ({
    data, ready, auth, authenticated, sync, dismissSyncNotice, companies, activeCompanyId, role, creatingCompany, switchCompany, startNewCompany, cancelNewCompany,
    upgradeNotice, dismissUpgrade, saveCompany, saveCustomer, deleteCustomer, saveMaterial, deleteMaterial, bookStock, createDoc, saveDoc, deleteDoc,
    setDocStatus, offerToInvoice, duplicateDoc, saveExpense, deleteExpense, saveDesign, saveSettings, saveLocation, deleteLocation, markSent, replaceAll, loadDemo, reset,
  }), [data, ready, auth, authenticated, sync, dismissSyncNotice, companies, activeCompanyId, role, creatingCompany, switchCompany, startNewCompany, cancelNewCompany,
    upgradeNotice, dismissUpgrade, saveCompany, saveCustomer, deleteCustomer, saveMaterial, deleteMaterial, bookStock, createDoc, saveDoc, deleteDoc,
    setDocStatus, offerToInvoice, duplicateDoc, saveExpense, deleteExpense, saveDesign, saveSettings, saveLocation, deleteLocation, markSent, replaceAll, loadDemo, reset]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
