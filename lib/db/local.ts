import { defaultDesign, emptyCompany, emptyData } from '../defaults';
import type { Data } from '../types';
import type { StorageAdapter } from './adapter';

const STORAGE_KEY = 'vysn-one-data-v1';

/** Brings older or partial snapshots (e.g. backups) into the current shape. */
export function migrate(raw: unknown): Data {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<Data>;
  return {
    ...base,
    ...d,
    company: d.company ? { ...emptyCompany(), ...d.company } : null,
    customers: d.customers || [],
    materials: (d.materials || []).map((m) => ({ ...m, movements: m.movements || [] })),
    documents: d.documents || [],
    expenses: d.expenses || [],
    design: { ...defaultDesign(), ...(d.design || {}) },
    counters: { ...base.counters, ...(d.counters || {}) },
  } as Data;
}

export class LocalAdapter implements StorageAdapter {
  readonly mode = 'local' as const;

  async load() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? migrate(JSON.parse(stored)) : emptyData();
    } catch {
      return emptyData();
    }
  }

  async persist(_prev: Data, next: Data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error('Lokaler Speicher ist voll oder nicht verfügbar.');
    }
  }

  async allocate(_key: string, localNext: number) {
    return localNext;
  }
}
