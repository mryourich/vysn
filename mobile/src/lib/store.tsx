import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { setCurrency } from '../shared/calc';
import { emptyData } from '../shared/defaults';
import { SupabaseAdapter } from '../shared/db/supabase';
import { aiAddonActive, usageLabel, usageQuota } from '../shared/plans';
import { taxProfile } from '../shared/tax';
import type { CompanySummary, Customer, Data, DocKind, Material, SalesDoc, UsageKind } from '../shared/types';
import * as A from './actions';
import { supabase } from './supabase';

const ACTIVE_KEY = 'vysner-active-company';

type Store = {
  session: Session | null;
  authReady: boolean;
  data: Data;
  companies: CompanySummary[];
  companyId: string | null;
  role: string;
  loading: boolean;
  saving: boolean;
  error: string;
  aiBooked: boolean;
  reload: () => Promise<void>;
  switchCompany: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
  commit: (fn: (d: Data) => Data) => void;
  createDoc: (kind: DocKind, customerId?: string) => Promise<SalesDoc | null>;
  convertDoc: (sourceId: string, kind: DocKind) => Promise<SalesDoc | null>;
  saveCustomer: (c: Customer) => Promise<Customer | null>;
  saveMaterial: (m: Material) => Promise<Material | null>;
};

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider fehlt');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo(() => new SupabaseAdapter(supabase), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<Data>(emptyData);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dataRef = useRef(data);
  dataRef.current = data;
  // Änderungen nacheinander speichern, damit keine sich überholt
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => { setSession(s.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async (id?: string | null) => {
    setLoading(true);
    setError('');
    try {
      const wanted = id ?? (await AsyncStorage.getItem(ACTIVE_KEY));
      const [list, next] = await Promise.all([adapter.listCompanies(), adapter.load(wanted)]);
      setCompanies(list);
      setCompanyId(adapter.activeCompanyId());
      if (adapter.activeCompanyId()) await AsyncStorage.setItem(ACTIVE_KEY, adapter.activeCompanyId()!);
      setCurrency(taxProfile(next.company).currency);
      setData(next);
    } catch (e) {
      setError((e as Error).message || 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    if (session?.user.id) load();
    else { setData(emptyData()); setCompanies([]); setCompanyId(null); }
  }, [session?.user.id, load]);

  const commit = useCallback((fn: (d: Data) => Data) => {
    const prev = dataRef.current;
    const next = fn(prev);
    if (next === prev) return;
    dataRef.current = next;
    setData(next);
    queue.current = queue.current.then(async () => {
      setSaving(true);
      try {
        await adapter.persist(prev, next);
      } catch (e) {
        Alert.alert('Nicht gespeichert', `${(e as Error).message || 'Verbindung fehlgeschlagen.'}\n\nDie Daten werden neu geladen.`);
        await load(adapter.activeCompanyId());
      } finally {
        setSaving(false);
      }
    });
  }, [adapter, load]);

  /** Monatskontingent prüfen; in der App ohne Kaufaufforderung (Vorgabe der App-Stores). */
  const allow = useCallback((kind: UsageKind) => {
    const q = usageQuota(dataRef.current, kind);
    if (!q.reached) return true;
    Alert.alert('Monatslimit erreicht', `Im ${q.monthLabel} sind bereits ${q.used} von ${q.limit} ${usageLabel(kind).many} angelegt. Ab dem 1. des nächsten Monats beginnt das Kontingent neu.`);
    return false;
  }, []);

  const allocate = useCallback(async (key: string, localNext: number) => {
    try {
      return await adapter.allocate(key, localNext);
    } catch (e) {
      Alert.alert('Keine Verbindung', 'Für eine neue Nummer braucht die App eine Internetverbindung.');
      throw e;
    }
  }, [adapter]);

  const createDoc = useCallback(async (kind: DocKind, customerId = '') => {
    if (!allow(kind)) return null;
    const year = new Date().getFullYear().toString();
    const n = await allocate(`${kind}:${year}`, (dataRef.current.counters[kind][year] || 0) + 1).catch(() => null);
    if (n === null) return null;
    let doc: SalesDoc | null = null;
    commit((d) => { const [next, created] = A.newDoc(d, kind, n, customerId); doc = created; return next; });
    return doc;
  }, [allow, allocate, commit]);

  const convertDoc = useCallback(async (sourceId: string, kind: DocKind) => {
    const src = dataRef.current.documents.find((x) => x.id === sourceId);
    if (!src) return null;
    const target = await createDoc(kind);
    if (!target) return null;
    let full: SalesDoc | null = null;
    commit((d) => { const [next, f] = A.fillFrom(d, target, src); full = f; return next; });
    return full;
  }, [createDoc, commit]);

  const saveCustomer = useCallback(async (c: Customer) => {
    if (c.id) { commit((d) => ({ ...d, customers: d.customers.map((x) => (x.id === c.id ? c : x)) })); return c; }
    if (!allow('customer')) return null;
    const n = c.number ? 0 : await allocate('customer', dataRef.current.counters.customer + 1).catch(() => null);
    if (n === null) return null;
    let saved: Customer | null = null;
    commit((d) => { const [next, s] = A.addCustomer(d, c, n); saved = s; return next; });
    return saved;
  }, [allow, allocate, commit]);

  const saveMaterial = useCallback(async (m: Material) => {
    if (m.id) { commit((d) => ({ ...d, materials: d.materials.map((x) => (x.id === m.id ? m : x)) })); return m; }
    if (!allow('material')) return null;
    const n = m.number ? 0 : await allocate('material', dataRef.current.counters.material + 1).catch(() => null);
    if (n === null) return null;
    let saved: Material | null = null;
    commit((d) => { const [next, s] = A.addMaterial(d, m, n); saved = s; return next; });
    return saved;
  }, [allow, allocate, commit]);

  const switchCompany = useCallback(async (id: string) => { await AsyncStorage.setItem(ACTIVE_KEY, id); await load(id); }, [load]);
  const reload = useCallback(() => load(adapter.activeCompanyId()), [adapter, load]);
  const signOut = useCallback(async () => { await AsyncStorage.removeItem(ACTIVE_KEY); await supabase.auth.signOut(); }, []);

  const role = companies.find((c) => c.id === companyId)?.role || 'owner';
  const aiBooked = aiAddonActive(data.company?.billing?.ai);

  const value = useMemo<Store>(() => ({
    session, authReady, data, companies, companyId, role, loading, saving, error, aiBooked,
    reload, switchCompany, signOut, commit, createDoc, convertDoc, saveCustomer, saveMaterial,
  }), [session, authReady, data, companies, companyId, role, loading, saving, error, aiBooked, reload, switchCompany, signOut, commit, createDoc, convertDoc, saveCustomer, saveMaterial]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
