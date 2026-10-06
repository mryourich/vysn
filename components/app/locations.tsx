'use client';

import { useState } from 'react';
import { MapPin, Pencil, Plus, Printer, QrCode, Trash2 } from 'lucide-react';
import { qty } from '../../lib/calc';
import { qrDataUrl, scanUrl } from '../../lib/qr';
import { useStore } from '../../lib/store';
import type { Material, StorageLocation } from '../../lib/types';
import { downloadPdf } from '../pdf/export';
import { LabelSheet } from '../pdf/label-sheet';
import type { Label } from '../pdf/label-sheet';
import { Empty, Field, Modal } from './ui';

/** Erzeugt einen PDF-Etikettenbogen (QR-Codes) für Lagerplätze und/oder Artikel. */
export function usePrintLabels() {
  const { data, activeCompanyId } = useStore();
  const [busy, setBusy] = useState(false);
  const print = async (targets: { locations?: StorageLocation[]; materials?: Material[] }, fileName = 'Lager-Etiketten.pdf') => {
    setBusy(true);
    try {
      const labels: Label[] = [];
      for (const l of targets.locations || []) {
        const count = data.materials.filter((m) => m.locationId === l.id).length;
        labels.push({ qr: await qrDataUrl(scanUrl({ location: l.id }, activeCompanyId)), code: l.code, title: l.name, subtitle: [l.note, `${count} Artikel`].filter(Boolean).join(' · ') });
      }
      for (const m of targets.materials || []) {
        const loc = data.locations.find((l) => l.id === m.locationId);
        labels.push({ qr: await qrDataUrl(scanUrl({ material: m.id }, activeCompanyId)), code: m.number, title: m.name, subtitle: [loc ? `Platz ${loc.code}` : '', m.unit].filter(Boolean).join(' · ') });
      }
      if (labels.length) await downloadPdf(<LabelSheet labels={labels} company={data.company?.name || ''} />, fileName);
    } finally {
      setBusy(false);
    }
  };
  return { print, busy };
}

export function LocationsPanel() {
  const { data, deleteLocation } = useStore();
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const { print, busy } = usePrintLabels();
  const nextCode = () => {
    const n = data.locations.length + 1;
    return `${String.fromCharCode(64 + Math.min(26, n))}-01`;
  };
  return (
    <>
      {data.locations.length ? (
        <>
          <div className="toolbar">
            <button className="btn" disabled={busy} onClick={() => print({ locations: data.locations }, 'Etiketten Lagerplätze.pdf')}><Printer size={16} /> Alle Etiketten drucken</button>
            <button className="btn" onClick={() => setEditing({ id: '', code: nextCode(), name: '', note: '' })}><Plus size={16} /> Lagerplatz</button>
            <span className="muted small">Etikettenbogen A4 · 3 × 8 (70 × 37 mm)</span>
          </div>
          <div className="table">
            <div className="tr th tr-loc"><span>Lagerplatz</span><span className="hide-sm">Notiz</span><span className="td-num">Artikel</span><span /></div>
            {data.locations.map((l) => {
              const items = data.materials.filter((m) => m.locationId === l.id);
              return (
                <div key={l.id} className="tr tr-loc" role="button" tabIndex={0} onClick={() => setEditing(l)} onKeyDown={(e) => e.key === 'Enter' && setEditing(l)}>
                  <span className="td-main"><span className="avatar avatar-sq"><MapPin size={15} /></span><span><strong>{l.code}</strong><small>{l.name || '—'}</small></span></span>
                  <span className="td-muted hide-sm">{l.note || '—'}</span>
                  <span className="td-num">{items.length}<small className="td-sub">{items.slice(0, 2).map((m) => `${m.name} (${qty(m.stock)})`).join(', ')}{items.length > 2 ? ' …' : ''}</small></span>
                  <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-small" disabled={busy} onClick={() => print({ locations: [l] }, `Etikett ${l.code}.pdf`)}><QrCode size={14} /> Etikett</button>
                    <button className="icon-btn hide-sm" title="Bearbeiten" onClick={() => setEditing(l)}><Pencil size={16} /></button>
                    <button className="icon-btn danger hide-sm" title="Löschen" onClick={() => confirm(`Lagerplatz ${l.code} löschen? Die Artikel bleiben erhalten.`) && deleteLocation(l.id)}><Trash2 size={16} /></button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <Empty icon={<MapPin />} title="Noch keine Lagerplätze" text="Legen Sie Regale und Fächer an und drucken Sie QR-Etiketten. Ein Scan mit dem Handy öffnet direkt die Ein- und Auslagerung."
          action={<button className="btn btn-primary" onClick={() => setEditing({ id: '', code: 'A-01', name: '', note: '' })}><Plus size={16} /> Ersten Lagerplatz anlegen</button>} />
      )}
      {editing ? <LocationModal location={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function LocationModal({ location, onClose }: { location: StorageLocation; onClose: () => void }) {
  const { data, saveLocation } = useStore();
  const [l, setL] = useState(location);
  const duplicate = data.locations.some((x) => x.id !== l.id && x.code.trim().toLowerCase() === l.code.trim().toLowerCase());
  const valid = l.code.trim() && !duplicate;
  const submit = () => {
    if (!valid) return;
    saveLocation({ ...l, code: l.code.trim().toUpperCase(), name: l.name.trim() });
    onClose();
  };
  return (
    <Modal title={location.id ? `Lagerplatz ${location.code}` : 'Neuer Lagerplatz'} onClose={onClose}
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button><button className="btn btn-primary" disabled={!valid} onClick={submit}>Speichern</button></>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Code *" hint={duplicate ? 'Dieser Code ist bereits vergeben.' : 'Steht groß auf dem Etikett, z. B. A-01'}><input value={l.code} onChange={(e) => setL({ ...l, code: e.target.value })} autoFocus /></Field>
        <Field label="Bezeichnung" span={2}><input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="z. B. Regal A · Trockenbau" /></Field>
        <Field label="Notiz" span={3}><input value={l.note} onChange={(e) => setL({ ...l, note: e.target.value })} placeholder="z. B. Halle links, oberstes Fach" /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
