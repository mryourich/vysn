import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { applySubscription, stripe, syncCustomer } from '../../../../lib/server/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe-Webhook. In Stripe → Entwickler → Webhooks einen Endpunkt
 * https://<ihre-domain>/api/billing/webhook anlegen mit den Ereignissen:
 * checkout.session.completed, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Webhook nicht eingerichtet.' }, { status: 503 });
  const signature = req.headers.get('stripe-signature') || '';
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Ungültige Signatur.' }, { status: 400 });
  }
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case 'checkout.session.completed':
      case 'invoice.payment_failed': {
        const obj = event.data.object as { customer?: string | { id: string } | null };
        const customer = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        if (customer) await syncCustomer(customer);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('stripe webhook', event.type, e);
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
