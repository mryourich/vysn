import { NextResponse } from 'next/server';
import { billingConfigured, syncCustomer } from '../../../../lib/server/billing';
import { adminDb, memberRole, userFromRequest } from '../../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Gleicht den Abo-Status direkt mit Stripe ab (z. B. nach der Rückkehr aus dem Checkout). */
export async function POST(req: Request) {
  if (!billingConfigured()) return NextResponse.json({ error: 'Die Online-Zahlung ist noch nicht eingerichtet.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });
  const { companyId } = await req.json().catch(() => ({ companyId: '' }));
  if (!(await memberRole(String(companyId || ''), user.id))) return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 });
  const { data } = await adminDb().from('companies').select('stripe_customer_id').eq('id', companyId).single();
  if (!data?.stripe_customer_id) return NextResponse.json({ plan: 'start' });
  const result = await syncCustomer(data.stripe_customer_id as string);
  return NextResponse.json({ plan: result?.plan || 'start' });
}
