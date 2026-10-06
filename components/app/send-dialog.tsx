'use client';

import { useEffect, useState } from 'react';
import { Mail, Paperclip, Send, Share2 } from 'lucide-react';
import { fillMail, mailStatus, sendMail } from '../../lib/mail';
import type { MailStatus } from '../../lib/mail';
import { useStore } from '../../lib/store';
import type { SalesDoc } from '../../lib/types';
import { DocumentTemplate } from '../pdf/document-template';
import { downloadBlob, renderPdf, safeFileName } from '../pdf/export';
import { Field, Modal } from './ui';

export const docFileName = (doc: SalesDoc) => safeFileName(`${doc.number}${doc.recipient.name ? ' ' + doc.recipient.name : ''}.pdf`);

/** Rechnung festschreiben (falls Entwurf), PDF erzeugen und senden. Gemeinsam für Dialog und automatischen Versand. */
export function useSendDocument() {
  const { data, setDocStatus, markSent, design, activeCompanyId } = useStore();
  return async (doc: SalesDoc, mail: { to: string; cc?: string; subject: string; text: string }) => {
    const company = data.company!;
    if (doc.kind === 'invoice' && doc.status === 'draft') setDocStatus(doc.id, 'sent');
    const customer = data.customers.find((c) => c.id === doc.customerId);
    const pdf = await renderPdf(<DocumentTemplate company={company} doc={doc} design={design} customerNumber={customer?.number} />);
    await sendMail({ ...mail, bcc: data.settings.email.bcc, fromName: company.name, replyTo: company.email, pdf, fileName: docFileName(doc), companyId: activeCompanyId });
    markSent(doc.id, mail.to);
  };
}

export function SendDialog({ doc, onClose, onSent }: { doc: SalesDoc; onClose: () => void; onSent?: (to: string) => void }) {
  const { data, setDocStatus, markSent, design } = useStore();
  const company = data.company!;
  const tpl = data.settings.email;
  const isInvoice = doc.kind === 'invoice';
  const customer = data.customers.find((c) => c.id === doc.customerId);
  const [to, setTo] = useState(customer?.email || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(fillMail(isInvoice ? tpl.invoiceSubject : tpl.offerSubject, doc, company));
  const [text, setText] = useState(fillMail(isInvoice ? tpl.invoiceBody : tpl.offerBody, doc, company));
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = useSendDocument();
  useEffect(() => { mailStatus().then(setStatus); }, []);
  const validTo = /\S+@\S+\.\S+/.test(to);

  const viaServer = async () => {
    setBusy(true);
    setError('');
    try {
      await send(doc, { to, cc, subject, text });
      onSent?.(to);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Ohne Mailserver: PDF teilen (Handy) bzw. herunterladen + E-Mail-Programm öffnen */
  const viaDevice = async () => {
    setBusy(true);
    try {
      if (isInvoice && doc.status === 'draft') setDocStatus(doc.id, 'sent');
      const pdf = await renderPdf(<DocumentTemplate company={company} doc={doc} design={design} customerNumber={customer?.number} />);
      const file = new File([pdf], docFileName(doc), { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: subject, text });
      } else {
        downloadBlob(pdf, docFileName(doc));
        window.location.href = `mailto:${encodeURIComponent(to)}?${new URLSearchParams({ ...(cc ? { cc } : {}), subject, body: `${text}\n\n(PDF bitte aus dem Download-Ordner anhängen: ${docFileName(doc)})` }).toString().replace(/\+/g, '%20')}`;
      }
      markSent(doc.id, `${to} (manuell)`);
      onClose();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${isInvoice ? 'Rechnung' : 'Angebot'} ${doc.number} senden`} onClose={onClose} wide
      footer={<>
        <button className="btn btn-quiet mr-auto" onClick={onClose}>Abbrechen</button>
        <button className="btn" onClick={viaDevice} disabled={busy}><Share2 size={16} /> Über Gerät teilen</button>
        {status?.enabled ? <button className="btn btn-primary" onClick={viaServer} disabled={busy || !validTo}><Send size={16} /> {busy ? 'Sende …' : 'Jetzt senden'}</button> : null}
      </>}>
      {isInvoice && doc.status === 'draft' ? <div className="notice"><Mail size={16} /><span>Die Rechnung wird beim Versand festgeschrieben und ist danach nicht mehr änderbar.</span></div> : null}
      {status && !status.enabled ? (
        <div className="notice notice-warn"><Mail size={16} /><span>{status.smtp ? 'Direkter Versand ist nur mit Anmeldung (Supabase) möglich.' : 'Für den direkten Versand ist noch kein Mailserver eingerichtet (siehe „E-Mail & Versand“).'} Sie können das PDF stattdessen über Ihr Gerät teilen bzw. mit Ihrem E-Mail-Programm senden.</span></div>
      ) : null}
      <div className="form-grid">
        <Field label="An *" span={2}><input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@beispiel.de" autoFocus={!to} /></Field>
        <Field label="CC"><input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" /></Field>
        <Field label="Betreff" span={3}><input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Nachricht" span={3}><textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </div>
      <p className="attach-line"><Paperclip size={15} /> {docFileName(doc)}{tpl.bcc ? <span className="muted"> · Kopie an {tpl.bcc}</span> : null}</p>
      {error ? <p className="field-error">{error}</p> : null}
    </Modal>
  );
}
