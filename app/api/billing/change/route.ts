import { NextResponse } from 'next/server';
import { PAID_PLANS } from '../../../../lib/plans';
import type { PlanId } from '../../../../lib/types';
import { applySubscription, billingConfigured, confirmChangeUrl, planForPrice, intervalForPrice, releasePending, siteOrigin, stripe } from '../../../../lib/server/billing';
import type { Interval } from '../../../../lib/server/billing';
import { adminDb, memberRole, userFromRequest } from '../../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tarifwechsel eines laufenden Abos – bestätigt auf einer Stripe-Seite:
 * teurer sofort, günstiger (und Kündigung) zum Laufzeitende.
 * Gleicher Tarif und Rhythmus nimmt eine Vormerkung direkt zurück.
 */
export async function POST(req: Request) {
  if (!billingConfigured()) return NextResponse.json({ error: 'Die Online-Zahlung ist noch nicht eingerichtet.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const plan = (body.plan === 'start' ? 'start' : PAID_PLANS.find((p) => p === body.plan)) as PlanId | undefined;
  const interval: Interval = body.interval === 'monthly' ? 'monthly' : 'yearly';
  if (!companyId || !plan) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const role = await memberRole(companyId, user.id);
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Nur Inhaber oder Admins können den Tarif ändern.' }, { status: 403 });

  const { data: company } = await adminDb().from('companies').select('stripe_subscription_id').eq('id', companyId).single();
  const subId = company?.stripe_subscription_id as string | undefined;
  if (!subId) return NextResponse.json({ error: 'Für diese Firma gibt es kein laufendes Abo.' }, { status: 400 });

  const s = stripe();
  try {
    const sub = await s.subscriptions.retrieve(subId);
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) return NextResponse.json({ error: 'Das Abo ist nicht mehr aktiv – bitte neu buchen.' }, { status: 400 });
    if (sub.status === 'past_due' && plan !== 'start') return NextResponse.json({ error: 'Die letzte Zahlung ist offen. Bitte zuerst die Zahlungsmethode aktualisieren.' }, { status: 402 });
    const price = sub.items.data[0]?.price.id || '';
    // Gleicher Tarif und Rhythmus: Vormerkung bzw. Kündigung zurücknehmen (ohne Stripe-Seite)
    if (plan === planForPrice(price) && interval === intervalForPrice(price)) {
      await releasePending(sub, s);
      await applySubscription(await s.subscriptions.retrieve(subId));
      return NextResponse.json({ mode: 'unchanged', plan, interval, at: null });
    }
    const url = await confirmChangeUrl(sub, plan, interval, `${siteOrigin(req)}/app/tarif?checkout=changed`, s);
    // Aufgehobene Vormerkung sofort übernehmen (der Webhook folgt zusätzlich)
    await applySubscription(await s.subscriptions.retrieve(subId));
    return NextResponse.json({ url });
  } catch (e) {
    const message = (e as { message?: string }).message || '';
    console.error('stripe change plan', e);
    return NextResponse.json({
      error: /bereits zum Laufzeitende gekündigt/.test(message) ? message : 'Der Tarifwechsel konnte nicht gestartet werden. Bitte versuchen Sie es erneut.',
    }, { status: 400 });
  }
}
