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

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const chunks = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

export class SupabaseAdapter implements StorageAdapter {
  readonly mode = 'supabase' as const;
  private companyId: string | null = null;

  constructor(private readonly db: SupabaseClient = getSupabase()) {}

  /** Monatsnutzung der aktiven Firma (Tariflimits). */
  async fetchUsage(month = usageMonth()): Promise<Usage> {
    const rows = check(await this.db.from('usage_counters').select('kind, used').eq('company_id', this.companyId).eq('month', `${month}-01`)) as { kind: UsageKind; used: number }[] | null;
    return { month, counts: Object.fromEntries((rows || []).map((r) => [r.kind, Number(r.used)])) };
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

  private async upsert(table: string, rows: Record<string, unknown>[]) {
    for (const part of chunks(rows)) check(await this.db.from(table).upsert(part, { onConflict: 'company_id,id' }));
  }

  private async remove(table: string, ids: string[]) {
    for (const part of chunks(ids)) check(await this.db.from(table).delete().eq('company_id', this.companyId).in('id', part));
  }

  async persist(prev: Data, next: Data) {
    // Firma gelöscht („Alle Daten löschen“): Kaskade entfernt alle Geschäftsdaten.
    if (prev.company && !next.company) {
      if (this.companyId) check(await this.db.from('companies').delete().eq('id', this.companyId));
      this.companyId = null;
      return;
    }
    if (!next.company) return;

    if (!this.companyId) {
      this.companyId = check(await this.db.rpc('create_company', { p_name: next.company.name })) as string;
      remember(this.companyId);
      prev = emptyData(); // alles Vorhandene (z. B. Beispieldaten) erstmalig übertragen
    }
    const cid = this.companyId;

    if (prev.company !== next.company || prev.design !== next.design || prev.settings !== next.settings) {
      check(await this.db.from('companies').update(companyToRow(next.company, next.design, next.settings)).eq('id', cid));
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

    await this.upsert('customers', customers.upserts.map((c) => customerToRow(c, cid)));
    await this.upsert('storage_locations', locations.upserts.map((l) => locationToRow(l, cid)));
    await this.upsert('materials', materials.upserts.map((m) => materialToRow(m, cid)));
    await this.upsert('stock_movements', nextMoves.filter((m) => !prevMoves.has(m.id)).map((m) => movementToRow(m, cid)));
    await this.upsert('documents', documents.upserts.map((d) => documentToRow(d, cid)));
    await this.upsert('expenses', expenses.upserts.map((e) => expenseToRow(e, cid)));

    await this.remove('documents', documents.deletes);
    await this.remove('expenses', expenses.deletes);
    await this.remove('stock_movements', [...prevMoves].filter((id) => !nextMoveIds.has(id)));
    await this.remove('materials', materials.deletes);
    await this.remove('customers', customers.deletes);
    await this.remove('storage_locations', locations.deletes);

    if (prev.counters !== next.counters) {
      const changed = Object.fromEntries(Object.entries(counterMap(next)).filter(([k, v]) => counterMap(prev)[k] !== v));
      if (Object.keys(changed).length) check(await this.db.rpc('bump_counters', { p_company: cid, p_counters: changed }));
    }
  }
}
