import { NextResponse } from 'next/server';
import { billingConfigured, siteOrigin, stripe } from '../../../../lib/server/billing';
import { adminDb, memberRole, userFromRequest } from '../../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stripe-Kundenportal: Zahlungsmethode, Rechnungen, Tarifwechsel, Kündigung. */
export async function POST(req: Request) {
  if (!billingConfigured()) return NextResponse.json({ error: 'Die Online-Zahlung ist noch nicht eingerichtet.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });
  const { companyId } = await req.json().catch(() => ({ companyId: '' }));
  const role = await memberRole(String(companyId || ''), user.id);
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Nur Inhaber oder Admins können die Abrechnung verwalten.' }, { status: 403 });
  const { data } = await adminDb().from('companies').select('stripe_customer_id').eq('id', companyId).single();
  if (!data?.stripe_customer_id) return NextResponse.json({ error: 'Für diese Firma gibt es noch kein Abo.' }, { status: 400 });
  const portal = await stripe().billingPortal.sessions.create({ customer: data.stripe_customer_id as string, return_url: `${siteOrigin(req)}/app/tarif`, locale: 'de' });
  return NextResponse.json({ url: portal.url });
}
