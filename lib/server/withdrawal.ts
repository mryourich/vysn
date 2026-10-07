import 'server-only';
import type Stripe from 'stripe';
import { stripe } from './billing';
import { applyAnySubscription } from './ai-addon';
import { mailFrom, smtpConfigured, smtpTransport } from './smtp';

/**
 * Widerrufsrecht (14 Tage ab Vertragsschluss) für Deutschland, Österreich und – freiwillig – die Schweiz.
 * § 355/§ 356a BGB, § 11 FAGG; Widerrufsbutton nach Richtlinie (EU) 2023/2673.
 * Wir erstatten bei Widerruf den vollen bezahlten Betrag (kein anteiliger Wertersatz).
 */
export const WITHDRAWAL_DAYS = 14;
const DAY = 86400;

export function withdrawalDeadline(sub: Stripe.Subscription) {
  const start = sub.start_date || sub.created;
  return start + WITHDRAWAL_DAYS * DAY;
}

export function canWithdraw(sub: Stripe.Subscription) {
  if (!['active', 'trialing', 'past_due', 'incomplete'].includes(sub.status)) return false;
  return Math.floor(Date.now() / 1000) <= withdrawalDeadline(sub);
}

/** Widerruf ausführen: Zahlungen seit Vertragsbeginn voll erstatten, Abo sofort beenden. */
export async function executeWithdrawal(sub: Stripe.Subscription, s: Stripe = stripe()) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const start = sub.start_date || sub.created;
  let refunded = 0;
  const charges = await s.charges.list({ customer, created: { gte: start - DAY }, limit: 100 });
  for (const c of charges.data) {
    const open = (c.amount_captured || 0) - (c.amount_refunded || 0);
    if (c.status !== 'succeeded' || open <= 0) continue;
    await s.refunds.create({ charge: c.id, amount: open, reason: 'requested_by_customer', metadata: { vysner: 'widerruf', subscription: sub.id } });
    refunded += open;
  }
  const cancelled = await s.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false, cancellation_details: { comment: 'Widerruf innerhalb von 14 Tagen' } });
  await applyAnySubscription(cancelled);
  return { refunded, currency: (charges.data[0]?.currency || 'eur').toUpperCase() };
}

const money = (cents: number, currency: string) =>
  (cents / 100).toLocaleString('de-DE', { style: 'currency', currency });

/** Bestätigung auf einem dauerhaften Datenträger (E-Mail), wie für den Widerrufsbutton vorgeschrieben. */
export async function sendWithdrawalMail(to: string[], data: { company: string; name: string; date: Date; refunded?: number; currency?: string; pending?: boolean }) {
  if (!smtpConfigured()) return false;
  const when = data.date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' });
  const lines = data.pending
    ? [
      `Guten Tag ${data.name || ''},`.trim(),
      '',
      `wir bestätigen den Eingang Ihres Widerrufs für das VYSNER-One-Abonnement der Firma „${data.company}“ am ${when}.`,
      'Wir ordnen den Widerruf Ihrem Konto zu, beenden das Abonnement und erstatten bereits bezahlte Beträge vollständig auf die ursprüngliche Zahlungsart – spätestens innerhalb von 14 Tagen.',
    ]
    : [
      `Guten Tag ${data.name || ''},`.trim(),
      '',
      `hiermit bestätigen wir den Eingang Ihres Widerrufs am ${when}.`,
      `Das Abonnement der Firma „${data.company}“ ist beendet; die Firma nutzt ab sofort den kostenlosen Tarif Start. Ihre Daten bleiben erhalten.`,
      data.refunded ? `Der bezahlte Betrag von ${money(data.refunded, data.currency || 'EUR')} wird vollständig auf die ursprüngliche Zahlungsart erstattet. Je nach Bank dauert die Gutschrift 5–10 Werktage.` : 'Es waren keine Zahlungen zu erstatten.',
    ];
  const text = [...lines, '', 'Mit freundlichen Grüßen', 'VYSNER One', 'hallo@vysn.de'].join('\n');
  await smtpTransport().sendMail({
    from: mailFrom('VYSNER One'),
    to: [...new Set(to.filter(Boolean))].join(', '),
    bcc: process.env.WITHDRAWAL_BCC || undefined,
    replyTo: 'hallo@vysn.de',
    subject: 'Bestätigung Ihres Widerrufs – VYSNER One',
    text,
  });
  return true;
}
