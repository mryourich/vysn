'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { mailStatus } from '../../../lib/mail';
import type { MailStatus } from '../../../lib/mail';
import { useStore } from '../../../lib/store';
import type { EmailSettings } from '../../../lib/types';
import { Field, PageHeader } from '../../../components/app/ui';

export default function MailSettingsPage() {
  const { data, saveSettings } = useStore();
  const e = data.settings.email;
  const set = (patch: Partial<EmailSettings>) => saveSettings({ ...data.settings, email: { ...e, ...patch } });
  const [status, setStatus] = useState<MailStatus | null>(null);
  useEffect(() => { mailStatus().then(setStatus); }, []);

  return (
    <div className="page">
      <PageHeader title="E-Mail & Versand" description="Vorlagen und automatischer Versand von Angeboten und Rechnungen als PDF-Anhang." />

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
        <div className="card-head"><div><h2>Vorlagen</h2><p>Platzhalter: {'{nummer} {betrag} {faellig} {gueltig} {kunde} {firma} {datum}'}</p></div></div>
        <div className="form-grid">
          <Field label="Rechnung – Betreff" span={3}><input value={e.invoiceSubject} onChange={(ev) => set({ invoiceSubject: ev.target.value })} /></Field>
          <Field label="Rechnung – Nachricht" span={3}><textarea rows={6} value={e.invoiceBody} onChange={(ev) => set({ invoiceBody: ev.target.value })} /></Field>
          <Field label="Angebot – Betreff" span={3}><input value={e.offerSubject} onChange={(ev) => set({ offerSubject: ev.target.value })} /></Field>
          <Field label="Angebot – Nachricht" span={3}><textarea rows={6} value={e.offerBody} onChange={(ev) => set({ offerBody: ev.target.value })} /></Field>
        </div>
      </section>

      <div className="datev-note"><Info size={16} /><p>Gesendete Belege werden mit Datum und Empfänger protokolliert. Angebote gelten nach dem Versand als „Versendet“, Rechnungen werden vor dem Versand festgeschrieben.</p></div>
    </div>
  );
}
