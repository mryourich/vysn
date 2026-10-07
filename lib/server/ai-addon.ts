import 'server-only';
import type Stripe from 'stripe';
import { aiPrice, applySubscription, isAiSubscription, stripe } from './billing';
import { adminDb } from './supabase-admin';

/**
 * KI-Sprachassistent als Zusatzbuchung: eigenes Stripe-Abo (eigener Stripe-Kunde),
 * unabhängig vom Tarif – buchbar in jedem Tarif, auch Start.
 *
 * Umgebungsvariablen:
 *   STRIPE_PRICE_AI_MONTHLY   price_… (25 € / Monat)
 *   ANTHROPIC_API_KEY         ohne Schlüssel ist die Erweiterung ausgeblendet
 *   AI_DAILY_LIMIT            Anfragen je Firma und Tag (Standard 30)
 *   AI_MONTHLY_LIMIT          Anfragen je Firma und Monat (Standard 500) – deckelt die Kosten
 */
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const aiBookable = () => aiConfigured() && Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && aiPrice());
export const aiDailyLimit = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30);
export const aiMonthlyLimit = () => Math.max(1, Number(process.env.AI_MONTHLY_LIMIT) || 500);

const ACTIVE = new Set(['active', 'trialing', 'past_due']);
export const aiActive = (status: unknown) => ACTIVE.has(String(status || ''));

export { aiPrice, isAiSubscription };

/** Stripe-Abo der richtigen Seite zuordnen: KI-Zusatzbuchung oder Tarif. */
export const applyAnySubscription = (sub: Stripe.Subscription) => (isAiSubscription(sub) ? applyAiSubscription(sub) : applySubscription(sub));

/** Überträgt den Zustand des KI-Abos auf die Firma. */
export async function applyAiSubscription(sub: Stripe.Subscription) {
  const db = adminDb();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let companyId = sub.metadata?.companyId || '';
  if (!companyId) {
    const { data } = await db.from('companies').select('id').eq('ai_customer_id', customerId).maybeSingle();
    companyId = (data?.id as string) || '';
  }
  if (!companyId) throw new Error(`Keine Firma zu KI-Kunde ${customerId} gefunden.`);

  // Verspätete Ereignisse eines alten KI-Abos dürfen ein neueres nicht überschreiben
  const { data: current } = await db.from('companies').select('ai_subscription_id').eq('id', companyId).maybeSingle();
  const currentSub = (current?.ai_subscription_id as string) || '';
  if (currentSub && currentSub !== sub.id && !ACTIVE.has(sub.status)) return { companyId, active: false, skipped: true };

  const item = sub.items?.data?.[0];
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const { error } = await db.from('companies').update({
    ai_customer_id: customerId,
    ai_subscription_id: sub.status === 'canceled' ? null : sub.id,
    ai_status: sub.status,
    ai_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    ai_cancel_at_period_end: !!sub.cancel_at_period_end,
  }).eq('id', companyId);
  if (error) throw new Error(error.message);
  return { companyId, active: ACTIVE.has(sub.status) };
}

/** Liest die KI-Abos eines Kunden bei Stripe und übernimmt das relevante. */
export async function syncAiCustomer(customerId: string) {
  const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const sorted = subs.data.filter(isAiSubscription)
    .sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)) || b.created - a.created);
  return sorted[0] ? applyAiSubscription(sorted[0]) : null;
}

/**
 * Kundenportal nur für das KI-Abo: Zahlungsart, Rechnungen, Kündigung zum Laufzeitende –
 * ohne Tarifwechsel (sonst ließe sich das KI-Abo in einen Tarif umwandeln).
 */
let portalConfig: string | null = null;
export async function aiPortalConfiguration(s: Stripe = stripe()): Promise<string | undefined> {
  if (portalConfig) return portalConfig;
  try {
    const list = await s.billingPortal.configurations.list({ active: true, limit: 100 });
    const found = list.data.find((c) => c.metadata?.vysn === 'ai-v1');
    if (found) return (portalConfig = found.id);
    const created = await s.billingPortal.configurations.create({
      metadata: { vysn: 'ai-v1' },
      business_profile: { headline: 'VYSNER One – KI-Sprachassistent' },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['address', 'email', 'name', 'tax_id'] },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: { enabled: false },
      },
    });
    return (portalConfig = created.id);
  } catch (e) {
    console.error('stripe ai portal configuration', e);
    return undefined;
  }
}
