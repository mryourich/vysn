'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  Building2, Check, CheckCircle2, DatabaseBackup, Download, Hash, Info, Lock, Mail, Palette, Percent, RotateCcw, Sparkles, Type, Upload, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { today } from '../../../lib/calc';
import { DOC_KINDS, docMail, docPrefix } from '../../../lib/docs';
import { mailStatus } from '../../../lib/mail';
import type { MailStatus } from '../../../lib/mail';
import { FEATURES } from '../../../lib/plans';
import type { Feature } from '../../../lib/plans';
import { useStore } from '../../../lib/store';
import type { Company, DocKind, EmailSettings } from '../../../lib/types';
import { CompanyForm } from '../../../components/app/company-form';
import type { CompanySection } from '../../../components/app/company-form';
import { DesignEditor } from '../../../components/app/design-editor';
import { DocKindSelect, DocTextsFields } from '../../../components/app/doc-texts';
import { Empty, Field, PageHeader } from '../../../components/app/ui';

type SectionId = 'firma' | 'steuern' | 'nummern' | 'layout' | 'texte' | 'email' | 'daten';
const SECTIONS: { id: SectionId; label: string; hint: string; icon: LucideIcon; feature?: Feature }[] = [
  { id: 'firma', label: 'Unternehmensdetails', hint: 'Name, Logo, Anschrift, Bank', icon: Building2 },
  { id: 'steuern', label: 'Steuern', hint: 'Steuernummer, USt, Kleinunternehmer', icon: Percent },
  { id: 'nummern', label: 'Nummernkreise', hint: 'Präfixe, Zahlungsziel, Gültigkeit', icon: Hash },
  { id: 'layout', label: 'Dokumentenlayout', hint: 'Farben, Schrift, Logo, Aufbau', icon: Palette, feature: 'design' },
  { id: 'texte', label: 'Standardtexte', hint: 'Einleitung und Schluss je Belegart', icon: Type, feature: 'design' },
  { id: 'email', label: 'E-Mail-Versand', hint: 'Versandweg und Vorlagen', icon: Mail, feature: 'email' },
  { id: 'daten', label: 'Import / Export', hint: 'Sicherung, Wiederherstellung', icon: DatabaseBackup },
];

export default function Page() {
  return <Suspense fallback={null}><Settings /></Suspense>;
}

function Settings() {
  const { can, requireFeature } = useStore();
  const param = useSearchParams()?.get('bereich');
  const current = SECTIONS.find((s) => s.id === param) ?? SECTIONS[0];
  const wide = current.id === 'layout' && can('design');

  return (
    <div className={`page${wide ? ' page-wide' : ''}`}>
      <PageHeader title="Einstellungen" description="Alles rund um Ihre Firma, Belege und den Versand – für alle im Team gültig." />
      <div className={`settings${wide ? ' settings-wide' : ''}`}>
        <nav className="settings-nav" aria-label="Einstellungen">
          {SECTIONS.map((s) => {
            const locked = s.feature && !can(s.feature) ? s.feature : null;
            return (
              <Link key={s.id} href={`/app/einstellungen?bereich=${s.id}`} className={s.id === current.id ? 'active' : ''} aria-current={s.id === current.id ? 'page' : undefined}
                onClick={(e) => { if (locked) { e.preventDefault(); requireFeature(locked); } }} scroll={false}>
                <s.icon size={16} strokeWidth={1.9} />
                <span>{s.label}</span>
                {locked ? <Lock size={13} className="nav-lock" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="settings-body">
          {current.feature && !can(current.feature) ? <Locked feature={current.feature} /> : <Section id={current.id} />}
        </div>
      </div>
    </div>
  );
}

function Section({ id }: { id: SectionId }) {
  const router = useRouter();
  switch (id) {
    case 'firma': return <CompanyCard title="Unternehmensdetails" sections={['logo', 'basics', 'contact', 'bank']} />;
    case 'steuern': return <CompanyCard title="Steuern" sections={['tax']} />;
    case 'nummern': return <Numbers />;
    case 'layout': return <DesignEditor onEditCompany={() => router.push('/app/einstellungen?bereich=firma')} />;
    case 'texte': return <Texts />;
    case 'email': return <MailSettings />;
    case 'daten': return <Backup />;
  }
}

function Locked({ feature }: { feature: Feature }) {
  const { requireFeature } = useStore();
  const f = FEATURES[feature];
  return (
    <div className="card">
      <Empty icon={<Lock size={24} />} title={f.label} text={`${f.text} Diese Funktion ist ab dem Tarif Business enthalten.`}
        action={<button className="btn btn-primary" onClick={() => requireFeature(feature)}><Sparkles size={16} /> Jetzt upgraden</button>} />
    </div>
  );
}

/** Firmendaten-Ausschnitt mit eigenem Speichern-Knopf. */
function CompanyCard({ title, sections, children }: { title: string; sections: CompanySection[]; children?: React.ReactNode }) {
  const { data, saveCompany } = useStore();
  const [company, setCompany] = useState<Company>(data.company!);
  const [saved, setSaved] = useState(false);
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
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }} aria-label={title}>
      <CompanyForm value={company} onChange={setCompany} sections={sections} />
      {children}
      <div className="form-footer">
        <span />
        <button type="submit" className="btn btn-primary" disabled={!dirty || !company.name.trim()}>{saved ? <><Check size={16} /> Gespeichert</> : 'Änderungen speichern'}</button>
      </div>
    </form>
  );
}

const OTHER_KINDS: DocKind[] = ['confirmation', 'delivery', 'order'];

function Numbers() {
  const { data, saveSettings } = useStore();
  const prefixes = data.settings.numbers?.prefixes || {};
  const year = new Date().getFullYear();
  const set = (kind: DocKind, value: string) => saveSettings({ ...data.settings, numbers: { prefixes: { ...prefixes, [kind]: value.trim() } } });
  return (
    <>
      <CompanyCard title="Nummernkreise" sections={['numbers']} />
      <section className="card">
        <div className="card-head"><div><h2>Weitere Belegarten</h2><p>Leer lassen für die Vorgabe. Die laufende Nummer zählt je Belegart und Jahr.</p></div></div>
        <div className="form-grid">
          {OTHER_KINDS.map((k) => (
            <Field key={k} label={`Präfix ${DOC_KINDS[k].many}`} hint={`Beispiel: ${docPrefix(data, k)}-${year}-0001`}>
              <input defaultValue={prefixes[k] || ''} placeholder={DOC_KINDS[k].prefix} maxLength={8} onBlur={(e) => e.target.value.trim() !== (prefixes[k] || '') && set(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </section>
    </>
  );
}

function Texts() {
  const [kind, setKind] = useState<DocKind>('invoice');
  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Standardtexte</h2><p>Erscheinen auf jedem neuen Beleg, solange im Beleg kein eigener Text steht. Platzhalter: {'{nummer} {datum} {faellig} {gueltig} {kunde} {betrag}'}</p></div>
        <DocKindSelect value={kind} onChange={setKind} />
      </div>
      <DocTextsFields kind={kind} />
    </section>
  );
}

function MailSettings() {
  const { data, saveSettings } = useStore();
  const e = data.settings.email;
  const set = (patch: Partial<EmailSettings>) => saveSettings({ ...data.settings, email: { ...e, ...patch } });
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [kind, setKind] = useState<DocKind>('invoice');
  useEffect(() => { mailStatus().then(setStatus); }, []);
  const tpl = docMail(e, kind);
  const setTpl = (patch: { subject?: string; body?: string }) => {
    if (kind === 'invoice') set({ invoiceSubject: patch.subject ?? e.invoiceSubject, invoiceBody: patch.body ?? e.invoiceBody });
    else if (kind === 'offer') set({ offerSubject: patch.subject ?? e.offerSubject, offerBody: patch.body ?? e.offerBody });
    else set({ templates: { ...e.templates, [kind]: { ...tpl, ...patch } } });
  };

  return (
    <>
      <section className="card">
        <div className="card-head"><div><h2>Versandweg</h2></div></div>
        {status === null ? <p className="muted">Prüfe Mailserver …</p> : status.enabled ? (
          <div className="status-row ok"><CheckCircle2 size={18} /><span><strong>Direkter Versand aktiv.</strong> E-Mails gehen über Ihren Mailserver, Antworten landen bei {data.company?.email || 'Ihrer Firmen-E-Mail'}.</span></div>
        ) : (
          <div className="status-row"><XCircle size={18} /><span>
            <strong>Kein direkter Versand eingerichtet.</strong> Beim Senden wird das PDF über Ihr Gerät geteilt bzw. Ihr E-Mail-Programm geöffnet.
            {!status.smtp ? ' Für den automatischen Versand hinterlegen Sie beim Hosting die SMTP-Zugangsdaten (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).' : ' Der Mailserver ist eingerichtet – der Versand erfordert die Anmeldung (Supabase).'}
          </span></div>
        )}
        <label className="check mt">
          <input type="checkbox" checked={e.autoSendInvoices} onChange={(ev) => set({ autoSendInvoices: ev.target.checked })} />
          <span><strong>Rechnungen automatisch versenden</strong><br />„Festschreiben & versenden“ schickt die Rechnung ohne weiteren Dialog an die E-Mail-Adresse des Kunden.{!status?.enabled ? ' (Wirksam, sobald der direkte Versand eingerichtet ist.)' : ''}</span>
        </label>
        <div className="form-grid mt">
          <Field label="Kopie jeder E-Mail an (BCC)" span={2} hint="z. B. Ihre Buchhaltung"><input type="email" value={e.bcc} onChange={(ev) => set({ bcc: ev.target.value })} placeholder="optional" /></Field>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div><h2>Vorlagen</h2><p>Platzhalter: {'{nummer} {betrag} {faellig} {gueltig} {kunde} {firma} {datum}'}</p></div>
          <DocKindSelect value={kind} onChange={setKind} />
        </div>
        <div className="form-grid">
          <Field label={`${DOC_KINDS[kind].one} – Betreff`} span={3}><input value={tpl.subject} onChange={(ev) => setTpl({ subject: ev.target.value })} /></Field>
          <Field label={`${DOC_KINDS[kind].one} – Nachricht`} span={3}><textarea rows={7} value={tpl.body} onChange={(ev) => setTpl({ body: ev.target.value })} /></Field>
        </div>
      </section>

      <div className="datev-note"><Info size={16} /><p>Gesendete Belege werden mit Datum und Empfänger protokolliert. Rechnungen werden vor dem Versand festgeschrieben, alle anderen Belege gelten danach als versendet.</p></div>
    </>
  );
}

function Backup() {
  const { data, replaceAll, reset, auth, role } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vysn-one-sicherung-${today()}.json`;
    a.click();
  };
  return (
    <>
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
              alert('Die Datei ist keine gültige VYSNER-One-Sicherung.');
            }
          }} />
          {role === 'owner' ? <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Sicherung einspielen</button> : null}
        </div>
        {role !== 'owner' ? <p className="muted small mt">Sicherungen einspielen kann nur der Inhaber.</p> : null}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Export für die Buchhaltung</h2><p>Rechnungen, Einnahmen und Ausgaben als DATEV-Buchungsstapel für Ihre Steuerberatung.</p></div>
          <Link className="btn" href="/app/export">Zum DATEV-Export</Link></div>
      </section>

      {role === 'owner' ? (
        <section className="card card-danger">
          <div className="card-head"><div><h2>Firma löschen</h2><p>Löscht „{data.company!.name}“ mit allen Kunden, Belegen und Zahlen endgültig.</p></div>
            <button className="btn btn-quiet danger" onClick={() => {
              if (confirm(`Wirklich „${data.company!.name}“ mit allen Kunden, Belegen und Zahlen endgültig löschen? Dies kann nicht rückgängig gemacht werden.`)) reset();
            }}><RotateCcw size={16} /> Diese Firma löschen</button></div>
        </section>
      ) : null}
    </>
  );
}
