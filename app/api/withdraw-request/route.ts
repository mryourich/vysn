import { NextResponse } from 'next/server';
import { mailFrom, smtpConfigured, smtpTransport } from '../../../lib/server/smtp';
import { sendWithdrawalMail } from '../../../lib/server/withdrawal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v: unknown, max = 200) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

/**
 * Öffentliche Widerrufsfunktion (ohne Anmeldung): nimmt die Erklärung entgegen, leitet sie an
 * VYSNER One weiter und bestätigt dem Kunden den Eingang per E-Mail.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.website) return NextResponse.json({ ok: true }); // Spam-Schutz (unsichtbares Feld)
  const email = clean(body.email, 160);
  const name = clean(body.name, 120);
  const company = clean(body.company, 160);
  if (!/\S+@\S+\.\S+/.test(email) || !name) return NextResponse.json({ error: 'Bitte Name und E-Mail-Adresse angeben.' }, { status: 400 });
  if (!smtpConfigured()) return NextResponse.json({ error: 'Der Online-Widerruf ist gerade nicht verfügbar. Bitte senden Sie Ihren Widerruf formlos an hallo@vysn.de.' }, { status: 503 });
  const date = new Date();
  try {
    await smtpTransport().sendMail({
      from: mailFrom('VYSNER One Widerruf'),
      to: process.env.WITHDRAWAL_TO || 'hallo@vysn.de',
      replyTo: email,
      subject: `Widerruf: ${company || name}`,
      text: [
        'Über die Widerrufsfunktion der Webseite ist ein Widerruf eingegangen.', '',
        `Eingang: ${date.toISOString()}`, `Name: ${name}`, `Firma: ${company || '–'}`, `E-Mail (Konto): ${email}`,
        `Vertrag/Abo: ${clean(body.contract, 300) || '–'}`, '',
        'Bitte Abo in Stripe sofort beenden und alle Zahlungen voll erstatten.',
      ].join('\n'),
    });
    await sendWithdrawalMail([email], { company: company || name, name, date, pending: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('withdraw-request', e);
    return NextResponse.json({ error: 'Senden fehlgeschlagen. Bitte senden Sie Ihren Widerruf formlos an hallo@vysn.de.' }, { status: 500 });
  }
}
