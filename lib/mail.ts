'use client';

import { docTotals, formatDate, money } from './calc';
import { getSupabase, supabaseConfigured } from './db/supabase';
import type { Company, SalesDoc } from './types';

export type MailStatus = { enabled: boolean; smtp: boolean; requiresLogin: boolean };

let cached: Promise<MailStatus> | null = null;
/** Ob der Server E-Mails versenden kann (SMTP eingerichtet + Anmeldung). */
export function mailStatus(): Promise<MailStatus> {
  if (!cached) {
    cached = fetch('/api/send', { cache: 'no-store' })
      .then((r) => r.json() as Promise<MailStatus>)
      .catch(() => ({ enabled: false, smtp: false, requiresLogin: false }));
  }
  return cached;
}

export function fillMail(template: string, doc: SalesDoc, company: Company) {
  const gross = docTotals(doc.items, company.smallBusiness).gross;
  return template
    .replace(/\{nummer\}/g, doc.number)
    .replace(/\{datum\}/g, formatDate(doc.date))
    .replace(/\{faellig\}/g, formatDate(doc.dueDate))
    .replace(/\{gueltig\}/g, formatDate(doc.dueDate))
    .replace(/\{kunde\}/g, doc.recipient.name)
    .replace(/\{betrag\}/g, money(gross))
    .replace(/\{firma\}/g, company.name);
}

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('PDF konnte nicht gelesen werden.'));
  r.readAsDataURL(blob);
});

export async function sendMail(input: { to: string; cc?: string; bcc?: string; subject: string; text: string; fromName: string; replyTo?: string; pdf: Blob; fileName: string }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch('/api/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: input.to, cc: input.cc, bcc: input.bcc, subject: input.subject, text: input.text, fromName: input.fromName, replyTo: input.replyTo,
      attachment: { filename: input.fileName, contentBase64: await toBase64(input.pdf) },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Versand fehlgeschlagen.');
}
