import type { Data, UsageKind } from '../types';
import { usageMonth } from '../plans';
import {
  companyFromRow, customerFromRow, documentFromRow, expenseFromRow, locationFromRow, materialFromRow, movementFromRow,
} from './mappers';
import type { Row } from './ops';

/**
 * Änderungen anderer Geräte (Supabase Realtime) in den Datenstand übernehmen.
 * Reine Funktionen – der Store entscheidet, ob eine Änderung übernommen wird.
 */

export const REMOTE_TABLES = ['companies', 'customers', 'materials', 'stock_movements', 'documents', 'expenses', 'storage_locations', 'usage_counters'] as const;
export type RemoteTable = (typeof REMOTE_TABLES)[number];

export type RemoteChange = {
  table: RemoteTable;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  /** neue Zeile (INSERT/UPDATE) */
  row: Row;
  /** alte Zeile – bei DELETE nur Primärschlüssel (company_id, id) */
  old: Row;
  /** Nur den Lagerbestand übernehmen (eigene Änderung am Artikel hat Vorrang) */
  stockOnly?: boolean;
};

/** Schlüssel „tabelle:id“ – derselbe Aufbau wie in der Warteschlange. */
export const remoteKey = (table: string, id: unknown) => `${table}:${String(id)}`;

export function changeId(c: RemoteChange) {
  return String((c.type === 'DELETE' ? c.old : c.row).id ?? '');
}

const upsertById = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
const removeById = <T extends { id: string }>(list: T[], id: string) => (list.some((x) => x.id === id) ? list.filter((x) => x.id !== id) : list);

export function applyRemote(data: Data, c: RemoteChange): Data {
  if (!data.company) return data;
  const id = changeId(c);
  if (c.stockOnly) {
    const stock = Number(c.row.stock);
    if (!data.materials.some((m) => m.id === id && m.stock !== stock)) return data;
    return { ...data, materials: data.materials.map((m) => (m.id === id ? { ...m, stock } : m)) };
  }
  const del = c.type === 'DELETE';
  switch (c.table) {
    case 'companies': {
      if (del) return data;
      const { company, design, settings } = companyFromRow(c.row);
      return { ...data, company, design, settings };
    }
    case 'customers':
      return { ...data, customers: del ? removeById(data.customers, id) : upsertById(data.customers, customerFromRow(c.row)) };
    case 'documents':
      return { ...data, documents: del ? removeById(data.documents, id) : upsertById(data.documents, documentFromRow(c.row)) };
    case 'expenses':
      return { ...data, expenses: del ? removeById(data.expenses, id) : upsertById(data.expenses, expenseFromRow(c.row)) };
    case 'storage_locations': {
      const locations = del ? removeById(data.locations, id) : upsertById(data.locations, locationFromRow(c.row));
      return { ...data, locations: [...locations].sort((a, b) => a.code.localeCompare(b.code, 'de', { numeric: true })) };
    }
    case 'materials': {
      if (del) return { ...data, materials: removeById(data.materials, id) };
      const existing = data.materials.find((m) => m.id === id);
      // Bestand kommt vom Server (aus den Bewegungen fortgeschrieben), Bewegungen bleiben lokal erhalten
      return { ...data, materials: upsertById(data.materials, materialFromRow(c.row, existing?.movements || [])) };
    }
    case 'stock_movements': {
      if (del) {
        if (!data.materials.some((m) => m.movements.some((mv) => mv.id === id))) return data;
        return { ...data, materials: data.materials.map((m) => (m.movements.some((mv) => mv.id === id) ? { ...m, movements: m.movements.filter((mv) => mv.id !== id) } : m)) };
      }
      const { materialId, ...mv } = movementFromRow(c.row);
      const material = data.materials.find((m) => m.id === materialId);
      if (!material || material.movements.some((x) => x.id === mv.id)) return data;
      const movements = [mv, ...material.movements].sort((a, b) => b.date.localeCompare(a.date));
      return { ...data, materials: data.materials.map((m) => (m.id === materialId ? { ...m, movements } : m)) };
    }
    case 'usage_counters': {
      if (del) return data;
      const month = String(c.row.month || '').slice(0, 7);
      if (month !== usageMonth()) return data;
      const counts = data.usage.month === month ? data.usage.counts : {};
      return { ...data, usage: { month, counts: { ...counts, [c.row.kind as UsageKind]: Number(c.row.used) } } };
    }
  }
  return data;
}
