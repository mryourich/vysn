import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { siteOrigin, stripe } from '../../../../lib/server/billing';
import { aiActive, aiBookable, aiPortalConfiguration, aiPrice, applyAiSubscription, syncAiCustomer } from '../../../../lib/server/ai-addon';
import { adminDb, memberRole, userFromRequest } from '../../../../lib/server/supabase-admin';
import { canWithdraw, executeWithdrawal, sendWithdrawalMail, withdrawalDeadline } from '../../../../lib/server/withdrawal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'checkout' | 'portal' | 'cancel' | 'resume' | 'sync' | 'withdraw-info' | 'withdraw';

/** KI-Sprachassistent als Zusatzbuchung (eigenes Stripe-Abo, 25 € / Monat): buchen, verwalten, kündigen, widerrufen. */
export async function POST(req: Request) {
  if (!aiBookable()) return NextResponse.json({ error: 'Der KI-Sprachassistent ist noch nicht buchbar.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const action = String(body.action || '') as Action;
  const role = await memberRole(companyId, user.id);
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Nur Inhaber oder Admins können Zusatzbuchungen verwalten.' }, { status: 403 });

  const db = adminDb();
  const { data: company } = await db.from('companies')
    .select('id, name, email, ai_customer_id, ai_subscription_id, ai_status').eq('id', companyId).single();
  if (!company) return NextResponse.json({ error: 'Firma nicht gefunden.' }, { status: 404 });

  const s = stripe();
  const origin = siteOrigin(req);
  const returnUrl = `${origin}/app/erweiterungen`;
  const subId = (company.ai_subscription_id as string) || '';
  const customerId = (company.ai_customer_id as string) || '';

  switch (action) {
    case 'checkout': {
      if (subId && aiActive(company.ai_status)) return NextResponse.json({ error: 'Der KI-Sprachassistent ist für diese Firma bereits gebucht.' }, { status: 409 });
      let customer = customerId;
      if (!customer) {
        // Eigener Stripe-Kunde für die Zusatzbuchung – getrennt vom Tarif-Abo (eigene Rechnungen, eigener Widerruf)
        const created = await s.customers.create({
          name: company.name as string,
          email: (company.email as string) || user.email,
          metadata: { companyId, userId: user.id, product: 'ai' },
          preferred_locales: ['de'],
        });
        customer = created.id;
        await db.from('companies').update({ ai_customer_id: customer }).eq('id', companyId);
      }
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        customer,
        client_reference_id: companyId,
        line_items: [{ price: aiPrice(), quantity: 1 }],
        subscription_data: { metadata: { companyId, product: 'ai' } },
        metadata: { companyId, product: 'ai' },
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },
        automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
        locale: 'de',
        success_url: `${returnUrl}?ki=gebucht`,
        cancel_url: `${returnUrl}?ki=abgebrochen`,
      };
      const session = await s.checkout.sessions.create(params);
      return NextResponse.json({ url: session.url });
    }
    case 'portal':
    case 'cancel': {
      if (!customerId) return NextResponse.json({ error: 'Für diese Firma gibt es kein KI-Abo.' }, { status: 400 });
      const configuration = await aiPortalConfiguration(s);
      // Kündigen: direkt die Bestätigungsseite von Stripe (zum Laufzeitende)
      const flow: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined = action === 'cancel' && subId
        ? { type: 'subscription_cancel', subscription_cancel: { subscription: subId }, after_completion: { type: 'redirect', redirect: { return_url: `${returnUrl}?ki=gekuendigt` } } }
        : undefined;
      const portal = await s.billingPortal.sessions.create({
        customer: customerId, return_url: returnUrl, locale: 'de',
        ...(configuration ? { configuration } : {}), ...(flow ? { flow_data: flow } : {}),
      });
      return NextResponse.json({ url: portal.url });
    }
    case 'resume': {
      if (!subId) return NextResponse.json({ error: 'Für diese Firma gibt es kein KI-Abo.' }, { status: 400 });
      await applyAiSubscription(await s.subscriptions.update(subId, { cancel_at_period_end: false }));
      return NextResponse.json({ ok: true });
    }
    case 'sync': {
      const result = customerId ? await syncAiCustomer(customerId) : null;
      return NextResponse.json({ active: !!result?.active });
    }
    case 'withdraw-info':
    case 'withdraw': {
      const sub = subId ? await s.subscriptions.retrieve(subId) : null;
      if (action === 'withdraw-info') {
        return NextResponse.json(sub ? { eligible: canWithdraw(sub), until: new Date(withdrawalDeadline(sub) * 1000).toISOString() } : { eligible: false });
      }
      if (!sub || !canWithdraw(sub)) return NextResponse.json({ error: 'Die Widerrufsfrist von 14 Tagen ist abgelaufen. Sie können das KI-Abo zum Laufzeitende kündigen.' }, { status: 400 });
      try {
        const result = await executeWithdrawal(sub, s);
        const mailed = await sendWithdrawalMail([user.email || '', String(company.email || '')], {
          company: `${company.name} (KI-Sprachassistent)`, name: String(body.name || '').slice(0, 120), date: new Date(), ...result,
        }).catch((e) => { console.error('withdrawal mail', e); return false; });
        return NextResponse.json({ ok: true, ...result, mailed });
      } catch (e) {
        console.error('ai withdrawal', e);
        return NextResponse.json({ error: 'Der Widerruf konnte nicht verarbeitet werden. Bitte schreiben Sie uns an hallo@vysn.de – Ihr Widerruf gilt mit Eingang Ihrer Nachricht.' }, { status: 500 });
      }
    }
    default:
      return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
}
