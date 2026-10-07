import { MONTHS_LONG, today } from './calc';
import type { CompanySummary, Data, PaidPlan, PlanId, UsageKind } from './types';

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

/**
 * Start und Solo enthalten eine Firma; weitere Firmen nur mit mindestens einer eigenen Firma
 * im Tarif Business oder Team (dieselbe Regel prüft can_add_company() in der Datenbank).
 */
export const canAddCompany = (companies: CompanySummary[]) => {
  const owned = companies.filter((c) => c.role === 'owner');
  return owned.length === 0 || owned.some((c) => c.plan === 'business' || c.plan === 'team');
};

/** Begrenzte Arten in Anzeigereihenfolge, mit Bezeichnung (Einzahl/Mehrzahl). */
export const USAGE_KINDS: { kind: UsageKind; one: string; many: string }[] = [
  { kind: 'invoice', one: 'Rechnung', many: 'Rechnungen' },
  { kind: 'offer', one: 'Angebot', many: 'Angebote' },
  { kind: 'confirmation', one: 'Auftragsbestätigung', many: 'Auftragsbestätigungen' },
  { kind: 'delivery', one: 'Lieferschein', many: 'Lieferscheine' },
  { kind: 'order', one: 'Bestellung', many: 'Bestellungen' },
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
    features: ['Je 10 Belege jeder Art, Kunden, Artikel und Buchungen pro Monat', 'Angebote, Auftragsbestätigungen, Lieferscheine, Rechnungen & Bestellungen als PDF', 'Kunden, Material & Lager', 'Eine Firma'],
    cta: 'Kostenlos starten',
  },
  {
    id: 'solo',
    name: 'Solo',
    monthly: 9.9,
    yearly: 7.9,
    text: 'Für Selbstständige mit regelmäßigen Aufträgen.',
    features: ['Je 50 Belege jeder Art, Kunden, Artikel und Buchungen pro Monat', 'Angebote, Auftragsbestätigungen, Lieferscheine, Rechnungen & Bestellungen als PDF', 'Kunden, Material & Lager', 'Eine Firma'],
    cta: 'Solo buchen',
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 24.9,
    yearly: 19.9,
    text: 'Für Betriebe, die ihre Zahlen im Griff haben wollen.',
    features: ['Unbegrenzt Belege, Kunden & Artikel', 'Mehrere Firmen unter einem Login', 'Eigenes Rechnungsdesign mit Logo', 'Logo-Hintergrund automatisch entfernen', 'GuV, Umsatzsteuer & DATEV-Export', 'E-Mail-Versand & Lager-Scanner', 'E-Mail-Support'],
    cta: 'Business buchen',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 49.9,
    yearly: 39.9,
    text: 'Für Teams mit Büro und mehreren Mitarbeitenden.',
    features: ['Alles aus Business', 'Bis zu 5 Benutzer je Firma', 'Rollen: Inhaber, Admin, Mitarbeiter', 'Persönliches Onboarding', 'Telefon-Support'],
    cta: 'Team buchen',
  },
];


export const PAID_PLANS: PaidPlan[] = ['solo', 'business', 'team'];

/** Preis im deutschen Format: 0 → „0“, 9.9 → „9,90“, 24 → „24“. */
export const formatPlanPrice = (price: number) =>
  price.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(price) ? 0 : 2, maximumFractionDigits: 2 });

/** Nächstgrößerer Tarif mit höherem Monatslimit (für Upgrade-Hinweise). */
export const nextPlanForLimits = (plan: PlanId): PaidPlan | null => (plan === 'start' ? 'solo' : plan === 'solo' ? 'business' : null);

/* ---------------------------------------------------------------------------
 * Funktionen je Tarif
 * Nicht enthaltene Funktionen bleiben sichtbar (mit Schloss); ein Klick öffnet „Jetzt upgraden“.
 * ------------------------------------------------------------------------- */
export type Feature = 'design' | 'logoBackground' | 'reports' | 'datev' | 'email' | 'scanner' | 'companies' | 'team' | 'ai';

export const FEATURES: Record<Feature, { label: string; plan: 'business' | 'team'; text: string }> = {
  design: { label: 'Dokumentenlayout & Standardtexte', plan: 'business', text: 'Farben, Schrift, Logo-Position, Aufbau und Standardtexte aller Belege frei gestalten.' },
  logoBackground: { label: 'Logo-Hintergrund entfernen', plan: 'business', text: 'Den Hintergrund Ihres Logos automatisch freistellen – für saubere Rechnungen.' },
  reports: { label: 'GuV & Finanzen', plan: 'business', text: 'Gewinn und Verlust, Umsatzsteuer und Auswertungen nach Monat, Quartal und Jahr.' },
  datev: { label: 'DATEV-Export', plan: 'business', text: 'Buchungsstapel für Ihre Steuerberatung mit einem Klick erzeugen.' },
  email: { label: 'E-Mail-Versand', plan: 'business', text: 'Angebote, Rechnungen und alle weiteren Belege direkt aus VYSNER One per E-Mail versenden – mit PDF im Anhang.' },
  scanner: { label: 'Lager-Scanner & QR-Etiketten', plan: 'business', text: 'Regale und Artikel mit QR-Codes versehen und per Handy ein- und auslagern.' },
  companies: { label: 'Mehrere Firmen', plan: 'business', text: 'Mehrere Firmen unter einem Login – jede mit eigenen Kunden, Nummern und eigenem Design.' },
  ai: { label: 'KI-Sprachassistent', plan: 'business', text: 'Angebote und Rechnungen per Sprachmemo erstellen – die KI findet Kunden und Artikel, fragt bei Unklarheiten nach und legt den Entwurf nach Ihrer Bestätigung an.' },
  team: { label: 'Team & Rechte', plan: 'team', text: 'Bis zu 5 Personen je Firma einladen – mit Rollen für Inhaber, Admin und Mitarbeiter.' },
};

const PLAN_RANK: Record<PlanId, number> = { start: 0, solo: 1, business: 2, team: 3 };

export const hasFeature = (plan: PlanId, feature: Feature) => PLAN_RANK[plan] >= PLAN_RANK[FEATURES[feature].plan];

/** Seiten, die eine Funktion voraussetzen. */
export const FEATURE_PATHS: [string, Feature][] = [
  ['/app/guv', 'reports'],
  ['/app/export', 'datev'],
  ['/app/scan', 'scanner'],
  ['/app/team', 'team'],
];

export const featureForPath = (pathname: string): Feature | null =>
  FEATURE_PATHS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? null;

/** Upgrade-Hinweis: Monatslimit einer Art oder fehlende Funktion. */
export type UpgradeTopic = UsageKind | Feature;
export const isFeature = (topic: UpgradeTopic): topic is Feature => topic in FEATURES;

/* Tarifwechsel: teurer sofort, günstiger zum Laufzeitende (siehe lib/server/billing.ts) */
type PlanChoice = { plan: PlanId; interval: 'monthly' | 'yearly' };

/** true = Wechsel gilt sofort (höherer Tarif oder monatlich → jährlich), false = zum Laufzeitende */
export function isUpgrade(from: PlanChoice, to: PlanChoice) {
  if (PLAN_RANK[to.plan] !== PLAN_RANK[from.plan]) return PLAN_RANK[to.plan] > PLAN_RANK[from.plan];
  return from.interval === 'monthly' && to.interval === 'yearly';
}
