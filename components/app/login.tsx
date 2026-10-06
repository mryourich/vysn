'use client';

import { useState } from 'react';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useStore } from '../../lib/store';
import { Brand } from './brand';
import { Field } from './ui';

type Mode = 'signin' | 'signup' | 'reset';

const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-Mail oder Passwort ist falsch.',
  'Email not confirmed': 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
  'User already registered': 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
};

/** `invite`: Anmeldung von der Einladungsseite – E-Mail vorbelegt, Text zur Einladung. */
export function Login({ invite }: { invite?: { companyName: string; email: string } } = {}) {
  const { auth } = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState(invite?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signin') await auth.signIn(email.trim(), password);
      else if (mode === 'signup') {
        const { needsConfirmation } = await auth.signUp(email.trim(), password);
        if (needsConfirmation) setInfo('Fast geschafft: Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen gerade geschickt haben.');
      } else {
        await auth.resetPassword(email.trim());
        setInfo('Falls ein Konto existiert, erhalten Sie in Kürze eine E-Mail zum Zurücksetzen des Passworts.');
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(MESSAGES[msg] || msg || 'Das hat nicht geklappt. Bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, [string, string, string]> = {
    signin: ['Anmelden', 'Willkommen zurück. Melden Sie sich mit Ihrem Konto an.', 'Anmelden'],
    signup: ['Konto erstellen', 'Kostenlos starten – danach richten Sie Ihr Unternehmen ein.', 'Konto erstellen'],
    reset: ['Passwort vergessen', 'Wir senden Ihnen einen Link zum Zurücksetzen.', 'Link senden'],
  };
  if (invite) {
    titles.signin = [`Einladung zu ${invite.companyName}`, `Melden Sie sich mit ${invite.email} an, um die Einladung anzunehmen. Noch kein Konto? Registrieren Sie sich kostenlos.`, 'Anmelden'];
    titles.signup = [`Einladung zu ${invite.companyName}`, `Erstellen Sie ein kostenloses Konto mit ${invite.email} – danach sind Sie direkt im Team.`, 'Konto erstellen'];
  }
  const [title, text, cta] = titles[mode];

  return (
    <div className="onboarding">
      <aside className="onboarding-side">
        <Brand />
        <div>
          <h1>Angebote, Rechnungen und Zahlen an einem Ort.</h1>
          <p>Ihre Daten liegen sicher in der Cloud und sind auf allen Geräten verfügbar – im Büro, unterwegs und für Ihr Team.</p>
        </div>
        <span />
      </aside>
      <main className="onboarding-main">
        <div className="onboarding-card login-card">
          <h2>{title}</h2>
          <p className="muted">{text}</p>
          {info ? (
            <div className="notice"><MailCheck size={16} /><span>{info}</span></div>
          ) : (
            <form className="form-stack login-form" onSubmit={submit}>
              <Field label="E-Mail-Adresse"><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
              {mode !== 'reset' ? (
                <Field label="Passwort" hint={mode === 'signup' ? 'Mindestens 8 Zeichen' : undefined}>
                  <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              ) : null}
              {error ? <p className="field-error">{error}</p> : null}
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Bitte warten…' : <>{cta} <ArrowRight size={16} /></>}</button>
            </form>
          )}
          <div className="login-switch">
            {mode === 'signin' ? (
              <>
                <button className="link" onClick={() => setMode('reset')}>Passwort vergessen?</button>
                <span>Noch kein Konto? <button className="link" onClick={() => setMode('signup')}>Kostenlos registrieren</button></span>
              </>
            ) : (
              <span>Bereits registriert? <button className="link" onClick={() => { setMode('signin'); setInfo(''); }}>Anmelden</button></span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
