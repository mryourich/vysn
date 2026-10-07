'use client';

import { useState } from 'react';

/** Widerrufsfunktion ohne Anmeldung (zweistufig: Formular → Bestätigen), Eingangsbestätigung per E-Mail. */
export function WithdrawalForm() {
  const [form, setForm] = useState({ name: '', email: '', company: '', contract: '', website: '' });
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/withdraw-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Senden fehlgeschlagen.');
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
      setStep('form');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return <div className="withdraw-box ok" role="status"><strong>Ihr Widerruf ist eingegangen.</strong> Eine Bestätigung haben wir an {form.email} gesendet. Wir beenden das Abo und erstatten bereits bezahlte Beträge vollständig.</div>;
  }
  return (
    <div className="withdraw-box">
      <h2 style={{ marginTop: 0 }}>Widerrufsfunktion</h2>
      {step === 'form' ? (
        <form onSubmit={(e) => { e.preventDefault(); if (valid) setStep('confirm'); }}>
          <label>Name *<input value={form.name} onChange={set('name')} autoComplete="name" required /></label>
          <label>E-Mail-Adresse Ihres Kontos *<input type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></label>
          <label>Firma in VYSNER One<input value={form.company} onChange={set('company')} /></label>
          <label>Tarif / Bestelldatum (optional)<input value={form.contract} onChange={set('contract')} placeholder="z. B. Business jährlich, gebucht am 01.10.2026" /></label>
          <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} aria-hidden="true" />
          {error ? <p className="withdraw-error">{error}</p> : null}
          <button className="btn btn-primary" disabled={!valid}>Vertrag widerrufen</button>
        </form>
      ) : (
        <div>
          <p>Hiermit widerrufe ich den Vertrag über VYSNER One{form.company ? ` für die Firma „${form.company}“` : ''}.<br />Name: {form.name} · E-Mail: {form.email}</p>
          <div className="withdraw-actions">
            <button className="btn" onClick={() => setStep('form')} disabled={busy}>Zurück</button>
            <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Wird gesendet …' : 'Widerruf bestätigen'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
