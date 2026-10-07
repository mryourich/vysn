import { DOC_KIND_LIST } from '../types';
import type { CompanySummary, Data, DocKind } from '../types';

/**
 * Persistence layer used by the store. The UI always works on an in-memory
 * `Data` snapshot; adapters load it once and persist every change.
 *
 * - `local`    – browser localStorage (no account, single device)
 * - `supabase` – Postgres via Supabase with login, multi-device & team access
 */
export interface StorageAdapter {
  readonly mode: 'local' | 'supabase';
  /** All companies the current user can open. */
  listCompanies(): Promise<CompanySummary[]>;
  /**
   * Loads the complete data set of one company and makes it the active one.
   * Without an id the last used (or first) company is loaded; if the user has
   * none, an empty snapshot without company is returned.
   */
  load(companyId?: string | null): Promise<Data>;
  /** Id of the company that `persist` currently writes to (null = none yet). */
  activeCompanyId(): string | null;
  /** Detaches from the active company – the next persisted company is created as a new one. */
  detach(): void;
  /** Persists the difference between two snapshots. */
  persist(prev: Data, next: Data): Promise<void>;
  /**
   * Reserves the next number of a number range ("invoice:2026", "offer:2026",
   * "customer", "material"). `localNext` is the value derived from the local
   * snapshot and is used by adapters without a server-side counter.
   */
  allocate(key: string, localNext: number): Promise<number>;
}

/** Flattens the counters of a snapshot to "invoice:2026" → 12 etc. */
export function counterMap(data: Data): Record<string, number> {
  const out: Record<string, number> = {};
  for (const kind of DOC_KIND_LIST) {
    for (const [year, n] of Object.entries(data.counters[kind] || {})) out[`${kind}:${year}`] = n;
  }
  if (data.counters.customer) out.customer = data.counters.customer;
  if (data.counters.material) out.material = data.counters.material;
  return out;
}

/** Inverse of counterMap. */
export function countersFromMap(map: Record<string, number>): Data['counters'] {
  const counters: Data['counters'] = { offer: {}, confirmation: {}, delivery: {}, invoice: {}, order: {}, customer: 0, material: 0 };
  for (const [key, n] of Object.entries(map)) {
    const [kind, year] = key.split(':');
    if ((DOC_KIND_LIST as string[]).includes(kind) && year) counters[kind as DocKind][year] = n;
    else if (kind === 'customer' || kind === 'material') counters[kind] = n;
  }
  return counters;
}

/** Items whose object identity changed (store updates are immutable) and ids that disappeared. */
export function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const after = new Set(next.map((x) => x.id));
  return {
    upserts: next.filter((x) => before.get(x.id) !== x),
    deletes: prev.filter((x) => !after.has(x.id)).map((x) => x.id),
  };
}
