'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Download, Lock, Palette, Plus, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { today } from '../../../lib/calc';
import { useStore } from '../../../lib/store';
import { QuotaList } from '../../../components/app/quota';
import { PLANS } from '../../../lib/plans';
import type { Company } from '../../../lib/types';
import { CompanyForm } from '../../../components/app/company-form';
import { DesignEditor } from '../../../components/app/design-editor';
import { PageHeader } from '../../../components/app/ui';

export default function CompanyPage() {
  const { data, saveCompany, replaceAll, reset, auth, startNewCompany, companies, role, can, requireFeature } = useStore();
  const [tab, setTab] = useState<'daten' | 'design'>('daten');
  const [company, setCompany] = useState<Company>(data.company!);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(company) !== JSON.stringify(data.company);

  // ?tab=design (alte Adresse /app/design und Links) öffnet direkt das Rechnungsdesign
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'design' && can('design')) setTab('design');
  }, [can]);
  const openDesign = () => { if (requireFeature('design')) setTab('design'); };

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
    <div className={tab === 'design' ? 'page page-wide' : 'page'}>
      <PageHeader title="Unternehmen" description="Stammdaten und Gestaltung Ihrer Angebote und Rechnungen."
        actions={tab === 'daten' ? <button className="btn btn-primary" onClick={save} disabled={!dirty || !company.name.trim()}>{saved ? <><Check size={16} /> Gespeichert</> : 'Änderungen speichern'}</button> : null} />

      <div className="segmented page-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'daten'} className={tab === 'daten' ? 'active' : ''} onClick={() => setTab('daten')}><Building2 size={15} /> Unternehmensdaten</button>
        <button role="tab" aria-selected={tab === 'design'} className={tab === 'design' ? 'active' : ''} onClick={openDesign}>{can('design') ? <Palette size={15} /> : <Lock size={14} />} Rechnungsdesign</button>
      </div>

      {tab === 'design' ? <DesignEditor onEditCompany={() => setTab('daten')} /> : <>

      <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <CompanyForm value={company} onChange={setCompany} sections={['logo', 'basics', 'contact', 'tax', 'bank', 'numbers']} />
        <div className="form-footer">
          <button type="button" className="link" onClick={openDesign}><Palette size={15} /> Rechnungsdesign anpassen</button>
          <button type="submit" className="btn btn-primary" disabled={!dirty || !company.name.trim()}>Änderungen speichern</button>
        </div>
      </form>

      <section className="card" id="tarif">
        <div className="card-head">
          <div><h2>Tarif</h2><p>Der Tarif gilt je Firma. Mehrere Firmen sind in den Tarifen Business und Team enthalten.</p></div>
          <button className="btn" onClick={() => startNewCompany()}><Plus size={16} /> Weitere Firma</button>
        </div>
        <div className="plan-box">
          <div>
            <span className="plan-name">{PLANS[data.company!.plan].label}</span>
            <QuotaList />
          </div>
          <Link className={`btn ${data.company!.plan === 'start' ? 'btn-primary' : ''}`} href="/app/tarif"><Sparkles size={16} /> {data.company!.plan === 'start' ? 'Tarif upgraden' : 'Tarif & Abrechnung'}</Link>
        </div>
        {companies.length > 1 ? <p className="muted small mt">Sie verwalten {companies.length} Firmen. Wechseln Sie unten links in der Seitenleiste bzw. mobil über das Firmensymbol oben rechts.</p> : null}
      </section>

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
          {role === 'owner' ? (
            <>
              <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Sicherung einspielen</button>
              <button className="btn btn-quiet danger" onClick={() => {
                if (confirm(`Wirklich „${data.company!.name}“ mit allen Kunden, Belegen und Zahlen endgültig löschen? Dies kann nicht rückgängig gemacht werden.`)) reset();
              }}><RotateCcw size={16} /> Diese Firma löschen</button>
            </>
          ) : null}
        </div>
        {role !== 'owner' ? <p className="muted small mt">Sicherungen einspielen und die Firma löschen kann nur der Inhaber.</p> : null}
      </section>
      </>}
    </div>
  );
}
