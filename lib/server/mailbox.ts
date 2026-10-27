import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { adminDb } from './supabase-admin';

/**
 * E-Mail-Postfach einer Firma (IMAP zum Lesen, SMTP zum Senden).
 * Das Passwort wird mit MAILBOX_SECRET (AES-256-GCM) verschlüsselt gespeichert; die Tabelle
 * mail_accounts ist für Nutzer gesperrt und nur über den Server erreichbar.
 */
export const mailboxConfigured = () => (process.env.MAILBOX_SECRET || '').length >= 16;

const key = () => createHash('sha256').update(process.env.MAILBOX_SECRET || '').digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(stored: string) {
  const [v, iv, tag, data] = stored.split(':');
  if (v !== 'v1') throw new Error('Unbekanntes Format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export type MailAccount = {
  email: string; displayName: string; username: string; password: string;
  imapHost: string; imapPort: number; imapSecure: boolean;
  smtpHost: string; smtpPort: number; smtpSecure: boolean;
};

/** Öffentliche Angaben (ohne Passwort) für die Einstellungen */
export type MailAccountInfo = Omit<MailAccount, 'password'>;

export async function getMailAccount(companyId: string): Promise<MailAccount | null> {
  if (!mailboxConfigured()) return null;
  const { data } = await adminDb().from('mail_accounts').select('*').eq('company_id', companyId).maybeSingle();
  if (!data) return null;
  return {
    email: data.email, displayName: data.display_name || '', username: data.username, password: decryptSecret(data.secret),
    imapHost: data.imap_host, imapPort: Number(data.imap_port), imapSecure: !!data.imap_secure,
    smtpHost: data.smtp_host, smtpPort: Number(data.smtp_port), smtpSecure: !!data.smtp_secure,
  };
}

export async function saveMailAccount(companyId: string, a: MailAccount) {
  const { error } = await adminDb().from('mail_accounts').upsert({
    company_id: companyId, email: a.email, display_name: a.displayName, username: a.username, secret: encryptSecret(a.password),
    imap_host: a.imapHost, imap_port: a.imapPort, imap_secure: a.imapSecure,
    smtp_host: a.smtpHost, smtp_port: a.smtpPort, smtp_secure: a.smtpSecure, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteMailAccount(companyId: string) {
  const { error } = await adminDb().from('mail_accounts').delete().eq('company_id', companyId);
  if (error) throw new Error(error.message);
}

const imapClient = (a: MailAccount) => new ImapFlow({
  host: a.imapHost, port: a.imapPort, secure: a.imapSecure,
  auth: { user: a.username, pass: a.password },
  logger: false, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
});

async function withImap<T>(a: MailAccount, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = imapClient(a);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export const smtpTransportFor = (a: MailAccount) => nodemailer.createTransport({
  host: a.smtpHost, port: a.smtpPort, secure: a.smtpSecure,
  auth: { user: a.username, pass: a.password },
  connectionTimeout: 15_000,
});

const IMAP_PORTS = new Set([993, 143]);
const SMTP_PORTS = new Set([465, 587, 25, 2525]);

function privateAddress(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateAddress(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Nur öffentliche Mailserver auf üblichen Ports – kein Zugriff auf interne Dienste des Servers */
async function assertMailServer(host: string, port: number, ports: Set<number>, label: string) {
  if (process.env.MAILBOX_ALLOW_PRIVATE === 'true') return;
  if (!ports.has(port)) throw new Error(`${label}-Port ${port} ist nicht erlaubt (${[...ports].join(', ')})`);
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`${label}-Server ${host} nicht gefunden`);
  if (addrs.some((x) => privateAddress(x.address))) throw new Error(`${label}-Server ${host} ist nicht öffentlich erreichbar`);
}

/** Zugang prüfen: IMAP anmelden und SMTP-Verbindung testen. */
export async function testMailAccount(a: MailAccount) {
  await assertMailServer(a.imapHost, a.imapPort, IMAP_PORTS, 'IMAP');
  await assertMailServer(a.smtpHost, a.smtpPort, SMTP_PORTS, 'SMTP');
  await withImap(a, async (c) => { await c.mailboxOpen('INBOX', { readOnly: true }); });
  await smtpTransportFor(a).verify();
}

export type InboxEntry = { uid: number; from: string; subject: string; date: string; unread: boolean };

/** Neueste E-Mails im Posteingang (nur Kopfzeilen). */
export async function listInbox(a: MailAccount, opts: { days: number; unreadOnly: boolean; limit: number }): Promise<InboxEntry[]> {
  return withImap(a, async (c) => {
    await c.mailboxOpen('INBOX', { readOnly: true });
    const since = new Date(Date.now() - opts.days * 86400000);
    const uids = await c.search(opts.unreadOnly ? { since, seen: false } : { since }, { uid: true });
    if (!uids || !uids.length) return [];
    const pick = uids.slice(-opts.limit);
    const rows = await c.fetchAll(pick, { uid: true, envelope: true, flags: true }, { uid: true });
    return rows.map((m) => ({
      uid: m.uid,
      from: (m.envelope?.from || []).map((f) => (f.name ? `${f.name} <${f.address}>` : f.address || '')).join(', '),
      subject: m.envelope?.subject || '(ohne Betreff)',
      date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : '',
      unread: !m.flags?.has('\\Seen'),
    })).reverse();
  });
}

export type MailContent = { uid: number; from: string; replyTo: string; to: string; subject: string; date: string; messageId: string; text: string; attachments: string[] };

/** Eine E-Mail lesen (Text, ohne als gelesen zu markieren). */
export async function readMail(a: MailAccount, uid: number, maxChars = 8000): Promise<MailContent | null> {
  return withImap(a, async (c) => {
    await c.mailboxOpen('INBOX', { readOnly: true });
    const msg = await c.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
    if (!msg || !msg.source) return null;
    const parsed = await simpleParser(msg.source);
    const addr = (v: typeof parsed.to) => (v ? (Array.isArray(v) ? v.map((x) => x.text).join(', ') : v.text) : '');
    const text = (parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]+>/g, ' ') : '')).replace(/\n{3,}/g, '\n\n').trim();
    return {
      uid, from: addr(parsed.from), replyTo: addr(parsed.replyTo) || addr(parsed.from), to: addr(parsed.to), subject: parsed.subject || '',
      date: parsed.date?.toISOString() || '', messageId: parsed.messageId || '',
      text: text.length > maxChars ? `${text.slice(0, maxChars)}\n[… gekürzt]` : text,
      attachments: parsed.attachments.map((x) => x.filename || 'Anhang'),
    };
  });
}

/** Gesendete E-Mail zusätzlich im Ordner „Gesendet“ ablegen (best effort). */
export async function storeSent(a: MailAccount, raw: Buffer) {
  try {
    await withImap(a, async (c) => {
      const boxes = await c.list();
      const sent = boxes.find((b) => b.specialUse === '\\Sent') || boxes.find((b) => /^(sent|gesendet|gesendete)/i.test(b.name));
      if (sent) await c.append(sent.path, raw, ['\\Seen']);
    });
  } catch (e) {
    console.error('storeSent', (e as Error).message);
  }
}
