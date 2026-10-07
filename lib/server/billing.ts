import 'server-only';
import Stripe from 'stripe';
import type { PaidPlan, PlanId } from '../types';
import { adminDb } from './supabase-admin';
import { PAID_PLANS } from '../plans';

/**
 * Abrechnung über Stripe.
 *
 * Umgebungsvariablen (beim Hosting, niemals im Code):
 *   STRIPE_SECRET_KEY            sk_live_… bzw. sk_test_…
 *   STRIPE_WEBHOOK_SECRET        whsec_… (Webhook-Endpunkt /api/billing/webhook)
 *   STRIPE_PRICE_SOLO_MONTHLY,     STRIPE_PRICE_SOLO_YEARLY,
 *   STRIPE_PRICE_BUSINESS_MONTHLY, STRIPE_PRICE_BUSINESS_YEARLY,
 *   STRIPE_PRICE_TEAM_MONTHLY,     STRIPE_PRICE_TEAM_YEARLY      price_…
 *   STRIPE_AUTOMATIC_TAX=true    (optional, wenn Stripe Tax eingerichtet ist)
 *   SUPABASE_SERVICE_ROLE_KEY    geheimer Supabase-Schlüssel (sb_secret_…)
 */

export type Interval = 'monthly' | 'yearly';

const PRICE_ENV: Record<PaidPlan, Record<Interval, string>> = {
  solo: { monthly: 'STRIPE_PRICE_SOLO_MONTHLY', yearly: 'STRIPE_PRICE_SOLO_YEARLY' },
  business: { monthly: 'STRIPE_PRICE_BUSINESS_MONTHLY', yearly: 'STRIPE_PRICE_BUSINESS_YEARLY' },
  team: { monthly: 'STRIPE_PRICE_TEAM_MONTHLY', yearly: 'STRIPE_PRICE_TEAM_YEARLY' },
};

export const priceId = (plan: PaidPlan, interval: Interval) => process.env[PRICE_ENV[plan][interval]] || '';

export function planForPrice(price: string): PlanId | null {
  for (const plan of PAID_PLANS) {
    if (price && (price === priceId(plan, 'monthly') || price === priceId(plan, 'yearly'))) return plan;
  }
  return null;
}

export function intervalForPrice(price: string): Interval | null {
  for (const plan of PAID_PLANS) {
    if (!price) break;
    if (price === priceId(plan, 'monthly')) return 'monthly';
    if (price === priceId(plan, 'yearly')) return 'yearly';
  }
  return null;
}

export const billingConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && PAID_PLANS.some((p) => priceId(p, 'monthly') || priceId(p, 'yearly')));

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
export async function applySubscription(input: Stripe.Subscription) {
  let sub = input;
  const db = adminDb();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let companyId = sub.metadata?.companyId || '';
  if (!companyId) {
    const { data } = await db.from('companies').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    companyId = (data?.id as string) || '';
  }
  if (!companyId) throw new Error(`Keine Firma zu Stripe-Kunde ${customerId} gefunden.`);

  // Verspätete Ereignisse eines alten Abos dürfen ein neueres nicht überschreiben.
  const { data: current } = await db.from('companies').select('*').eq('id', companyId).maybeSingle();
  const currentSub = (current?.stripe_subscription_id as string) || '';
  if (currentSub && currentSub !== sub.id && !ACTIVE.has(sub.status)) return { companyId, plan: null, skipped: true };

  // Tarifwechsel in der Testphase beendet die Testphase: neuer Tarif gilt sofort und wird abgerechnet
  if (current && trialChanged(sub, current)) sub = await endTrialNow(sub);

  const item = sub.items?.data?.[0];
  const plan = item ? planForPrice(item.price.id) : null;
  const active = ACTIVE.has(sub.status) && plan;
  // current_period_end liegt je nach Stripe-API-Version am Abo oder an der Position
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;

  const pending = await pendingChange(sub);
  const update: Record<string, unknown> = {
    plan: active ? plan : 'start',
    billing_interval: item ? intervalForPrice(item.price.id) : null,
    pending_plan: pending?.plan ?? null,
    pending_interval: pending?.interval ?? null,
    pending_change_at: pending?.at ?? null,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.status === 'canceled' ? null : sub.id,
    subscription_status: sub.status,
    trial_ends_at: iso(sub.trial_end),
    current_period_end: iso(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
  if (sub.trial_end) update.trial_used = true;
  let { error } = await db.from('companies').update(update).eq('id', companyId);
  // Datenbank ohne Migration 20261014090000_plan_change: ohne die neuen Felder speichern,
  // damit Tarif und Abo-Status trotzdem aktuell bleiben
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const { billing_interval: _i, pending_plan: _p, pending_interval: _pi, pending_change_at: _pa, ...base } = update;
    ({ error } = await db.from('companies').update(base).eq('id', companyId));
  }
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

/* ---------------------------------------------------------------------------
 * Tarifwechsel – immer mit Bestätigung auf einer Stripe-Seite
 * Teurer (höherer Tarif bzw. monatlich → jährlich): sofort, Differenz anteilig.
 * Günstiger (niedrigerer Tarif bzw. jährlich → monatlich): Stripe plant den Wechsel
 * zum Ende der Laufzeit (schedule_at_period_end); bis dahin bleibt der bisherige Tarif.
 * Start (kostenlos): Kündigung zum Laufzeitende über die Stripe-Kündigungsseite.
 * ------------------------------------------------------------------------- */

type Pending = { plan: PlanId; interval: Interval | null; at: string | null };

/** Vorgemerkter Wechsel eines Abos (Kündigung zum Laufzeitende oder nächste Phase eines Schedules). */
async function pendingChange(sub: Stripe.Subscription, s?: Stripe): Promise<Pending | null> {
  if (sub.status === 'canceled') return null;
  const periodEnd = currentPeriodEnd(sub);
  if (sub.cancel_at_period_end) return { plan: 'start', interval: null, at: iso(sub.cancel_at ?? periodEnd) };
  const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id;
  if (!scheduleId) return null;
  try {
    const schedule = await (s || stripe()).subscriptionSchedules.retrieve(scheduleId);
    const now = Math.floor(Date.now() / 1000);
    const next = schedule.phases.find((ph) => ph.start_date > now);
    const price = next?.items?.[0]?.price;
    const id = typeof price === 'string' ? price : price?.id || '';
    const plan = planForPrice(id);
    return plan && next ? { plan, interval: intervalForPrice(id), at: iso(next.start_date) } : null;
  } catch {
    return null;
  }
}

function currentPeriodEnd(sub: Stripe.Subscription): number | undefined {
  const item = sub.items?.data?.[0];
  return (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
}

/**
 * Wurde ein Abo in der Testphase gewechselt (anderer Tarif/Rhythmus oder von Stripe zum
 * Laufzeitende vorgemerkt)? Nur für das bereits bekannte Abo – nicht bei der Erstbuchung.
 */
function trialChanged(sub: Stripe.Subscription, current: Record<string, unknown>) {
  if (sub.status !== 'trialing' || current.stripe_subscription_id !== sub.id) return false;
  const known = String(current.plan || '');
  if (!PAID_PLANS.includes(known as PaidPlan)) return false;
  const price = sub.items?.data?.[0]?.price.id || '';
  const knownInterval = String(current.billing_interval || '');
  return Boolean(sub.schedule)
    || planForPrice(price) !== known
    || (!!knownInterval && intervalForPrice(price) !== knownInterval);
}

/**
 * Testphase sofort beenden: ein von Stripe vorgemerkter Wechsel (Schedule) wird gleich
 * übernommen, danach startet die Abrechnung mit dem neuen Tarif ab heute.
 */
async function endTrialNow(sub: Stripe.Subscription, s: Stripe = stripe()) {
  const item = sub.items.data[0];
  let price = item.price.id;
  const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id;
  if (scheduleId) {
    const schedule = await s.subscriptionSchedules.retrieve(scheduleId);
    const now = Math.floor(Date.now() / 1000);
    const next = schedule.phases.find((ph) => ph.start_date > now)?.items?.[0]?.price;
    price = (typeof next === 'string' ? next : next?.id) || price;
    await s.subscriptionSchedules.release(scheduleId);
  }
  return s.subscriptions.update(sub.id, {
    ...(price !== item.price.id ? { items: [{ id: item.id, price }] } : {}),
    trial_end: 'now',
    proration_behavior: 'none',
  });
}

/** Vorgemerkten Wechsel (Schedule) bzw. Kündigung zum Laufzeitende aufheben. */
export async function releasePending(sub: Stripe.Subscription, s: Stripe = stripe()) {
  const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id;
  if (scheduleId) await s.subscriptionSchedules.release(scheduleId);
  if (sub.cancel_at_period_end) await s.subscriptions.update(sub.id, { cancel_at_period_end: false });
}

/**
 * Stripe-Bestätigungsseite für einen Tarifwechsel bzw. die Kündigung.
 * Liefert die URL, auf die der Kunde weitergeleitet wird.
 */
export async function confirmChangeUrl(sub: Stripe.Subscription, plan: PlanId, interval: Interval, returnUrl: string, s: Stripe = stripe()) {
  const configuration = await portalConfiguration(s);
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const after = { type: 'redirect' as const, redirect: { return_url: returnUrl } };
  if (plan === 'start') {
    if (sub.cancel_at_period_end) throw new Error('Das Abo ist bereits zum Laufzeitende gekündigt.');
    const session = await s.billingPortal.sessions.create({
      customer, locale: 'de', return_url: returnUrl, ...(configuration ? { configuration } : {}),
      flow_data: { type: 'subscription_cancel', subscription_cancel: { subscription: sub.id }, after_completion: after },
    });
    return session.url;
  }
  const price = priceId(plan as PaidPlan, interval);
  if (!price) throw new Error('Dieser Tarif ist noch nicht buchbar.');
  // Ein vorgemerkter Wechsel bzw. eine Kündigung blockiert Änderungen – die neue Auswahl ersetzt sie
  await releasePending(sub, s);
  const session = await s.billingPortal.sessions.create({
    customer, locale: 'de', return_url: returnUrl, ...(configuration ? { configuration } : {}),
    flow_data: {
      type: 'subscription_update_confirm',
      subscription_update_confirm: { subscription: sub.id, items: [{ id: sub.items.data[0].id, price, quantity: 1 }] },
      after_completion: after,
    },
  });
  return session.url;
}

/**
 * Kundenportal mit den Tarifwechsel-Regeln von VYSNER One: Zahlungsart, Rechnungen,
 * Adresse, Kündigung zum Laufzeitende und Tarifwechsel (teurer sofort, günstiger zum
 * Laufzeitende). Die Konfiguration wird einmalig per API angelegt.
 */
let portalConfig: string | null = null;
export async function portalConfiguration(s: Stripe = stripe()): Promise<string | undefined> {
  if (portalConfig) return portalConfig;
  try {
    const list = await s.billingPortal.configurations.list({ active: true, limit: 100 });
    const found = list.data.find((c) => c.metadata?.vysn === 'v3');
    if (found) return (portalConfig = found.id);
    // Buchbare Preise je Produkt (Solo, Business, Team – monatlich und jährlich)
    const byProduct = new Map<string, string[]>();
    for (const plan of PAID_PLANS) {
      for (const interval of ['monthly', 'yearly'] as const) {
        const id = priceId(plan, interval);
        if (!id) continue;
        const p = await s.prices.retrieve(id);
        const product = typeof p.product === 'string' ? p.product : p.product.id;
        byProduct.set(product, [...(byProduct.get(product) || []), id]);
      }
    }
    const created = await s.billingPortal.configurations.create({
      metadata: { vysn: 'v3' },
      business_profile: { headline: 'VYSNER One – Tarif, Zahlung & Rechnungen' },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['address', 'email', 'name', 'tax_id'] },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          products: [...byProduct].map(([product, prices]) => ({ product, prices })),
          proration_behavior: 'always_invoice',
          schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }, { type: 'shortening_interval' }] },
        },
      },
    });
    return (portalConfig = created.id);
  } catch (e) {
    console.error('stripe portal configuration', e);
    return undefined; // Standard-Konfiguration aus dem Stripe-Dashboard
  }
}
