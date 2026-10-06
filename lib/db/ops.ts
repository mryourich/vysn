/**
 * Änderungspakete („Ops“) für die Synchronisation mit Supabase.
 *
 * Ein Paket beschreibt, was in der Datenbank zu tun ist (Zeilen schreiben/löschen),
 * und ist reines JSON – es kann auf dem Gerät gespeichert (Warteschlange), später
 * gesendet und mit neueren Paketen zusammengeführt werden.
 */

export type Row = Record<string, unknown>;

/** Reihenfolge beim Schreiben (Fremdschlüssel: Lagerplatz → Artikel → Bewegung usw.). */
export const UPSERT_ORDER = ['customers', 'storage_locations', 'materials', 'stock_movements', 'documents', 'expenses'] as const;
/** Reihenfolge beim Löschen (abhängige Zeilen zuerst). */
export const DELETE_ORDER = ['documents', 'expenses', 'stock_movements', 'materials', 'customers', 'storage_locations'] as const;
export type SyncTable = (typeof UPSERT_ORDER)[number];

export type Ops = {
  companyId: string;
  /** Geänderte Firmenzeile (Stammdaten, Design, Einstellungen) */
  company?: Row;
  upserts: Partial<Record<SyncTable, Row[]>>;
  deletes: Partial<Record<SyncTable, string[]>>;
  /** Nummernkreise anheben (Maximum je Schlüssel) */
  counters?: Record<string, number>;
};

export const emptyOps = (companyId: string): Ops => ({ companyId, upserts: {}, deletes: {} });

export function opsSize(ops: Ops | null | undefined): number {
  if (!ops) return 0;
  const count = (o: Partial<Record<string, unknown[]>>) => Object.values(o).reduce((n, list) => n + (list?.length || 0), 0);
  return (ops.company ? 1 : 0) + count(ops.upserts) + count(ops.deletes) + (ops.counters && Object.keys(ops.counters).length ? 1 : 0);
}

export const opsEmpty = (ops: Ops | null | undefined) => opsSize(ops) === 0;

/**
 * Führt zwei Pakete zusammen – `later` gewinnt. Ein späteres Löschen hebt ein früheres
 * Schreiben derselben Zeile auf und umgekehrt.
 */
export function mergeOps(earlier: Ops | null, later: Ops): Ops {
  if (!earlier || earlier.companyId !== later.companyId) return later;
  const out: Ops = { companyId: later.companyId, company: later.company ?? earlier.company, upserts: {}, deletes: {} };
  for (const table of UPSERT_ORDER) {
    const rows = new Map<string, Row>();
    const dels = new Set<string>();
    for (const r of earlier.upserts[table] || []) rows.set(String(r.id), r);
    for (const id of earlier.deletes[table] || []) dels.add(id);
    for (const id of later.deletes[table] || []) { rows.delete(id); dels.add(id); }
    for (const r of later.upserts[table] || []) { rows.set(String(r.id), r); dels.delete(String(r.id)); }
    if (rows.size) out.upserts[table] = [...rows.values()];
    if (dels.size) out.deletes[table] = [...dels];
  }
  const counters = { ...(earlier.counters || {}) };
  for (const [k, v] of Object.entries(later.counters || {})) counters[k] = Math.max(counters[k] || 0, v);
  if (Object.keys(counters).length) out.counters = counters;
  return out;
}

/** Fehler beim Synchronisieren. `transient` = Netz/Server vorübergehend – später erneut senden. */
export class SyncError extends Error {
  constructor(message: string, readonly transient: boolean, readonly code = '', readonly hint = '') {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * Ordnet einen Supabase-Fehler ein. PostgREST liefert bei Datenbankfehlern immer einen Code
 * (SQLSTATE bzw. PGRSTxxx); ohne Code war es ein Netz- oder Serverproblem.
 */
export function syncErrorFrom(error: { message?: string; code?: string; hint?: string; status?: number } | null | undefined): SyncError {
  const message = error?.message || 'Unbekannter Fehler';
  const code = String(error?.code || '');
  const status = Number(error?.status || 0);
  const network = !code || /fetch|network|load failed|timeout|ECONN|abort/i.test(message);
  // PGRST3xx = Token ungültig/abgelaufen (wird automatisch erneuert), 5xx = Server
  const retry = network || code.startsWith('PGRST3') || status >= 500 || status === 0 || status === 408 || status === 429;
  return new SyncError(message, retry, code, String(error?.hint || ''));
}

/** Abgelehnte Zeile (dauerhafter Fehler, z. B. Monatslimit oder fehlende Rechte). */
export type Rejection = { table: string; id: string; message: string; hint: string };

/** Vorläufige Nummer für offline angelegte Belege, Kunden und Artikel (endgültig beim Abgleich). */
export const PROVISIONAL = 'OFFLINE-';
export const isProvisional = (number: string | undefined | null) => !!number && number.startsWith(PROVISIONAL);
export const provisionalNumber = (id: string) => `${PROVISIONAL}${id.slice(-4).toUpperCase()}`;
