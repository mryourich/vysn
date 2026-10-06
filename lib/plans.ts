import { MONTHS_LONG, today } from './calc';
import type { Data, PaidPlan, PlanId, UsageKind } from './types';

/** Tarife: Limits der App. Preise/Texte siehe PLAN_OFFERS unten (Startseite und App). */
export const PLANS: Record<PlanId, { label: string; monthlyLimit: number | null }> = {
  start: { label: 'Start', monthlyLimit: 10 },
  solo: { label: 'Solo', monthlyLimit: 50 },
  business: { label: 'Business', monthlyLimit: null },
  team: { label: 'Team', monthlyLimit: null },
};

/** Benutzer je Firma (inkl. offener Einladungen) – dieselbe Regel prüft plan_user_limit() in der Datenbank. */
export const PLAN_USERS: Record<PlanId, number> = { start: 1, solo: 1, business: 1, team: 5 };

export const planOf = (data: Data): PlanId => data.company?.plan || 'start';

/** Begrenzte Arten in Anzeigereihenfolge, mit Bezeichnung (Einzahl/Mehrzahl). */
export const USAGE_KINDS: { kind: UsageKind; one: string; many: string }[] = [
  { kind: 'invoice', one: 'Rechnung', many: 'Rechnungen' },
  { kind: 'offer', one: 'Angebot', many: 'Angebote' },
  { kind: 'customer', one: 'Kunde', many: 'Kunden' },
  { kind: 'material', one: 'Artikel', many: 'Artikel' },
  { kind: 'booking', one: 'Buchung', many: 'Buchungen' },
];
export const usageLabel = (kind: UsageKind) => USAGE_KINDS.find((k) => k.kind === kind)!;

/** Laufender Monat „YYYY-MM“ (wie usage_month() in der Datenbank). */
export const usageMonth = () => today().slice(0, 7);

/**
 * Kontingent einer Art im laufenden Monat. Gezählt wird jedes neu angelegte Element –
 * gelöschte zählen weiter mit. Dieselbe Regel prüft die Datenbank (track_usage()).
 */
export function usageQuota(data: Data, kind: UsageKind) {
  const limit = PLANS[planOf(data)].monthlyLimit;
  const month = usageMonth();
  const used = data.usage.month === month ? data.usage.counts[kind] || 0 : 0;
  return {
    kind,
    used,
    limit,
    reached: limit !== null && used >= limit,
    monthLabel: MONTHS_LONG[Number(month.slice(5, 7)) - 1],
  };
}

/** Zählt ein neu angelegtes Element im Datenstand mit (Monatswechsel setzt zurück). */
export function countUsage(data: Data, kind: UsageKind): Data {
  const month = usageMonth();
  const counts = data.usage.month === month ? data.usage.counts : {};
  return { ...data, usage: { month, counts: { ...counts, [kind]: (counts[kind] || 0) + 1 } } };
}

export type PlanOffer = {
  id: PlanId;
  name: string;
  /** Netto-Preis pro Monat bei monatlicher bzw. jährlicher Zahlung */
  monthly: number;
  yearly: number;
  text: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

/** Preise zentral hier pflegen. Die Stripe-Preise (STRIPE_PRICE_*) müssen dazu passen. */
export const PLAN_OFFERS: PlanOffer[] = [
  {
    id: 'start',
    name: 'Start',
    monthly: 0,
    yearly: 0,
    text: 'Für Gründer und Nebengewerbe, die sauber starten wollen.',
    features: ['Je 10 Rechnungen, Angebote, Kunden, Artikel und Buchungen pro Monat', 'Rechnungen & Angebote als PDF', 'Kunden, Material & Lager', 'Mehrere Firmen unter einem Login'],
    cta: 'Kostenlos starten',
  },
  {
    id: 'solo',
    name: 'Solo',
    monthly: 9.9,
    yearly: 7.9,
    text: 'Für Selbstständige mit regelmäßigen Aufträgen.',
    features: ['Je 50 Rechnungen, Angebote, Kunden, Artikel und Buchungen pro Monat', 'Rechnungen & Angebote als PDF', 'Kunden, Material & Lager', 'Mehrere Firmen unter einem Login'],
    cta: '30 Tage kostenlos testen',
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 24.9,
    yearly: 19.9,
    text: 'Für Betriebe, die ihre Zahlen im Griff haben wollen.',
    features: ['Unbegrenzt Rechnungen, Angebote, Kunden & Artikel', 'Eigenes Rechnungsdesign mit Logo', 'Logo-Hintergrund automatisch entfernen', 'GuV, Umsatzsteuer & DATEV-Export', 'E-Mail-Versand & Lager-Scanner', 'E-Mail-Support'],
    cta: '30 Tage kostenlos testen',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 49.9,
    yearly: 39.9,
    text: 'Für Teams mit Büro und mehreren Mitarbeitenden.',
    features: ['Alles aus Business', 'Bis zu 5 Benutzer je Firma', 'Rollen: Inhaber, Admin, Mitarbeiter', 'Persönliches Onboarding', 'Telefon-Support'],
    cta: '30 Tage kostenlos testen',
  },
];

export const TRIAL_DAYS = 30;

export const PAID_PLANS: PaidPlan[] = ['solo', 'business', 'team'];

/** Preis im deutschen Format: 0 → „0“, 9.9 → „9,90“, 24 → „24“. */
export const formatPlanPrice = (price: number) =>
  price.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(price) ? 0 : 2, maximumFractionDigits: 2 });

/** Nächstgrößerer Tarif mit höherem Monatslimit (für Upgrade-Hinweise). */
export const nextPlanForLimits = (plan: PlanId): PaidPlan | null => (plan === 'start' ? 'solo' : plan === 'solo' ? 'business' : null);
