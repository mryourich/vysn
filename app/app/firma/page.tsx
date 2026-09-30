'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, Download, Palette, RotateCcw, Upload } from 'lucide-react';
import { today } from '../../../lib/calc';
import { useStore } from '../../../lib/store';
import type { Company } from '../../../lib/types';
import { CompanyForm } from '../../../components/app/company-form';
import { PageHeader } from '../../../components/app/ui';

export default function CompanyPage() {
  const { data, saveCompany, replaceAll, reset, auth } = useStore();
  const [company, setCompany] = useState<Company>(data.company!);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(company) !== JSON.stringify(data.company);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const save = () => {
    if (!company.name.trim()) return;
    saveCompany(company);
    setSaved(true);
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vysn-one-sicherung-${today()}.json`;
    a.click();
  };

  return (
    <div className="page">
      <PageHeader title="Firmendaten" description="Stammdaten, die auf Ihren Angeboten und Rechnungen erscheinen."
        actions={<button className="btn btn-primary" onClick={save} disabled={!dirty || !company.name.trim()}>{saved ? <><Check size={16} /> Gespeichert</> : 'Änderungen speichern'}</button>} />

      <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <CompanyForm value={company} onChange={setCompany} sections={['logo', 'basics', 'contact', 'tax', 'bank', 'numbers']} />
        <div className="form-footer">
          <Link href="/app/design" className="link"><Palette size={15} /> Rechnungsdesign anpassen</Link>
          <button type="submit" className="btn btn-primary" disabled={!dirty || !company.name.trim()}>Änderungen speichern</button>
        </div>
      </form>

      <section className="card">
        <div className="card-head"><div><h2>Datensicherung</h2><p>{auth.mode === 'supabase'
          ? `Ihre Daten werden in der Cloud gespeichert (angemeldet als ${auth.email}). Zusätzlich können Sie jederzeit eine vollständige Sicherung herunterladen.`
          : 'Ihre Daten werden lokal in diesem Browser gespeichert. Legen Sie regelmäßig eine Sicherung an oder übertragen Sie damit Ihre Daten auf ein anderes Gerät.'}</p></div></div>
        <div className="secondary-actions">
          <button className="btn" onClick={backup}><Download size={16} /> Sicherung herunterladen</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const parsed = JSON.parse(await file.text());
              if (!parsed || typeof parsed !== 'object' || !('documents' in parsed)) throw new Error();
              if (confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) replaceAll(parsed);
            } catch {
              alert('Die Datei ist keine gültige VYSN-One-Sicherung.');
            }
          }} />
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Sicherung einspielen</button>
          <button className="btn btn-quiet danger" onClick={() => {
            if (confirm(auth.mode === 'supabase' ? 'Wirklich die Firma mit allen Daten endgültig löschen? Dies kann nicht rückgängig gemacht werden.' : 'Wirklich alle Daten in diesem Browser löschen? Dies kann nicht rückgängig gemacht werden.')) reset();
          }}><RotateCcw size={16} /> Alle Daten löschen</button>
        </div>
      </section>
    </div>
  );
}
