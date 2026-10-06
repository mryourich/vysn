import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyData } from '../defaults';
import type { CompanySummary, Data, Usage, UsageKind } from '../types';
import { usageMonth } from '../plans';
import { counterMap, countersFromMap, diffById } from './adapter';
import type { StorageAdapter } from './adapter';
import {
  companyFromRow, companyToRow, customerFromRow, customerToRow, documentFromRow, documentToRow, expenseFromRow, expenseToRow,
  locationFromRow, locationToRow, materialFromRow, materialToRow, movementFromRow, movementToRow,
} from './mappers';
import type { MovementWithMaterial } from './mappers';
import { DELETE_ORDER, UPSERT_ORDER, emptyOps, opsEmpty, syncErrorFrom } from './ops';
import type { Ops, Rejection, Row, SyncTable } from './ops';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** True when the Supabase environment variables are set – then the app runs with login and database. */
export const supabaseConfigured = Boolean(SUPABASE_URL && ANON_KEY);

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  if (!client) client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

const PAGE = 1000;
const ACTIVE_KEY = 'vysn-one-active-company';

const remember = (id: string | null) => {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* optional */
  }
};
const remembered = () => {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};
const CHUNK = 500;

function check<T>(res: { data: T; error: { message: string; code?: string; hint?: string } | null; status?: number }): T {
  if (res.error) throw syncErrorFrom({ ...res.error, status: res.status });
  return res.data;
}

const chunks = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

export class SupabaseAdapter implements StorageAdapter {
  readonly mode = 'supabase' as const;
  private companyId: string | null = null;

  constructor(private readonly db: SupabaseClient = getSupabase()) {}

  /** Monatsnutzung der aktiven Firma (Tariflimits). */
  async fetchUsage(month = usageMonth()): Promise<Usage> {
    const res = await this.db.from('usage_counters').select('kind, used').eq('company_id', this.companyId).eq('month', `${month}-01`);
    if (res.error) {
      const err = syncErrorFrom({ ...res.error, status: res.status });
      if (err.transient) throw err;
      // Zähler sind optional (z. B. Datenbank-Update noch nicht eingespielt) – Laden nie daran scheitern lassen
      console.warn('usage_counters nicht verfügbar:', res.error.message);
      return { month, counts: {} };
    }
    const rows = (res.data || []) as { kind: UsageKind; used: number }[];
    return { month, counts: Object.fromEntries(rows.map((r) => [r.kind, Number(r.used)])) };
  }

  /** Reads all rows of a company, page by page (PostgREST returns max. 1000 rows per request). */
  private async fetchAll(table: string, order: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = check(await this.db.from(table).select('*').eq('company_id', this.companyId).order(order, { ascending: false }).range(from, from + PAGE - 1));
      rows.push(...(page || []));
      if (!page || page.length < PAGE) return rows;
    }
  }

  async listCompanies(): Promise<CompanySummary[]> {
    const rows = check(await this.db.rpc('my_companies')) as Record<string, unknown>[] | null;
    return (rows || []).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      logo: String(r.logo ?? ''),
      plan: (r.plan as CompanySummary['plan']) || 'start',
      role: String(r.role ?? ''),
    }));
  }

  activeCompanyId() {
    return this.companyId;
  }

  detach() {
    this.companyId = null;
  }

  /** Offline-Start: Firma aktivieren, ohne vom Server zu laden (Daten kommen vom Gerät). */
  attach(companyId: string) {
    this.companyId = companyId;
    remember(companyId);
  }

  async load(companyId?: string | null): Promise<Data> {
    const data = emptyData();
    const ids = (await this.listCompanies()).map((c) => c.id);
    this.companyId = [companyId, remembered(), ids[0]].find((x): x is string => !!x && ids.includes(x)) || null;
    if (!this.companyId) return data;
    remember(this.companyId);

    const companyRow = check(await this.db.from('companies').select('*').eq('id', this.companyId).single());
    const { company, design, settings } = companyFromRow(companyRow as Record<string, unknown>);
    const month = usageMonth();
    const [customers, materials, movements, documents, expenses, counters, locations, usage] = await Promise.all([
      this.fetchAll('customers', 'created_at'),
      this.fetchAll('materials', 'name'),
      this.fetchAll('stock_movements', 'date'),
      this.fetchAll('documents', 'date'),
      this.fetchAll('expenses', 'date'),
      this.fetchAll('number_counters', 'key'),
      this.fetchAll('storage_locations', 'code'),
      this.fetchUsage(month),
    ]);
    const byMaterial = new Map<string, MovementWithMaterial[]>();
    for (const m of movements.map(movementFromRow)) byMaterial.set(m.materialId, [...(byMaterial.get(m.materialId) || []), m]);

    return {
      ...data,
      company,
      design,
      settings,
      locations: locations.map(locationFromRow).sort((a, b) => a.code.localeCompare(b.code, 'de')),
      customers: customers.map(customerFromRow),
      materials: materials.map((r) => materialFromRow(r, (byMaterial.get(String(r.id)) || []).map(({ materialId: _, ...mv }) => mv))),
      documents: documents.map(documentFromRow),
      expenses: expenses.map(expenseFromRow),
      counters: countersFromMap(Object.fromEntries(counters.map((c) => [String(c.key), Number(c.last_number)]))),
      usage,
    };
  }

  async allocate(key: string, localNext: number) {
    if (!this.companyId) return localNext;
    const n = check(await this.db.rpc('allocate_number', { p_company: this.companyId, p_key: key }));
    return Math.max(Number(n), localNext);
  }

  /**
   * Berechnet, was zwischen zwei Datenständen in der Datenbank zu tun ist (ohne zu senden).
   * Erkennt Änderungen über die Objektidentität (der Store arbeitet unveränderlich).
   */
  plan(prev: Data, next: Data): Ops | null {
    const cid = this.companyId;
    if (!cid || !next.company) return null;
    const ops = emptyOps(cid);
    if (prev.company !== next.company || prev.design !== next.design || prev.settings !== next.settings) {
      ops.company = companyToRow(next.company, next.design, next.settings);
    }
    const customers = diffById(prev.customers, next.customers);
    const materials = diffById(prev.materials, next.materials);
    const flat = (d: Data) => d.materials.flatMap((m) => m.movements.map((mv) => ({ ...mv, materialId: m.id })));
    // Bewegungen sind unveränderlich – nur neue und gelöschte werden übertragen.
    const prevMoves = new Set(flat(prev).map((m) => m.id));
    const nextMoves = flat(next);
    const nextMoveIds = new Set(nextMoves.map((m) => m.id));
    const documents = diffById(prev.documents, next.documents);
    const expenses = diffById(prev.expenses, next.expenses);
    const locations = diffById(prev.locations, next.locations);
    const put = (table: SyncTable, rows: Row[]) => { if (rows.length) ops.upserts[table] = rows; };
    const del = (table: SyncTable, ids: string[]) => { if (ids.length) ops.deletes[table] = ids; };
    put('customers', customers.upserts.map((c) => customerToRow(c, cid)));
    put('storage_locations', locations.upserts.map((l) => locationToRow(l, cid)));
    put('materials', materials.upserts.map((m) => materialToRow(m, cid)));
    put('stock_movements', nextMoves.filter((m) => !prevMoves.has(m.id)).map((m) => movementToRow(m, cid)));
    put('documents', documents.upserts.map((d) => documentToRow(d, cid)));
    put('expenses', expenses.upserts.map((e) => expenseToRow(e, cid)));
    del('documents', documents.deletes);
    del('expenses', expenses.deletes);
    del('stock_movements', [...prevMoves].filter((id) => !nextMoveIds.has(id)));
    del('materials', materials.deletes);
    del('customers', customers.deletes);
    del('storage_locations', locations.deletes);
    if (prev.counters !== next.counters) {
      const before = counterMap(prev);
      const changed = Object.fromEntries(Object.entries(counterMap(next)).filter(([k, v]) => before[k] !== v));
      if (Object.keys(changed).length) ops.counters = changed;
    }
    return opsEmpty(ops) ? null : ops;
  }

  /**
   * Sendet ein Änderungspaket. Netzfehler werfen (Paket bleibt in der Warteschlange);
   * dauerhaft abgelehnte Zeilen (Limit, Rechte, Regeln) werden einzeln ermittelt und
   * zurückgegeben – alle übrigen Änderungen werden trotzdem gespeichert.
   */
  async apply(ops: Ops): Promise<Rejection[]> {
    const rejected: Rejection[] = [];
    const cid = ops.companyId;
    const reject = (table: string, id: string, e: { message: string; hint?: string }) => rejected.push({ table, id, message: e.message, hint: e.hint || '' });
    if (ops.company) {
      const res = await this.db.from('companies').update(ops.company).eq('id', cid);
      if (res.error) {
        const err = syncErrorFrom({ ...res.error, status: res.status });
        if (err.transient) throw err;
        reject('companies', cid, err);
      }
    }
    for (const table of UPSERT_ORDER) {
      for (const part of chunks(ops.upserts[table] || [])) {
        const res = await this.db.from(table).upsert(part, { onConflict: 'company_id,id' });
        if (!res.error) continue;
        const err = syncErrorFrom({ ...res.error, status: res.status });
        if (err.transient) throw err;
        // Paket abgelehnt: Zeilen einzeln senden, damit nur die betroffene Zeile entfällt
        for (const row of part) {
          const one = await this.db.from(table).upsert(row, { onConflict: 'company_id,id' });
          if (!one.error) continue;
          const e = syncErrorFrom({ ...one.error, status: one.status });
          if (e.transient) throw e;
          reject(table, String(row.id), e);
        }
      }
    }
    for (const table of DELETE_ORDER) {
      for (const part of chunks(ops.deletes[table] || [])) {
        const res = await this.db.from(table).delete().eq('company_id', cid).in('id', part);
        if (!res.error) continue;
        const err = syncErrorFrom({ ...res.error, status: res.status });
        if (err.transient) throw err;
        for (const id of part) {
          const one = await this.db.from(table).delete().eq('company_id', cid).eq('id', id);
          if (!one.error) continue;
          const e = syncErrorFrom({ ...one.error, status: one.status });
          if (e.transient) throw e;
          reject(table, id, e);
        }
      }
    }
    if (ops.counters && Object.keys(ops.counters).length) check(await this.db.rpc('bump_counters', { p_company: cid, p_counters: ops.counters }));
    return rejected;
  }

  /**
   * Legt beim ersten Speichern die Firma an bzw. löscht sie („Diese Firma löschen“).
   * Gibt true zurück, wenn damit alles erledigt ist; sonst übernimmt die Warteschlange.
   */
  async persistStructure(prev: Data, next: Data): Promise<boolean> {
    if (prev.company && !next.company) {
      if (this.companyId) check(await this.db.from('companies').delete().eq('id', this.companyId));
      this.companyId = null;
      return true;
    }
    if (!next.company) return true;
    if (!this.companyId) {
      this.companyId = check(await this.db.rpc('create_company', { p_name: next.company.name })) as string;
      remember(this.companyId);
      const ops = this.plan(emptyData(), next); // alles Vorhandene erstmalig übertragen
      const rejected = ops ? await this.apply(ops) : [];
      if (rejected.length) throw new Error(rejected[0].message);
      return true;
    }
    return false;
  }

  async persist(prev: Data, next: Data) {
    if (await this.persistStructure(prev, next)) return;
    const ops = this.plan(prev, next);
    if (!ops) return;
    const rejected = await this.apply(ops);
    if (rejected.length) throw new Error(rejected[0].message);
  }
}
