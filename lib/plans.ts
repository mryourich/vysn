import { MONTHS_LONG, today } from './calc';
import type { Data, PlanId } from './types';

/** Tarife – Preise und Texte der Startseite stehen in components/site/pricing.tsx. */
export const PLANS: Record<PlanId, { label: string; invoicesPerMonth: number | null }> = {
  start: { label: 'Start', invoicesPerMonth: 10 },
  business: { label: 'Business', invoicesPerMonth: null },
  team: { label: 'Team', invoicesPerMonth: null },
};

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
