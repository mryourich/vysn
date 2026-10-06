import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailFrom, smtpConfigured, smtpTransport } from '../../../lib/server/smtp';

/**
 * Versendet Angebote/Rechnungen per E-Mail über einen SMTP-Server.
 *
 * Konfiguration (Umgebungsvariablen beim Hosting):
 *   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_SECURE ("true" bei Port 465)
 *   MAIL_FROM  z. B. "VYSN One <rechnung@ihre-domain.de>"
 *
 * Schutz vor Missbrauch: Nur angemeldete Nutzer (Supabase-Token) dürfen senden.
 * Ohne Supabase ist der Versand gesperrt, außer MAIL_ALLOW_ANONYMOUS=true (nur zum Testen!).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTACHMENT = 5 * 1024 * 1024;
const EMAIL = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+$/;
const sent = new Map<string, number[]>();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function authenticate(req: Request): Promise<string | null> {
  if (supabaseUrl && supabaseKey) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  }
  return process.env.MAIL_ALLOW_ANONYMOUS === 'true' ? 'anonymous' : null;
}

function rateLimited(user: string) {
  const now = Date.now();
  const recent = (sent.get(user) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 60) return true;
  recent.push(now);
  sent.set(user, recent);
  return false;
}

const list = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/[,;]/) : []).map((x) => String(x).trim()).filter(Boolean);

export async function GET() {
  return NextResponse.json({
    enabled: smtpConfigured() && (Boolean(supabaseUrl && supabaseKey) || process.env.MAIL_ALLOW_ANONYMOUS === 'true'),
    smtp: smtpConfigured(),
    requiresLogin: Boolean(supabaseUrl && supabaseKey),
  });
}

export async function POST(req: Request) {
  if (!smtpConfigured()) return NextResponse.json({ error: 'E-Mail-Versand ist nicht eingerichtet (SMTP fehlt).' }, { status: 503 });
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an, um E-Mails zu versenden.' }, { status: 401 });
  if (rateLimited(user)) return NextResponse.json({ error: 'Zu viele E-Mails in kurzer Zeit. Bitte später erneut versuchen.' }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const to = list(body.to);
  const cc = list(body.cc);
  const bcc = list(body.bcc);
  const recipients = [...to, ...cc, ...bcc];
  if (!to.length || recipients.length > 10 || recipients.some((r) => !EMAIL.test(r))) {
    return NextResponse.json({ error: 'Bitte gültige Empfänger-Adressen angeben (max. 10).' }, { status: 400 });
  }
  const subject = String(body.subject || '').slice(0, 200).replace(/[\r\n]+/g, ' ');
  const text = String(body.text || '').slice(0, 20_000);
  const fromName = String(body.fromName || '').slice(0, 80).replace(/["<>\r\n]/g, '');
  const replyTo = typeof body.replyTo === 'string' && EMAIL.test(body.replyTo) ? body.replyTo : undefined;
  const att = body.attachment as { filename?: string; contentBase64?: string } | undefined;
  let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  if (att?.contentBase64) {
    const content = Buffer.from(att.contentBase64, 'base64');
    if (content.length > MAX_ATTACHMENT || content.subarray(0, 4).toString() !== '%PDF') {
      return NextResponse.json({ error: 'Anhang muss eine PDF-Datei bis 5 MB sein.' }, { status: 400 });
    }
    attachments = [{ filename: String(att.filename || 'Dokument.pdf').replace(/[^\w\-. äöüÄÖÜß]/g, '_').slice(0, 120), content, contentType: 'application/pdf' }];
  }

  const transport = smtpTransport();
  try {
    const info = await transport.sendMail({
      from: mailFrom(fromName),
      to, cc, bcc, replyTo, subject, text, attachments,
    });
    return NextResponse.json({ ok: true, id: info.messageId });
  } catch (e) {
    console.error('send mail failed', e);
    return NextResponse.json({ error: 'Die E-Mail konnte nicht versendet werden. Bitte SMTP-Einstellungen prüfen.' }, { status: 502 });
  }
}
