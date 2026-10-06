'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { addDays, setCurrency, today, uid } from './calc';
import { demoData, emptyData } from './defaults';
import type { StorageAdapter } from './db/adapter';
import { LocalAdapter, migrate } from './db/local';
import { SupabaseAdapter, getSupabase, supabaseConfigured } from './db/supabase';
import { invoiceQuota } from './plans';
import { taxProfile } from './tax';
import type { Company, CompanySummary, Customer, Data, DocKind, Expense, InvoiceDesign, Material, SalesDoc, Settings, StorageLocation } from './types';

export type SyncState = 'idle' | 'saving' | 'error';

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
  sync: { state: SyncState; error: string | null };
  /** Alle Firmen des Nutzers und die gerade geöffnete */
  companies: CompanySummary[];
  activeCompanyId: string | null;
  /** true, während eine weitere Firma angelegt wird (Onboarding mit „Abbrechen“) */
  creatingCompany: boolean;
  switchCompany: (id: string) => Promise<void>;
  startNewCompany: () => Promise<void>;
  cancelNewCompany: () => Promise<void>;
  /** Hinweis „Rechnungslimit erreicht“ */
  upgradeNotice: boolean;
  dismissUpgrade: () => void;
  saveCompany: (company: Company) => void;
  saveCustomer: (customer: Customer) => Promise<Customer>;
  deleteCustomer: (id: string) => void;
  saveMaterial: (material: Material) => Promise<Material>;
  deleteMaterial: (id: string) => void;
  bookStock: (materialId: string, quantity: number, note: string, date?: string) => void;
  /** Legt einen Beleg an; `null`, wenn das Rechnungslimit des Tarifs erreicht ist. */
  createDoc: (kind: DocKind, customerId?: string) => Promise<SalesDoc | null>;
  saveDoc: (doc: SalesDoc) => void;
  deleteDoc: (id: string) => void;
  setDocStatus: (id: string, status: SalesDoc['status'], paidDate?: string) => void;
  offerToInvoice: (offerId: string) => Promise<SalesDoc | null>;
  duplicateDoc: (id: string) => Promise<SalesDoc | null>;
  saveExpense: (expense: Expense) => void;
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
  const [sync, setSync] = useState<{ state: SyncState; error: string | null }>({ state: 'idle', error: null });
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState(false);
  const previousCompany = useRef<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  // Währung für alle Beträge (EUR, in der Schweiz CHF) – vor dem Rendern der Seiten setzen
  setCurrency(taxProfile(data.company).currency);
  /** Last snapshot that was handed to the adapter – the next save persists the difference to it. */
  const persisted = useRef<Data | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const userId = session?.user.id ?? null;
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
    setReady(false);
    persisted.current = null;
    try {
      const loaded = await adapter.load(companyId);
      persisted.current = loaded;
      setData(loaded);
      setActiveCompanyId(adapter.activeCompanyId());
      setCompanies(await adapter.listCompanies());
      setCreatingCompany(false);
      setSync({ state: 'idle', error: null });
    } catch (e) {
      setSync({ state: 'error', error: (e as Error).message });
    } finally {
      setReady(true);
    }
  }, [adapter]);

  // Daten laden (lokal sofort, bei Supabase nach der Anmeldung bzw. bei Nutzerwechsel)
  useEffect(() => {
    if (!authChecked) return;
    if (supabaseConfigured && !userId) {
      persisted.current = null;
      setData(emptyData());
      setCompanies([]);
      setActiveCompanyId(null);
      setReady(true);
      return;
    }
    loadCompany();
  }, [authChecked, userId, loadCompany]);

  // Änderungen der Reihe nach speichern
  useEffect(() => {
    const prev = persisted.current;
    if (!ready || !prev || prev === data) return;
    persisted.current = data;
    setSync((s) => ({ ...s, state: 'saving' }));
    const companyBefore = adapter.activeCompanyId();
    queue.current = queue.current
      .then(() => adapter.persist(prev, data))
      .then(async () => {
        setSync({ state: 'idle', error: null });
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
        setSync({ state: 'error', error: e.message || 'Speichern fehlgeschlagen' });
      });
  }, [adapter, data, ready, loadCompany]);

  const switchCompany = useCallback((id: string) => loadCompany(id), [loadCompany]);

  const startNewCompany = useCallback(async () => {
    await queue.current;
    previousCompany.current = adapter.activeCompanyId();
    adapter.detach();
    const blank = emptyData();
    persisted.current = blank;
    setData(blank);
    setActiveCompanyId(null);
    setCreatingCompany(true);
  }, [adapter]);

  const cancelNewCompany = useCallback(() => loadCompany(previousCompany.current), [loadCompany]);
  const dismissUpgrade = useCallback(() => setUpgradeNotice(false), []);

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

  const saveCompany = useCallback((company: Company) => update((d) => ({ ...d, company })), [update]);

  const saveCustomer = useCallback(async (customer: Customer) => {
    let saved = customer;
    if (!customer.id) {
      const n = customer.number ? 0 : await adapter.allocate('customer', dataRef.current.counters.customer + 1);
      saved = { ...customer, id: uid(), number: customer.number || `KD-${String(n).padStart(4, '0')}`, createdAt: today() };
      update((d) => ({ ...d, customers: [saved, ...d.customers], counters: { ...d.counters, customer: Math.max(d.counters.customer, n) } }));
    } else {
      update((d) => ({ ...d, customers: d.customers.map((c) => (c.id === customer.id ? customer : c)) }));
    }
    return saved;
  }, [adapter, update]);

  const deleteCustomer = useCallback((id: string) => update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) })), [update]);

  const saveMaterial = useCallback(async (material: Material) => {
    let saved = material;
    if (!material.id) {
      const n = material.number ? 0 : await adapter.allocate('material', dataRef.current.counters.material + 1);
      const movements = material.stock ? [{ id: uid(), date: today(), quantity: material.stock, note: 'Anfangsbestand' }] : [];
      saved = { ...material, id: uid(), number: material.number || `ART-${String(n).padStart(4, '0')}`, movements };
      update((d) => ({ ...d, materials: [saved, ...d.materials], counters: { ...d.counters, material: Math.max(d.counters.material, n) } }));
    } else {
      update((d) => ({ ...d, materials: d.materials.map((m) => (m.id === material.id ? material : m)) }));
    }
    return saved;
  }, [adapter, update]);

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
    if (kind === 'invoice' && invoiceQuota(dataRef.current).reached) {
      setUpgradeNotice(true);
      return null;
    }
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
    update((s) => ({
      ...s,
      documents: [doc, ...s.documents],
      counters: { ...s.counters, [kind]: { ...s.counters[kind], [year]: Math.max(s.counters[kind][year] || 0, n) } },
    }));
    return doc;
  }, [adapter, update]);

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

  const saveExpense = useCallback((expense: Expense) => update((d) => ({
    ...d,
    expenses: expense.id && d.expenses.some((e) => e.id === expense.id)
      ? d.expenses.map((e) => (e.id === expense.id ? expense : e))
      : [{ ...expense, id: expense.id || uid() }, ...d.expenses],
  })), [update]);

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
    data, ready, auth, authenticated, sync, companies, activeCompanyId, creatingCompany, switchCompany, startNewCompany, cancelNewCompany,
    upgradeNotice, dismissUpgrade, saveCompany, saveCustomer, deleteCustomer, saveMaterial, deleteMaterial, bookStock, createDoc, saveDoc, deleteDoc,
    setDocStatus, offerToInvoice, duplicateDoc, saveExpense, deleteExpense, saveDesign, saveSettings, saveLocation, deleteLocation, markSent, replaceAll, loadDemo, reset,
  }), [data, ready, auth, authenticated, sync, companies, activeCompanyId, creatingCompany, switchCompany, startNewCompany, cancelNewCompany,
    upgradeNotice, dismissUpgrade, saveCompany, saveCustomer, deleteCustomer, saveMaterial, deleteMaterial, bookStock, createDoc, saveDoc, deleteDoc,
    setDocStatus, offerToInvoice, duplicateDoc, saveExpense, deleteExpense, saveDesign, saveSettings, saveLocation, deleteLocation, markSent, replaceAll, loadDemo, reset]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
