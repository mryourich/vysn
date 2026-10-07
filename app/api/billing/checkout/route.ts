import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { TRIAL_DAYS } from '../../../../lib/plans';
import { billingConfigured, priceId, siteOrigin, stripe } from '../../../../lib/server/billing';
import { PAID_PLANS } from '../../../../lib/plans';
import type { Interval } from '../../../../lib/server/billing';
import { adminDb, memberRole, userFromRequest } from '../../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Startet die Buchung eines Tarifs (Stripe Checkout) bzw. leitet bei bestehendem Abo ins Kundenportal. */
export async function POST(req: Request) {
  if (!billingConfigured()) return NextResponse.json({ error: 'Die Online-Zahlung ist noch nicht eingerichtet.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const plan = PAID_PLANS.find((p) => p === body.plan) || null;
  const interval: Interval = body.interval === 'monthly' ? 'monthly' : 'yearly';
  if (!companyId || !plan) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const role = await memberRole(companyId, user.id);
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Nur Inhaber oder Admins können den Tarif ändern.' }, { status: 403 });

  const price = priceId(plan, interval);
  if (!price) return NextResponse.json({ error: 'Dieser Tarif ist noch nicht buchbar.' }, { status: 400 });

  const db = adminDb();
  const { data: company, error } = await db.from('companies')
    .select('id, name, email, stripe_customer_id, stripe_subscription_id, subscription_status, trial_used').eq('id', companyId).single();
  if (error || !company) return NextResponse.json({ error: 'Firma nicht gefunden.' }, { status: 404 });

  const s = stripe();
  const origin = siteOrigin(req);
  let customerId = company.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await s.customers.create({
      name: company.name as string,
      email: (company.email as string) || user.email,
      metadata: { companyId, userId: user.id },
      preferred_locales: ['de'],
    });
    customerId = customer.id;
    await db.from('companies').update({ stripe_customer_id: customerId }).eq('id', companyId);
  }

  // Bestehendes, laufendes Abo → Tarifwechsel über /api/billing/change (kein zweites Abo)
  if (company.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(String(company.subscription_status))) {
    return NextResponse.json({ error: 'Für diese Firma läuft bereits ein Abo – bitte den Tarif wechseln statt neu zu buchen.' }, { status: 409 });
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    customer: customerId,
    client_reference_id: companyId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: {
      metadata: { companyId },
      ...(company.trial_used ? {} : { trial_period_days: TRIAL_DAYS }),
    },
    metadata: { companyId, plan, interval },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
    locale: 'de',
    success_url: `${origin}/app/tarif?checkout=success`,
    cancel_url: `${origin}/app/tarif?checkout=cancel`,
  };
  const session = await s.checkout.sessions.create(params);
  return NextResponse.json({ url: session.url });
}
