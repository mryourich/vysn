import 'server-only';
import Stripe from 'stripe';
import type { PlanId } from '../types';
import { adminDb } from './supabase-admin';

/**
 * Abrechnung über Stripe.
 *
 * Umgebungsvariablen (beim Hosting, niemals im Code):
 *   STRIPE_SECRET_KEY            sk_live_… bzw. sk_test_…
 *   STRIPE_WEBHOOK_SECRET        whsec_… (Webhook-Endpunkt /api/billing/webhook)
 *   STRIPE_PRICE_BUSINESS_MONTHLY, STRIPE_PRICE_BUSINESS_YEARLY,
 *   STRIPE_PRICE_TEAM_MONTHLY,     STRIPE_PRICE_TEAM_YEARLY      price_…
 *   STRIPE_AUTOMATIC_TAX=true    (optional, wenn Stripe Tax eingerichtet ist)
 *   SUPABASE_SERVICE_ROLE_KEY    geheimer Supabase-Schlüssel (sb_secret_…)
 */

export type Interval = 'monthly' | 'yearly';

const PRICE_ENV: Record<Exclude<PlanId, 'start'>, Record<Interval, string>> = {
  business: { monthly: 'STRIPE_PRICE_BUSINESS_MONTHLY', yearly: 'STRIPE_PRICE_BUSINESS_YEARLY' },
  team: { monthly: 'STRIPE_PRICE_TEAM_MONTHLY', yearly: 'STRIPE_PRICE_TEAM_YEARLY' },
};

export const priceId = (plan: Exclude<PlanId, 'start'>, interval: Interval) => process.env[PRICE_ENV[plan][interval]] || '';

export function planForPrice(price: string): PlanId | null {
  for (const plan of ['business', 'team'] as const) {
    if (price && (price === priceId(plan, 'monthly') || price === priceId(plan, 'yearly'))) return plan;
  }
  return null;
}

export const billingConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && (priceId('business', 'monthly') || priceId('business', 'yearly')));

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY fehlt.');
  if (!client) {
    client = new Stripe(key, {
      // Für Tests gegen stripe-mock: STRIPE_API_BASE=http://localhost:12111
      ...(process.env.STRIPE_API_BASE ? (() => { const u = new URL(process.env.STRIPE_API_BASE!); return { host: u.hostname, port: Number(u.port || 80), protocol: u.protocol.replace(':', '') as 'http' | 'https' }; })() : {}),
    });
  }
  return client;
}

const ACTIVE = new Set(['active', 'trialing', 'past_due']);
const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Überträgt den Zustand eines Stripe-Abos auf die Firma (Tarif, Status, Testphase, Laufzeit). */
export async function applySubscription(sub: Stripe.Subscription) {
  const db = adminDb();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let companyId = sub.metadata?.companyId || '';
  if (!companyId) {
    const { data } = await db.from('companies').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    companyId = (data?.id as string) || '';
  }
  if (!companyId) throw new Error(`Keine Firma zu Stripe-Kunde ${customerId} gefunden.`);

  // Verspätete Ereignisse eines alten Abos dürfen ein neueres nicht überschreiben.
  const { data: current } = await db.from('companies').select('stripe_subscription_id').eq('id', companyId).maybeSingle();
  const currentSub = (current?.stripe_subscription_id as string) || '';
  if (currentSub && currentSub !== sub.id && !ACTIVE.has(sub.status)) return { companyId, plan: null, skipped: true };

  const item = sub.items?.data?.[0];
  const plan = item ? planForPrice(item.price.id) : null;
  const active = ACTIVE.has(sub.status) && plan;
  // current_period_end liegt je nach Stripe-API-Version am Abo oder an der Position
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;

  const update: Record<string, unknown> = {
    plan: active ? plan : 'start',
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.status === 'canceled' ? null : sub.id,
    subscription_status: sub.status,
    trial_ends_at: iso(sub.trial_end),
    current_period_end: iso(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
  if (sub.trial_end) update.trial_used = true;
  const { error } = await db.from('companies').update(update).eq('id', companyId);
  if (error) throw new Error(error.message);
  return { companyId, plan: update.plan as PlanId };
}

/** Liest alle Abos eines Kunden bei Stripe und übernimmt das relevante (aktives vor beendetem). */
export async function syncCustomer(customerId: string) {
  const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const sorted = [...subs.data].sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)) || b.created - a.created);
  if (sorted[0]) return applySubscription(sorted[0]);
  return null;
}

/** Öffentliche Basis-URL der Seite für Rücksprünge aus Stripe. */
export function siteOrigin(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || new URL(req.url).origin;
}
