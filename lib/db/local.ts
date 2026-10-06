import { uid } from '../calc';
import { defaultDesign, defaultSettings, emptyCompany, emptyData } from '../defaults';
import type { CompanySummary, Data } from '../types';
import type { StorageAdapter } from './adapter';

const LEGACY_KEY = 'vysn-one-data-v1';
const WORKSPACE_KEY = 'vysn-one-workspace-v2';

/** All companies of this browser. */
type Workspace = { active: string | null; companies: Record<string, Data> };

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
    materials: (d.materials || []).map((m) => ({ ...m, locationId: m.locationId || '', movements: m.movements || [] })),
    documents: (d.documents || []).map((x) => ({ ...x, sentAt: x.sentAt || '', sentTo: x.sentTo || '' })),
    expenses: (d.expenses || []).map((e) => ({ ...e, kind: e.kind || 'expense' })),
    locations: d.locations || [],
    design: { ...defaultDesign(), ...(d.design || {}) },
    settings: {
      datev: { ...defaultSettings().datev, ...(d.settings?.datev || {}) },
      email: { ...defaultSettings().email, ...(d.settings?.email || {}) },
    },
    counters: { ...base.counters, ...(d.counters || {}) },
  } as Data;
}

export class LocalAdapter implements StorageAdapter {
  readonly mode = 'local' as const;
  private active: string | null = null;

  private read(): Workspace {
    try {
      const stored = window.localStorage.getItem(WORKSPACE_KEY);
      if (stored) {
        const ws = JSON.parse(stored) as Workspace;
        for (const id of Object.keys(ws.companies || {})) ws.companies[id] = migrate(ws.companies[id]);
        return { active: ws.active ?? null, companies: ws.companies || {} };
      }
      // Übernahme der Daten aus der Version mit nur einer Firma
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const data = migrate(JSON.parse(legacy));
        if (data.company) {
          const id = uid();
          const ws = { active: id, companies: { [id]: data } };
          this.write(ws);
          window.localStorage.removeItem(LEGACY_KEY);
          return ws;
        }
      }
    } catch {
      /* Speicher nicht verfügbar oder beschädigt */
    }
    return { active: null, companies: {} };
  }

  private write(ws: Workspace) {
    try {
      window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
    } catch {
      throw new Error('Lokaler Speicher ist voll oder nicht verfügbar.');
    }
  }

  async listCompanies(): Promise<CompanySummary[]> {
    const ws = this.read();
    return Object.entries(ws.companies)
      .filter(([, d]) => d.company)
      .map(([id, d]) => ({ id, name: d.company!.name, logo: d.company!.logo, plan: d.company!.plan }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  async load(companyId?: string | null) {
    const ws = this.read();
    const ids = Object.keys(ws.companies);
    const id = [companyId, ws.active, ids[0]].find((x): x is string => !!x && !!ws.companies[x]) || null;
    this.active = id;
    if (id && ws.active !== id) this.write({ ...ws, active: id });
    return id ? ws.companies[id] : emptyData();
  }

  activeCompanyId() {
    return this.active;
  }

  detach() {
    this.active = null;
  }

  async persist(_prev: Data, next: Data) {
    const ws = this.read();
    if (!next.company) {
      // Firma gelöscht
      if (this.active) delete ws.companies[this.active];
      this.active = null;
      this.write({ active: Object.keys(ws.companies)[0] || null, companies: ws.companies });
      return;
    }
    if (!this.active) this.active = uid();
    ws.companies[this.active] = next;
    this.write({ active: this.active, companies: ws.companies });
  }

  async allocate(_key: string, localNext: number) {
    return localNext;
  }
}
