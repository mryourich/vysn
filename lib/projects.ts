import type { SupabaseClient } from '@supabase/supabase-js';
import { round2, uid } from './calc';
import type { Company, LineItem, Material } from './types';

/**
 * Baustellen: Regiestunden, Material, Fotos und Mängel je Baustelle – daraus direkt die Rechnung.
 * Gemeinsam für Website und App (die App übernimmt die Datei per scripts/sync-shared.js);
 * der Datenbank-Client wird übergeben.
 */
export type ProjectStatus = 'active' | 'done';
export type EntryKind = 'hours' | 'material' | 'photo' | 'defect' | 'note';

export type Project = {
  id: string;
  number: string;
  name: string;
  customerId: string;
  street: string;
  zip: string;
  city: string;
  status: ProjectStatus;
  startDate: string;
  hourlyRate: number;
  notes: string;
  createdAt: string;
};

export type ProjectEntry = {
  id: string;
  projectId: string;
  kind: EntryKind;
  date: string;
  person: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vat: number | null;
  materialId: string;
  photoPath: string;
  /** Mängel: offen / behoben */
  status: 'open' | 'done';
  /** Rechnung, mit der Stunden/Material abgerechnet wurden */
  invoiceId: string;
  createdAt: string;
};

export const ENTRY_KINDS: Record<EntryKind, { one: string; many: string }> = {
  hours: { one: 'Regiestunden', many: 'Regiestunden' },
  material: { one: 'Material', many: 'Material' },
  photo: { one: 'Foto', many: 'Fotos' },
  defect: { one: 'Mangel', many: 'Mängel' },
  note: { one: 'Notiz', many: 'Notizen' },
};

export const PROJECT_BUCKET = 'project-files';
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

export const emptyProject = (): Project => ({
  id: '', number: '', name: '', customerId: '', street: '', zip: '', city: '', status: 'active',
  startDate: '', hourlyRate: 0, notes: '', createdAt: '',
});

export const emptyEntry = (projectId: string, kind: EntryKind, date: string): ProjectEntry => ({
  id: '', projectId, kind, date, person: '', description: '', quantity: kind === 'hours' ? 1 : kind === 'material' ? 1 : 0,
  unit: kind === 'hours' ? 'Std.' : 'Stück', unitPrice: 0, vat: null, materialId: '', photoPath: '', status: 'open', invoiceId: '', createdAt: '',
});

export const projectFromRow = (r: Record<string, unknown>): Project => ({
  id: str(r.id), number: str(r.number), name: str(r.name), customerId: str(r.customer_id), street: str(r.street), zip: str(r.zip), city: str(r.city),
  status: r.status === 'done' ? 'done' : 'active', startDate: str(r.start_date), hourlyRate: num(r.hourly_rate), notes: str(r.notes), createdAt: str(r.created_at),
});

const projectToRow = (p: Project, companyId: string) => ({
  company_id: companyId, id: p.id, number: p.number, name: p.name, customer_id: p.customerId || null, street: p.street, zip: p.zip, city: p.city,
  status: p.status, start_date: p.startDate || null, hourly_rate: round2(p.hourlyRate), notes: p.notes,
});

export const entryFromRow = (r: Record<string, unknown>): ProjectEntry => ({
  id: str(r.id), projectId: str(r.project_id), kind: (str(r.kind) || 'note') as EntryKind, date: str(r.date), person: str(r.person), description: str(r.description),
  quantity: num(r.quantity), unit: str(r.unit), unitPrice: num(r.unit_price), vat: r.vat === null || r.vat === undefined ? null : Number(r.vat),
  materialId: str(r.material_id), photoPath: str(r.photo_path), status: r.status === 'done' ? 'done' : 'open', invoiceId: str(r.invoice_id), createdAt: str(r.created_at),
});

const entryToRow = (e: ProjectEntry, companyId: string) => ({
  company_id: companyId, id: e.id, project_id: e.projectId, kind: e.kind, date: e.date, person: e.person, description: e.description,
  quantity: e.quantity, unit: e.unit, unit_price: round2(e.unitPrice), vat: e.vat, material_id: e.materialId || null,
  photo_path: e.photoPath || null, status: e.status, invoice_id: e.invoiceId || null,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(/relation .*projects|project_entries/.test(res.error.message) ? 'Baustellen sind noch nicht eingerichtet (Datenbank-Update fehlt).' : res.error.message);
  return res.data;
}

export async function listProjects(db: SupabaseClient, companyId: string): Promise<Project[]> {
  const rows = check(await db.from('projects').select('*').eq('company_id', companyId).order('created_at', { ascending: false }));
  return ((rows || []) as Record<string, unknown>[]).map(projectFromRow);
}

export async function listEntries(db: SupabaseClient, companyId: string, projectId?: string): Promise<ProjectEntry[]> {
  let q = db.from('project_entries').select('*').eq('company_id', companyId);
  if (projectId) q = q.eq('project_id', projectId);
  const rows = check(await q.order('date', { ascending: false }).order('created_at', { ascending: false }));
  return ((rows || []) as Record<string, unknown>[]).map(entryFromRow);
}

/** Baustelle anlegen (mit Nummer BS-0001 …) oder speichern */
export async function saveProject(db: SupabaseClient, companyId: string, p: Project): Promise<Project> {
  let saved = p;
  if (!p.id) {
    const n = check(await db.rpc('allocate_number', { p_company: companyId, p_key: 'project' })) as number;
    saved = { ...p, id: uid(), number: p.number || `BS-${String(n).padStart(4, '0')}` };
    check(await db.from('projects').insert(projectToRow(saved, companyId)));
    return { ...saved, createdAt: new Date().toISOString() };
  }
  check(await db.from('projects').update(projectToRow(p, companyId)).eq('company_id', companyId).eq('id', p.id));
  return saved;
}

export async function deleteProject(db: SupabaseClient, companyId: string, p: Project, entries: ProjectEntry[]) {
  const photos = entries.filter((e) => e.photoPath).map((e) => e.photoPath);
  if (photos.length) await db.storage.from(PROJECT_BUCKET).remove(photos);
  check(await db.from('projects').delete().eq('company_id', companyId).eq('id', p.id));
}

export async function saveEntry(db: SupabaseClient, companyId: string, e: ProjectEntry): Promise<ProjectEntry> {
  const saved = e.id ? e : { ...e, id: uid() };
  check(await db.from('project_entries').upsert(entryToRow(saved, companyId), { onConflict: 'company_id,id' }));
  return { ...saved, createdAt: saved.createdAt || new Date().toISOString() };
}

export async function deleteEntry(db: SupabaseClient, companyId: string, e: ProjectEntry) {
  if (e.photoPath) await db.storage.from(PROJECT_BUCKET).remove([e.photoPath]);
  check(await db.from('project_entries').delete().eq('company_id', companyId).eq('id', e.id));
}

const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-80) || 'foto.jpg';
export const photoPathFor = (companyId: string, projectId: string, fileName: string) => `${companyId}/${projectId}/${uid()}-${safeName(fileName)}`;

/** Foto hochladen (Blob im Browser, ArrayBuffer in der App) und als Eintrag speichern */
export async function addPhoto(db: SupabaseClient, companyId: string, projectId: string, body: Blob | ArrayBuffer, fileName: string, contentType: string, description: string, date: string) {
  const size = body instanceof ArrayBuffer ? body.byteLength : body.size;
  if (size > MAX_PHOTO_BYTES) throw new Error('Das Foto ist größer als 15 MB.');
  const path = photoPathFor(companyId, projectId, fileName);
  const up = await db.storage.from(PROJECT_BUCKET).upload(path, body, { contentType: contentType || 'image/jpeg', upsert: false });
  if (up.error) throw new Error(up.error.message);
  try {
    return await saveEntry(db, companyId, { ...emptyEntry(projectId, 'photo', date), description, photoPath: path });
  } catch (e) {
    await db.storage.from(PROJECT_BUCKET).remove([path]);
    throw e;
  }
}

/** Kurzlebige Links für Fotos (1 h) */
export async function photoUrls(db: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await db.storage.from(PROJECT_BUCKET).createSignedUrls(paths, 3600);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path || '', d.signedUrl as string]));
}

/** Abrechenbar: Regiestunden und Material, die noch in keiner Rechnung stehen */
export const billable = (entries: ProjectEntry[]) => entries.filter((e) => (e.kind === 'hours' || e.kind === 'material') && !e.invoiceId && e.quantity > 0);

const fmtDate = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '');

/** Rechnungspositionen aus offenen Regiestunden (je Tag und Person) und Material (je Artikel zusammengefasst) */
export function invoiceItems(entries: ProjectEntry[], project: Project, company: Pick<Company, 'smallBusiness' | 'defaultVat'>, materials: Material[]): LineItem[] {
  const vatOf = (v: number | null) => (company.smallBusiness ? 0 : v ?? company.defaultVat);
  const items: LineItem[] = [];
  const hours = entries.filter((e) => e.kind === 'hours').sort((a, b) => a.date.localeCompare(b.date));
  for (const e of hours) {
    items.push({
      id: uid(), description: `Regiestunden ${fmtDate(e.date)}${e.person ? ` – ${e.person}` : ''}`, details: e.description,
      quantity: e.quantity, unit: e.unit || 'Std.', unitPrice: e.unitPrice || project.hourlyRate, vat: vatOf(e.vat), discount: 0,
    });
  }
  // Material: gleiche Artikel zum gleichen Preis zusammenfassen
  const groups = new Map<string, LineItem>();
  for (const e of entries.filter((x) => x.kind === 'material')) {
    const m = materials.find((x) => x.id === e.materialId);
    const key = `${e.materialId || e.description}|${e.unitPrice}|${e.unit}`;
    const prev = groups.get(key);
    if (prev) { prev.quantity = round2(prev.quantity + e.quantity); continue; }
    groups.set(key, {
      id: uid(), materialId: m?.id, description: e.description || m?.name || 'Material', details: m?.description || '',
      quantity: e.quantity, unit: e.unit || m?.unit || 'Stück', unitPrice: e.unitPrice, vat: vatOf(e.vat ?? m?.vat ?? null), discount: 0,
    });
  }
  return [...items, ...groups.values()];
}

/** Abgerechnete Einträge mit der Rechnung verknüpfen */
export async function markBilled(db: SupabaseClient, companyId: string, entryIds: string[], invoiceId: string) {
  if (!entryIds.length) return;
  check(await db.from('project_entries').update({ invoice_id: invoiceId }).eq('company_id', companyId).in('id', entryIds));
}

/** Summen für die Übersicht */
export function projectSummary(entries: ProjectEntry[]) {
  const open = billable(entries);
  return {
    hours: round2(entries.filter((e) => e.kind === 'hours').reduce((s, e) => s + e.quantity, 0)),
    openHours: round2(open.filter((e) => e.kind === 'hours').reduce((s, e) => s + e.quantity, 0)),
    openValue: round2(open.reduce((s, e) => s + e.quantity * e.unitPrice, 0)),
    photos: entries.filter((e) => e.kind === 'photo').length,
    openDefects: entries.filter((e) => e.kind === 'defect' && e.status === 'open').length,
  };
}
