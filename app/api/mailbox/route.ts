import { NextResponse } from 'next/server';
import { deleteMailAccount, getMailAccount, mailboxConfigured, saveMailAccount, testMailAccount } from '../../../lib/server/mailbox';
import type { MailAccount } from '../../../lib/server/mailbox';
import { memberRole, userFromRequest } from '../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EMAIL = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+$/;
const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Zugriff prüfen: Mitglied der Firma; Ändern nur Inhaber/Admin. */
async function access(req: Request, companyId: string, manage: boolean) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });
  const role = companyId ? await memberRole(companyId, user.id) : null;
  if (!role) return NextResponse.json({ error: 'Kein Zugriff auf diese Firma.' }, { status: 403 });
  if (manage && role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Nur Inhaber und Admins können das Postfach verbinden.' }, { status: 403 });
  return null;
}

/** Verbundenes Postfach (ohne Passwort) */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId') || '';
  if (!mailboxConfigured()) return NextResponse.json({ available: false, account: null });
  const denied = await access(req, companyId, false);
  if (denied) return denied;
  const a = await getMailAccount(companyId).catch(() => null);
  return NextResponse.json({
    available: true,
    account: a ? { email: a.email, displayName: a.displayName, username: a.username, imapHost: a.imapHost, imapPort: a.imapPort, imapSecure: a.imapSecure, smtpHost: a.smtpHost, smtpPort: a.smtpPort, smtpSecure: a.smtpSecure } : null,
  });
}

/** Postfach verbinden: Zugang testen, dann verschlüsselt speichern */
export async function PUT(req: Request) {
  if (!mailboxConfigured()) return NextResponse.json({ error: 'Die Postfach-Anbindung ist auf dem Server noch nicht eingerichtet (MAILBOX_SECRET fehlt).' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const denied = await access(req, companyId, true);
  if (denied) return denied;
  const port = (v: unknown, d: number) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 65536 ? n : d; };
  const prev = await getMailAccount(companyId).catch(() => null);
  const a: MailAccount = {
    email: String(body.email || '').trim(),
    displayName: String(body.displayName || '').trim().slice(0, 80).replace(/["<>\r\n]/g, ''),
    username: String(body.username || body.email || '').trim(),
    // leer lassen = bisheriges Passwort behalten
    password: String(body.password || '') || prev?.password || '',
    imapHost: String(body.imapHost || '').trim(), imapPort: port(body.imapPort, 993), imapSecure: body.imapSecure !== false,
    smtpHost: String(body.smtpHost || '').trim(), smtpPort: port(body.smtpPort, 465), smtpSecure: body.smtpSecure !== false,
  };
  if (!EMAIL.test(a.email) || !a.username || !a.password || !HOST.test(a.imapHost) || !HOST.test(a.smtpHost)) {
    return NextResponse.json({ error: 'Bitte E-Mail-Adresse, Passwort sowie IMAP- und SMTP-Server angeben.' }, { status: 400 });
  }
  try {
    await testMailAccount(a);
  } catch (e) {
    return NextResponse.json({ error: `Anmeldung am Postfach fehlgeschlagen: ${(e as Error).message}. Bitte Server, Port und Passwort prüfen.` }, { status: 400 });
  }
  await saveMailAccount(companyId, a);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId') || '';
  const denied = await access(req, companyId, true);
  if (denied) return denied;
  await deleteMailAccount(companyId);
  return NextResponse.json({ ok: true });
}
