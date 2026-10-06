import { MONTHS_LONG, today } from './calc';
import type { Data, PlanId } from './types';

/** Tarife: Limits der App. Preise/Texte siehe PLAN_OFFERS unten (Startseite und App). */
export const PLANS: Record<PlanId, { label: string; invoicesPerMonth: number | null }> = {
  start: { label: 'Start', invoicesPerMonth: 10 },
  business: { label: 'Business', invoicesPerMonth: null },
  team: { label: 'Team', invoicesPerMonth: null },
};

/** Benutzer je Firma (inkl. offener Einladungen) – dieselbe Regel prüft plan_user_limit() in der Datenbank. */
export const PLAN_USERS: Record<PlanId, number> = { start: 1, business: 1, team: 5 };

export const planOf = (data: Data): PlanId => data.company?.plan || 'start';

/**
 * Rechnungskontingent des laufenden Monats. Gezählt werden alle Rechnungen
 * (auch Entwürfe) mit Rechnungsdatum im aktuellen Kalendermonat – dieselbe
 * Regel prüft die Datenbank (supabase/migrations/*_plan_limits.sql).
 */
export function invoiceQuota(data: Data) {
  const limit = PLANS[planOf(data)].invoicesPerMonth;
  const month = today().slice(0, 7);
  const used = data.documents.filter((d) => d.kind === 'invoice' && d.date.startsWith(month)).length;
  return {
    used,
    limit,
    reached: limit !== null && used >= limit,
    monthLabel: MONTHS_LONG[Number(month.slice(5, 7)) - 1],
  };
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
    features: ['Bis zu 10 Rechnungen pro Monat', 'Unbegrenzt Angebote', 'Rechnungen & Angebote als PDF', 'Kunden, Material & Lager', 'Mehrere Firmen unter einem Login'],
    cta: 'Kostenlos starten',
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 24,
    yearly: 19,
    text: 'Für Betriebe, die ihre Zahlen im Griff haben wollen.',
    features: ['Unbegrenzt Rechnungen & Angebote', 'Eigenes Rechnungsdesign mit Logo', 'Logo-Hintergrund automatisch entfernen', 'GuV, Umsatzsteuer & DATEV-Export', 'E-Mail-Versand & Lager-Scanner', 'E-Mail-Support'],
    cta: '30 Tage kostenlos testen',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 49,
    yearly: 39,
    text: 'Für Teams mit Büro und mehreren Mitarbeitenden.',
    features: ['Alles aus Business', 'Bis zu 5 Benutzer je Firma', 'Rollen: Inhaber, Admin, Mitarbeiter', 'Persönliches Onboarding', 'Telefon-Support'],
    cta: '30 Tage kostenlos testen',
  },
];

export const TRIAL_DAYS = 30;
