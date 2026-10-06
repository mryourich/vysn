import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { userFromRequest } from '../../../../lib/server/supabase-admin';
import { mailFrom, smtpConfigured, smtpTransport } from '../../../../lib/server/smtp';
import { siteOrigin } from '../../../../lib/server/billing';

/**
 * Verschickt den Einladungslink per E-Mail. Die Einladung wird mit dem Token des
 * angemeldeten Nutzers gelesen – Row Level Security lässt das nur Inhabern und Admins zu.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Mitarbeiter' };

export async function POST(req: Request) {
  if (!smtpConfigured()) return NextResponse.json({ error: 'E-Mail-Versand ist nicht eingerichtet (SMTP fehlt).' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });

  const { token } = await req.json().catch(() => ({ token: '' }));
  if (typeof token !== 'string' || !/^[0-9a-f]{32,128}$/.test(token)) return NextResponse.json({ error: 'Ungültige Einladung.' }, { status: 400 });

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: invite } = await sb.from('company_invites').select('email, role, expires_at, accepted_at, companies(name)').eq('token', token).maybeSingle();
  if (!invite || invite.accepted_at) return NextResponse.json({ error: 'Einladung nicht gefunden.' }, { status: 404 });

  const company = (invite.companies as unknown as { name: string } | null)?.name || 'Ihre Firma';
  const link = `${siteOrigin(req)}/app/einladung?token=${token}`;
  const until = new Date(invite.expires_at as string).toLocaleDateString('de-DE');
  const text = [
    'Guten Tag,',
    '',
    `${user.email} lädt Sie ein, bei „${company}“ in VYSN One mitzuarbeiten (Rolle: ${ROLE_LABEL[invite.role as string] || invite.role}).`,
    '',
    'Einladung annehmen:',
    link,
    '',
    `Melden Sie sich dazu mit dieser E-Mail-Adresse (${invite.email}) an oder registrieren Sie sich kostenlos. Der Link ist bis zum ${until} gültig.`,
    '',
    'Viele Grüße',
    'VYSN One',
  ].join('\n');

  try {
    await smtpTransport().sendMail({
      from: mailFrom(`${company.replace(/["<>\r\n]/g, '').slice(0, 60)} über VYSN One`),
      to: invite.email as string,
      replyTo: user.email || undefined,
      subject: `Einladung zu ${company} – VYSN One`.replace(/[\r\n]+/g, ' '),
      text,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('invite mail failed', e);
    return NextResponse.json({ error: 'Die E-Mail konnte nicht versendet werden. Bitte SMTP-Einstellungen prüfen.' }, { status: 502 });
  }
}
