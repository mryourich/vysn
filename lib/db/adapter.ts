import type { Data } from '../types';

/**
 * Persistence layer used by the store. The UI always works on an in-memory
 * `Data` snapshot; adapters load it once and persist every change.
 *
 * - `local`    – browser localStorage (no account, single device)
 * - `supabase` – Postgres via Supabase with login, multi-device & team access
 */
export interface StorageAdapter {
  readonly mode: 'local' | 'supabase';
  /** Loads the complete data set of the current user/company. */
  load(): Promise<Data>;
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
  for (const kind of ['invoice', 'offer'] as const) {
    for (const [year, n] of Object.entries(data.counters[kind] || {})) out[`${kind}:${year}`] = n;
  }
  if (data.counters.customer) out.customer = data.counters.customer;
  if (data.counters.material) out.material = data.counters.material;
  return out;
}

/** Inverse of counterMap. */
export function countersFromMap(map: Record<string, number>): Data['counters'] {
  const counters: Data['counters'] = { invoice: {}, offer: {}, customer: 0, material: 0 };
  for (const [key, n] of Object.entries(map)) {
    const [kind, year] = key.split(':');
    if ((kind === 'invoice' || kind === 'offer') && year) counters[kind][year] = n;
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
