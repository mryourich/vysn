'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Building2, Check, KeyRound, LifeBuoy, Mail } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { ROLE_LABEL } from '../../../lib/team';
import { LogoutButton } from '../../../components/app/company-switcher';
import { Field, PageHeader } from '../../../components/app/ui';

export default function Page() {
  return <Suspense fallback={null}><Account /></Suspense>;
}

function Account() {
  const { auth, companies, activeCompanyId } = useStore();
  const recoveryLink = useSearchParams()?.get('passwort') === 'neu';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const cloud = auth.mode === 'supabase';
  const mustSet = auth.recovery || recoveryLink;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) return setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
    if (pw !== pw2) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    try {
      await auth.updatePassword(pw);
      setPw(''); setPw2(''); setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Das Passwort konnte nicht geändert werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Account" description="Ihre Anmeldedaten – gelten für alle Firmen, auf die Sie Zugriff haben." />

      <section className="card">
        <div className="card-head"><div><h2>Anmeldung</h2></div></div>
        <div className="kv-list">
          <div><span><Mail size={16} /> E-Mail-Adresse</span><strong>{auth.email || 'Lokaler Modus ohne Konto'}</strong></div>
        </div>
        {cloud ? <p className="muted small mt">Die E-Mail-Adresse ändern wir auf Wunsch für Sie – schreiben Sie an <a className="link" href="mailto:hallo@vysn.de">hallo@vysn.de</a>.</p> : null}
      </section>

      {cloud ? (
        <section className="card" id="passwort">
          <div className="card-head"><div><h2><KeyRound size={18} /> {mustSet ? 'Neues Passwort vergeben' : 'Passwort ändern'}</h2>
            {mustSet ? <p>Sie haben sich über den Link aus „Passwort vergessen“ angemeldet. Bitte legen Sie jetzt ein neues Passwort fest.</p> : null}</div></div>
          {done ? <div className="notice notice-ok" role="status"><Check size={16} /><span>Ihr Passwort wurde geändert.</span></div> : null}
          <form className="form-grid" onSubmit={save}>
            <Field label="Neues Passwort"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={mustSet} /></Field>
            <Field label="Wiederholen"><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
            <div className="field field-end"><button className="btn btn-primary" disabled={busy || !pw}>{busy ? 'Speichert …' : 'Passwort speichern'}</button></div>
          </form>
          {error ? <p className="field-error">{error}</p> : null}
        </section>
      ) : null}

      <section className="card">
        <div className="card-head"><div><h2><Building2 size={18} /> Ihre Firmen</h2><p>Wechseln Sie die Firma oben rechts.</p></div></div>
        <div className="kv-list">
          {companies.map((c) => (
            <div key={c.id}><span>{c.name}{c.id === activeCompanyId ? ' (geöffnet)' : ''}</span><strong>{ROLE_LABEL[c.role as keyof typeof ROLE_LABEL] ?? c.role}</strong></div>
          ))}
        </div>
      </section>

      <section className="card card-plain">
        <div className="secondary-actions">
          <a className="btn" href="mailto:hallo@vysn.de?subject=Support%20VYSN%20One"><LifeBuoy size={16} /> Support kontaktieren</a>
          <Link className="btn btn-quiet" href="/datenschutz">Datenschutz</Link>
          <LogoutButton className="btn btn-quiet" />
        </div>
      </section>
    </div>
  );
}
