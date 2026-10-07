import { NextResponse } from 'next/server';
import { billingConfigured, stripe } from '../../../../lib/server/billing';
import { adminDb, memberRole, userFromRequest } from '../../../../lib/server/supabase-admin';
import { canWithdraw, executeWithdrawal, sendWithdrawalMail, withdrawalDeadline } from '../../../../lib/server/withdrawal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function load(req: Request, companyId: string) {
  if (!billingConfigured()) return { error: NextResponse.json({ error: 'Die Online-Zahlung ist nicht eingerichtet.' }, { status: 503 }) };
  const user = await userFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 }) };
  const role = await memberRole(companyId, user.id);
  if (role !== 'owner' && role !== 'admin') return { error: NextResponse.json({ error: 'Nur Inhaber oder Admins können den Vertrag widerrufen.' }, { status: 403 }) };
  const { data: company } = await adminDb().from('companies').select('name, email, stripe_subscription_id').eq('id', companyId).single();
  const subId = company?.stripe_subscription_id as string | undefined;
  const sub = subId ? await stripe().subscriptions.retrieve(subId) : null;
  return { user, company, sub };
}

/** Kann der Vertrag noch widerrufen werden? (14 Tage ab Vertragsschluss) */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId') || '';
  const r = await load(req, companyId);
  if (r.error) return r.error;
  if (!r.sub) return NextResponse.json({ eligible: false });
  return NextResponse.json({ eligible: canWithdraw(r.sub), until: new Date(withdrawalDeadline(r.sub) * 1000).toISOString() });
}

/** Widerruf ausführen (Schritt 2 des Widerrufsbuttons). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const r = await load(req, companyId);
  if (r.error) return r.error;
  if (!r.sub || !canWithdraw(r.sub)) return NextResponse.json({ error: 'Die Widerrufsfrist von 14 Tagen ist abgelaufen. Sie können das Abo zum Laufzeitende kündigen.' }, { status: 400 });
  try {
    const result = await executeWithdrawal(r.sub);
    const mailed = await sendWithdrawalMail([r.user.email || '', String(r.company?.email || '')], {
      company: String(r.company?.name || ''), name: String(body.name || '').slice(0, 120), date: new Date(), ...result,
    }).catch((e) => { console.error('withdrawal mail', e); return false; });
    return NextResponse.json({ ok: true, ...result, mailed });
  } catch (e) {
    console.error('withdrawal', e);
    return NextResponse.json({ error: 'Der Widerruf konnte nicht verarbeitet werden. Bitte schreiben Sie uns an hallo@vysn.de – Ihr Widerruf gilt mit Eingang Ihrer Nachricht.' }, { status: 500 });
  }
}
