'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Inbox, Info, Loader2, Unplug } from 'lucide-react';
import { getSupabase, supabaseConfigured } from '../../lib/db/supabase';
import { useStore } from '../../lib/store';
import { Field } from './ui';

type Account = { email: string; displayName: string; username: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number };

/** Bekannte Anbieter: Server werden aus der E-Mail-Adresse vorgeschlagen */
const PROVIDERS: [RegExp, Partial<Account>, string?][] = [
  [/@(gmail|googlemail)\.com$/i, { imapHost: 'imap.gmail.com', smtpHost: 'smtp.gmail.com' }, 'Bei Gmail brauchen Sie ein App-Passwort (Google-Konto → Sicherheit → App-Passwörter).'],
  [/@(gmx)\.(de|at|ch|net)$/i, { imapHost: 'imap.gmx.net', smtpHost: 'mail.gmx.net' }, 'Bei GMX muss „POP3/IMAP-Abruf“ in den Einstellungen aktiviert sein.'],
  [/@web\.de$/i, { imapHost: 'imap.web.de', smtpHost: 'smtp.web.de' }, 'Bei WEB.DE muss „POP3/IMAP-Abruf“ in den Einstellungen aktiviert sein.'],
  [/@(t-online)\.de$/i, { imapHost: 'secureimap.t-online.de', smtpHost: 'securesmtp.t-online.de' }, 'Bei T-Online brauchen Sie das E-Mail-Passwort (nicht das Kundencenter-Passwort).'],
  [/@(icloud|me|mac)\.com$/i, { imapHost: 'imap.mail.me.com', smtpHost: 'smtp.mail.me.com', smtpPort: 587 }, 'Bei iCloud brauchen Sie ein app-spezifisches Passwort (appleid.apple.com).'],
];

const empty: Account = { email: '', displayName: '', username: '', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465 };

async function call(method: string, body?: unknown, query = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch(`/api/mailbox${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Anfrage fehlgeschlagen.');
  return json;
}

export function MailboxSettings() {
  const { activeCompanyId, data, can, role } = useStore();
  const [state, setState] = useState<{ available: boolean; account: Account | null } | null>(null);
  const [form, setForm] = useState<Account>(empty);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const manage = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (!activeCompanyId || !supabaseConfigured) { setState({ available: false, account: null }); return; }
    call('GET', undefined, `?companyId=${activeCompanyId}`).then(setState).catch(() => setState({ available: false, account: null }));
  }, [activeCompanyId]);

  const set = (patch: Partial<Account>) => setForm((f) => ({ ...f, ...patch }));
  const provider = PROVIDERS.find(([re]) => re.test(form.email));
  const onEmail = (email: string) => {
    const p = PROVIDERS.find(([re]) => re.test(email));
    set({ email, username: email, ...(p ? { imapPort: 993, smtpPort: 465, ...p[1] } : {}) });
  };
  const guess = () => {
    const domain = form.email.split('@')[1];
    if (domain && !form.imapHost && !form.smtpHost) set({ imapHost: `imap.${domain}`, smtpHost: `smtp.${domain}` });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await call('PUT', { companyId: activeCompanyId, ...form, password, imapSecure: form.imapPort === 993, smtpSecure: form.smtpPort === 465 });
      setState({ available: true, account: { ...form } });
      setPassword('');
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!window.confirm('Postfach trennen? Der Assistent kann den Posteingang dann nicht mehr lesen, E-Mails gehen wieder über den VYSNER-Server.')) return;
    await call('DELETE', undefined, `?companyId=${activeCompanyId}`).catch((e) => setError((e as Error).message));
    setState((s) => (s ? { ...s, account: null } : s));
  };

  if (!state) return <section className="card"><p className="muted"><Loader2 size={15} className="spin" /> Lade Postfach …</p></section>;
  if (!can('ai') && !can('email')) {
    return <section className="card"><div className="card-head"><div><h2>E-Mail-Postfach</h2><p>Mit dem Assistenten oder ab dem Tarif Business verbinden Sie hier Ihr Firmenpostfach.</p></div></div></section>;
  }
  if (!state.available) {
    return <section className="card"><div className="card-head"><div><h2>E-Mail-Postfach</h2></div></div>
      <div className="status-row"><Info size={18} /><span>Die Postfach-Anbindung ist auf dem Server noch nicht eingerichtet (MAILBOX_SECRET fehlt).</span></div></section>;
  }

  const account = state.account;
  return (
    <section className="card">
      <div className="card-head"><div><h2>E-Mail-Postfach</h2><p>Verbinden Sie das Postfach Ihrer Firma: Der Assistent liest Anfragen im Posteingang, und alle E-Mails gehen direkt von Ihrer Adresse raus – mit Kopie im Ordner „Gesendet“.</p></div></div>
      {account && !editing ? (
        <>
          <div className="status-row ok"><CheckCircle2 size={18} /><span><strong>Verbunden mit {account.email}</strong><br />IMAP {account.imapHost} · SMTP {account.smtpHost}</span></div>
          {manage ? <div className="secondary-actions mt">
            <button className="btn" onClick={() => { setForm({ ...empty, ...account }); setEditing(true); }}>Zugangsdaten ändern</button>
            <button className="btn" onClick={disconnect}><Unplug size={16} /> Trennen</button>
          </div> : null}
        </>
      ) : !manage ? (
        <div className="status-row"><Inbox size={18} /><span>Noch kein Postfach verbunden. Das kann der Inhaber oder ein Admin hier einrichten.</span></div>
      ) : (
        <>
          <div className="form-grid">
            <Field label="E-Mail-Adresse" span={2}><input type="email" value={form.email} onChange={(e) => onEmail(e.target.value)} onBlur={guess} placeholder={data.company?.email || 'info@ihre-firma.at'} autoComplete="off" /></Field>
            <Field label="Absendername"><input value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} placeholder={data.company?.name} /></Field>
            <Field label="Benutzername"><input value={form.username} onChange={(e) => set({ username: e.target.value })} placeholder="meist die E-Mail-Adresse" autoComplete="off" /></Field>
            <Field label="Passwort" span={2} hint={account ? 'Leer lassen, um das bisherige zu behalten' : undefined}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="IMAP-Server (Posteingang)" span={2}><input value={form.imapHost} onChange={(e) => set({ imapHost: e.target.value.trim() })} placeholder="imap.ihre-domain.at" /></Field>
            <Field label="Port"><input type="number" value={form.imapPort} onChange={(e) => set({ imapPort: Number(e.target.value) })} /></Field>
            <Field label="SMTP-Server (Versand)" span={2}><input value={form.smtpHost} onChange={(e) => set({ smtpHost: e.target.value.trim() })} placeholder="smtp.ihre-domain.at" /></Field>
            <Field label="Port" hint="465 (SSL) oder 587 (STARTTLS)"><input type="number" value={form.smtpPort} onChange={(e) => set({ smtpPort: Number(e.target.value) })} /></Field>
          </div>
          {provider?.[2] ? <p className="muted small mt"><Info size={13} className="inline-icon" /> {provider[2]}</p> : null}
          {error ? <p className="field-error mt">{error}</p> : null}
          <div className="secondary-actions mt">
            <button className="btn btn-primary" onClick={save} disabled={busy || !form.email || (!password && !account) || !form.imapHost || !form.smtpHost}>
              {busy ? <><Loader2 size={16} className="spin" /> Verbindung wird geprüft …</> : 'Prüfen und verbinden'}
            </button>
            {editing ? <button className="btn" onClick={() => setEditing(false)}>Abbrechen</button> : null}
          </div>
          <p className="muted small mt">Das Passwort wird verschlüsselt gespeichert und nur für den Abruf und Versand verwendet. Niemand im Team kann es wieder auslesen.</p>
        </>
      )}
    </section>
  );
}
