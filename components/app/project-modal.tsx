'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { formatDate, today } from '../../lib/calc';
import { getSupabase } from '../../lib/db/supabase';
import { emptyProject, saveProject } from '../../lib/projects';
import type { Project } from '../../lib/projects';
import { useStore } from '../../lib/store';
import { Field, Modal, NumberInput } from './ui';

/** Baustelle anlegen oder bearbeiten */
export function ProjectModal({ initial, onClose, onSaved }: { initial?: Project; onClose: () => void; onSaved: (p: Project) => void }) {
  const { data, activeCompanyId } = useStore();
  const [p, setP] = useState<Project>(initial || { ...emptyProject(), startDate: today() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<Project>) => setP({ ...p, ...patch });

  const pickCustomer = (id: string) => {
    const c = data.customers.find((x) => x.id === id);
    // Adresse der Baustelle mit der Kundenadresse vorbelegen, solange sie leer ist
    set({ customerId: id, ...(c && !p.street && !p.city ? { street: c.street, zip: c.zip, city: c.city } : {}), ...(c && !p.name ? { name: `${c.name}${c.city ? ` – ${c.city}` : ''}` } : {}) });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      onSaved(await saveProject(getSupabase(), activeCompanyId!, { ...p, name: p.name.trim() }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Baustelle bearbeiten' : 'Neue Baustelle'} onClose={onClose}
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button><button className="btn btn-primary" disabled={busy || !p.name.trim()} onClick={save}>{busy ? 'Speichert …' : initial ? 'Speichern' : 'Baustelle anlegen'}</button></>}>
      <div className="form-grid">
        <Field label="Kunde" span={3}>
          <select value={p.customerId} onChange={(e) => pickCustomer(e.target.value)}>
            <option value="">– ohne Kunde –</option>
            {[...data.customers].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>)}
          </select>
        </Field>
        <Field label="Bezeichnung der Baustelle" span={3}><input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. EFH Huber – Elektroinstallation" autoFocus /></Field>
        <Field label="Straße" span={3}><input value={p.street} onChange={(e) => set({ street: e.target.value })} /></Field>
        <Field label="PLZ"><input value={p.zip} onChange={(e) => set({ zip: e.target.value })} inputMode="numeric" /></Field>
        <Field label="Ort" span={2}><input value={p.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Stundensatz (netto)" hint="Für Regiestunden"><NumberInput value={p.hourlyRate} onChange={(v) => set({ hourlyRate: v })} suffix="€" min={0} /></Field>
        <Field label="Beginn"><input type="date" value={p.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
        <Field label="Status">
          <select value={p.status} onChange={(e) => set({ status: e.target.value as Project['status'] })}><option value="active">Laufend</option><option value="done">Abgeschlossen</option></select>
        </Field>
        <Field label="Notizen" span={3}><textarea rows={3} value={p.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Zugang, Ansprechpartner vor Ort, Schlüssel …" /></Field>
      </div>
      {error ? <div className="notice notice-warn" role="alert"><TriangleAlert size={16} /><span>{error}</span></div> : null}
      {initial?.startDate ? <p className="muted small">Angelegt {formatDate(initial.createdAt.slice(0, 10))}</p> : null}
    </Modal>
  );
}
