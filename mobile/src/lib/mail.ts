import { SITE_URL, supabase } from './supabase';

/** E-Mail über den Server senden (/api/send – eigenes Firmenpostfach oder VYSNER-Server). */
export async function sendMail(input: {
  companyId: string; to: string; subject: string; text: string; fromName: string; replyTo?: string; bcc?: string;
  pdfBase64?: string; fileName?: string; inReplyTo?: string;
}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${SITE_URL}/api/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token || ''}`, 'x-vysn-token': data.session?.access_token || '' },
    body: JSON.stringify({
      companyId: input.companyId, to: input.to, bcc: input.bcc, subject: input.subject, text: input.text, fromName: input.fromName,
      replyTo: input.replyTo, inReplyTo: input.inReplyTo || undefined,
      attachment: input.pdfBase64 ? { filename: input.fileName, contentBase64: input.pdfBase64 } : undefined,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Versand fehlgeschlagen.');
}
