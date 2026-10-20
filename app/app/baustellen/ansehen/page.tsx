'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Clock, HardHat, MapPin, Package, Pencil, ReceiptText, StickyNote, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { docTotals, formatDate, money, qty, round2, today } from '../../../../lib/calc';
import { docEditPath } from '../../../../lib/docs';
import { getSupabase } from '../../../../lib/db/supabase';
import {
  ENTRY_KINDS, addPhoto, billable, deleteEntry, deleteProject, emptyEntry, invoiceItems, listEntries, listProjects, markBilled, photoUrls, projectSummary, saveEntry,
} from '../../../../lib/projects';
import type { EntryKind, Project, ProjectEntry } from '../../../../lib/projects';
import { useStore } from '../../../../lib/store';
import { ProjectModal } from '../../../../components/app/project-modal';
import { Badge, Empty, Field, NumberInput, PageHeader, Segmented, StatCard, useConfirm } from '../../../../components/app/ui';

export default function ProjectPage() {
  return <Suspense fallback={null}><ProjectView /></Suspense>;
}

type Tab = EntryKind | 'all';
const TABS: [Tab, string][] = [['hours', 'Regiestunden'], ['material', 'Material'], ['photo', 'Fotos'], ['defect', 'Mängel'], ['note', 'Notizen'], ['all', 'Alles']];

function ProjectView() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const router = useRouter();
  const confirm = useConfirm();
  const { data, activeCompanyId, createDoc, saveDoc } = useStore();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('hours');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const db = useMemo(() => getSupabase(), []);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const [ps, es] = await Promise.all([listProjects(db, activeCompanyId), listEntries(db, activeCompanyId, id)]);
      setProject(ps.find((p) => p.id === id) || null);
      setEntries(es);
      setUrls(await photoUrls(db, es.filter((e) => e.photoPath).map((e) => e.photoPath)).catch(() => ({})));
    } catch (e) {
      setError((e as Error).message);
      setProject(null);
    }
  }, [db, activeCompanyId, id]);
  useEffect(() => { load(); }, [load]);

  if (project === undefined) return <div className="page"><p className="muted">Lädt …</p></div>;
  if (!project) return <div className="page"><PageHeader title="Baustelle nicht gefunden" /><Link href="/app/baustellen" className="btn"><ArrowLeft size={16} /> Zu den Baustellen</Link></div>;

  const company = data.company!;
  const customer = data.customers.find((c) => c.id === project.customerId);
  const sum = projectSummary(entries);
  const open = billable(entries);
  const shown = entries.filter((e) => tab === 'all' || e.kind === tab);
  const invoiceOf = (invoiceId: string) => data.documents.find((d) => d.id === invoiceId);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };

  const add = (e: ProjectEntry) => run('add', async () => { const saved = await saveEntry(db, activeCompanyId!, e); setEntries((x) => [saved, ...x]); });
  const update = (e: ProjectEntry) => run(`u-${e.id}`, async () => { const saved = await saveEntry(db, activeCompanyId!, e); setEntries((x) => x.map((y) => (y.id === e.id ? saved : y))); });
  const remove = (e: ProjectEntry) => {
    if (!confirm(`${ENTRY_KINDS[e.kind].one} löschen?`)) return;
    run(`d-${e.id}`, async () => { await deleteEntry(db, activeCompanyId!, e); setEntries((x) => x.filter((y) => y.id !== e.id)); });
  };

  /** Offene Regiestunden und Material als Rechnungsentwurf */
  const createInvoice = () => run('invoice', async () => {
    if (!open.length) return;
    const items = invoiceItems(open, project, company, data.materials);
    const total = docTotals(items, company.smallBusiness).gross;
    if (!confirm(`Rechnung über ${money(total)} aus ${open.length} Einträgen erstellen?\n\nDie Einträge werden als abgerechnet markiert. Material wird beim Festschreiben der Rechnung vom Lager abgebucht.`)) return;
    const doc = await createDoc('invoice', project.customerId);
    if (!doc) return;
    saveDoc({ ...doc, subject: `Baustelle ${project.name}${project.city ? `, ${project.city}` : ''}`, items });
    await markBilled(db, activeCompanyId!, open.map((e) => e.id), doc.id);
    router.push(docEditPath(doc));
  });

  const address = [project.street, [project.zip, project.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <div className="page">
      <Link href="/app/baustellen" className="back-link"><ArrowLeft size={15} /> Baustellen</Link>
      <PageHeader title={project.name}
        description={[project.number, customer?.name, address].filter(Boolean).join(' · ')}
        actions={<>
          {address ? <a className="btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"><MapPin size={16} /> Karte</a> : null}
          <button className="btn" onClick={() => setEditing(true)}><Pencil size={16} /> Bearbeiten</button>
          <button className="btn btn-primary" disabled={!open.length || !!busy} onClick={createInvoice}><ReceiptText size={16} /> {busy === 'invoice' ? 'Erstelle …' : 'Rechnung erstellen'}</button>
        </>} />

      {project.status === 'done' ? <div className="notice"><Check size={16} /><span>Diese Baustelle ist abgeschlossen.</span></div> : null}
      {error ? <div className="notice notice-warn" role="alert"><TriangleAlert size={16} /><span>{error}</span></div> : null}

      <div className="stats">
        <StatCard label="Regiestunden gesamt" value={`${qty(sum.hours)} Std.`} sub={`davon ${qty(sum.openHours)} offen`} />
        <StatCard label="Noch abzurechnen" value={money(sum.openValue)} sub="netto" tone={sum.openValue ? 'success' : undefined} />
        <StatCard label="Fotos" value={String(sum.photos)} />
        <StatCard label="Offene Mängel" value={String(sum.openDefects)} tone={sum.openDefects ? 'warning' : undefined} />
      </div>

      <section className="card">
        <div className="toolbar"><Segmented value={tab} options={TABS} onChange={setTab} /></div>
        {tab !== 'all' ? <EntryForm kind={tab} project={project} busy={busy === 'add'} onAdd={add}
          onPhotos={(files, description) => run('add', async () => {
            for (const f of files) await addPhoto(db, activeCompanyId!, project.id, f, f.name, f.type, description, today());
            await load();
          })} /> : null}

        {tab === 'photo' && shown.length ? (
          <div className="photo-grid">
            {shown.map((e) => (
              <figure key={e.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signierte Storage-Links */}
                {urls[e.photoPath] ? <a href={urls[e.photoPath]} target="_blank" rel="noreferrer"><img src={urls[e.photoPath]} alt={e.description || 'Foto'} loading="lazy" /></a> : <div className="photo-missing"><Camera size={20} /></div>}
                <figcaption><span>{e.description || formatDate(e.date)}</span><button className="icon-btn danger" title="Löschen" onClick={() => remove(e)}><Trash2 size={14} /></button></figcaption>
              </figure>
            ))}
          </div>
        ) : shown.length ? (
          <div className="table entries">
            {shown.map((e) => {
              const inv = e.invoiceId ? invoiceOf(e.invoiceId) : undefined;
              const Icon = { hours: Clock, material: Package, photo: Camera, defect: TriangleAlert, note: StickyNote }[e.kind];
              return (
                <div key={e.id} className="tr tr-entry">
                  <span className="td-main"><Icon size={16} /><span>
                    <strong>{e.kind === 'hours' ? `${qty(e.quantity)} Std.${e.person ? ` · ${e.person}` : ''}` : e.kind === 'material' ? `${qty(e.quantity)} ${e.unit} ${e.description}` : e.description || ENTRY_KINDS[e.kind].one}</strong>
                    <small>{formatDate(e.date)}{e.kind === 'hours' && e.description ? ` · ${e.description}` : ''}{e.kind === 'photo' ? ' · Foto' : ''}</small>
                  </span></span>
                  <span className="td-num">
                    {e.kind === 'hours' || e.kind === 'material' ? money(round2(e.quantity * e.unitPrice)) : null}
                    {e.kind === 'defect' ? <button className={`btn btn-small${e.status === 'done' ? '' : ' btn-warn'}`} onClick={() => update({ ...e, status: e.status === 'done' ? 'open' : 'done' })}>{e.status === 'done' ? 'Behoben' : 'Offen'}</button> : null}
                  </span>
                  <span className="td-muted small">{inv ? <Link href={docEditPath(inv)} className="link">abgerechnet · {inv.number}</Link> : e.invoiceId ? 'abgerechnet' : e.kind === 'hours' || e.kind === 'material' ? <Badge tone="info">offen</Badge> : null}</span>
                  <span className="row-actions">{!e.invoiceId ? <button className="icon-btn danger" title="Löschen" onClick={() => remove(e)}><Trash2 size={15} /></button> : null}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon={<HardHat />} title={`Noch keine ${tab === 'all' ? 'Einträge' : ENTRY_KINDS[tab].many}`} text="Einträge kommen auch direkt aus der App – vor Ort auf der Baustelle." />
        )}
      </section>

      <button className="btn btn-quiet danger" onClick={() => {
        if (!confirm(`Baustelle „${project.name}“ mit allen Einträgen und Fotos löschen? Bereits erstellte Rechnungen bleiben erhalten.`)) return;
        run('delete', async () => { await deleteProject(db, activeCompanyId!, project, entries); router.push('/app/baustellen'); });
      }}><Trash2 size={15} /> Baustelle löschen</button>

      {editing ? <ProjectModal initial={project} onClose={() => setEditing(false)} onSaved={(p) => { setProject(p); setEditing(false); }} /> : null}
    </div>
  );
}

/** Erfassung je Art: Regiestunden, Material, Fotos, Mängel, Notizen */
function EntryForm({ kind, project, busy, onAdd, onPhotos }: {
  kind: EntryKind; project: Project; busy: boolean; onAdd: (e: ProjectEntry) => void; onPhotos: (files: File[], description: string) => void;
}) {
  const { data } = useStore();
  const [e, setE] = useState<ProjectEntry>(() => ({ ...emptyEntry(project.id, kind, today()), unitPrice: kind === 'hours' ? project.hourlyRate : 0 }));
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setE({ ...emptyEntry(project.id, kind, today()), unitPrice: kind === 'hours' ? project.hourlyRate : 0 }); }, [kind, project.id, project.hourlyRate]);
  const set = (p: Partial<ProjectEntry>) => setE({ ...e, ...p });
  const submit = () => {
    onAdd(e);
    setE({ ...emptyEntry(project.id, kind, e.date), person: e.person, unitPrice: kind === 'hours' ? e.unitPrice : 0 });
  };
  const pickMaterial = (id: string) => {
    const m = data.materials.find((x) => x.id === id);
    set(m ? { materialId: m.id, description: m.name, unit: m.unit, unitPrice: m.salePrice, vat: m.vat } : { materialId: '', description: '' });
  };

  if (kind === 'photo') {
    return (
      <div className="entry-form">
        <Field label="Beschreibung (optional)" span={2}><input value={e.description} onChange={(x) => set({ description: x.target.value })} placeholder="z. B. Verteiler vor dem Verschließen" /></Field>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(x) => {
          const files = Array.from(x.target.files || []);
          x.target.value = '';
          if (files.length) { onPhotos(files, e.description); set({ description: '' }); }
        }} />
        <button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16} /> {busy ? 'Lädt hoch …' : 'Fotos hinzufügen'}</button>
      </div>
    );
  }

  return (
    <div className="entry-form">
      <Field label="Datum"><input type="date" value={e.date} onChange={(x) => set({ date: x.target.value })} /></Field>
      {kind === 'hours' ? (
        <>
          <Field label="Wer"><input value={e.person} onChange={(x) => set({ person: x.target.value })} placeholder="z. B. Thomas" /></Field>
          <Field label="Stunden"><NumberInput value={e.quantity} onChange={(v) => set({ quantity: v })} min={0} /></Field>
          <Field label="Stundensatz"><NumberInput value={e.unitPrice} onChange={(v) => set({ unitPrice: v })} suffix="€" min={0} /></Field>
          <Field label="Tätigkeit" span={2}><input value={e.description} onChange={(x) => set({ description: x.target.value })} placeholder="z. B. Verteiler gesetzt, Leitungen gezogen" /></Field>
        </>
      ) : kind === 'material' ? (
        <>
          <Field label="Artikel" span={2}>
            <select value={e.materialId} onChange={(x) => pickMaterial(x.target.value)}>
              <option value="">– freie Eingabe –</option>
              {[...data.materials].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.number})</option>)}
            </select>
          </Field>
          {!e.materialId ? <Field label="Bezeichnung" span={2}><input value={e.description} onChange={(x) => set({ description: x.target.value })} /></Field> : null}
          <Field label="Menge"><NumberInput value={e.quantity} onChange={(v) => set({ quantity: v })} min={0} /></Field>
          <Field label="Einheit"><input value={e.unit} onChange={(x) => set({ unit: x.target.value })} /></Field>
          <Field label="Preis (netto)"><NumberInput value={e.unitPrice} onChange={(v) => set({ unitPrice: v })} suffix="€" min={0} /></Field>
        </>
      ) : (
        <Field label={kind === 'defect' ? 'Mangel' : 'Notiz'} span={3}><input value={e.description} onChange={(x) => set({ description: x.target.value })} placeholder={kind === 'defect' ? 'z. B. FI-Schalter Bad löst aus' : ''} /></Field>
      )}
      <button className="btn btn-primary" disabled={busy || (kind === 'hours' ? !e.quantity : kind === 'material' ? !e.quantity || !e.description.trim() : !e.description.trim())} onClick={submit}>
        {busy ? 'Speichert …' : `${ENTRY_KINDS[kind].one} eintragen`}
      </button>
    </div>
  );
}
