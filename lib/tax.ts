import type { Company } from './types';

export type CountryCode = 'DE' | 'AT' | 'CH';

type TaxProfile = {
  code: CountryCode | 'OTHER';
  /** Voreingestellte Steuersätze in % (weitere Werte können frei eingegeben werden) */
  rates: number[];
  defaultRate: number;
  /** Kurzbezeichnung auf Belegen, z. B. „USt.“ oder „MWST“ */
  label: string;
  longLabel: string;
  inputTaxLabel: string;
  idLabel: string;
  idPlaceholder: string;
  taxNumberLabel: string;
  /** Kurzform in der Fußzeile */
  taxNumberShort: string;
  smallBusinessLabel: string;
  smallBusinessHint: string;
  /** Pflichthinweis auf Rechnungen ohne Steuerausweis */
  smallBusinessNote: string;
  currency: 'EUR' | 'CHF';
  legalHint: string;
};

export const TAX_PROFILES: Record<CountryCode | 'OTHER', TaxProfile> = {
  DE: {
    code: 'DE', rates: [19, 7, 0], defaultRate: 19,
    label: 'USt.', longLabel: 'Umsatzsteuer', inputTaxLabel: 'Vorsteuer',
    idLabel: 'USt-IdNr.', idPlaceholder: 'DE123456789', taxNumberLabel: 'Steuernummer', taxNumberShort: 'St.-Nr.',
    smallBusinessLabel: 'Kleinunternehmer nach § 19 UStG',
    smallBusinessHint: 'Auf Rechnungen wird keine Umsatzsteuer ausgewiesen, der passende Hinweis wird automatisch ergänzt.',
    smallBusinessNote: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
    currency: 'EUR', legalHint: 'Pflichtangaben für ordnungsgemäße Rechnungen nach § 14 UStG.',
  },
  AT: {
    code: 'AT', rates: [20, 13, 10, 0], defaultRate: 20,
    label: 'USt.', longLabel: 'Umsatzsteuer', inputTaxLabel: 'Vorsteuer',
    idLabel: 'UID-Nr.', idPlaceholder: 'ATU12345678', taxNumberLabel: 'Steuernummer', taxNumberShort: 'St.-Nr.',
    smallBusinessLabel: 'Kleinunternehmer nach § 6 Abs. 1 Z 27 UStG',
    smallBusinessHint: 'Auf Rechnungen wird keine Umsatzsteuer ausgewiesen, der Hinweis auf die Steuerbefreiung wird automatisch ergänzt.',
    smallBusinessNote: 'Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG.',
    currency: 'EUR', legalHint: 'Pflichtangaben für ordnungsgemäße Rechnungen nach § 11 UStG (Österreich).',
  },
  CH: {
    code: 'CH', rates: [8.1, 3.8, 2.6, 0], defaultRate: 8.1,
    label: 'MWST', longLabel: 'Mehrwertsteuer', inputTaxLabel: 'Vorsteuer',
    idLabel: 'MWST-Nr. / UID', idPlaceholder: 'CHE-123.456.789 MWST', taxNumberLabel: 'Unternehmens-ID (UID)', taxNumberShort: 'UID',
    smallBusinessLabel: 'Nicht mehrwertsteuerpflichtig',
    smallBusinessHint: 'Zum Beispiel bei einem Jahresumsatz unter CHF 100 000. Auf Rechnungen wird keine MWST ausgewiesen.',
    smallBusinessNote: 'Nicht mehrwertsteuerpflichtig – es wird keine MWST berechnet.',
    currency: 'CHF', legalHint: 'Angaben für ordnungsgemäße Rechnungen nach Art. 26 MWSTG (Schweiz).',
  },
  OTHER: {
    code: 'OTHER', rates: [20, 10, 0], defaultRate: 20,
    label: 'USt.', longLabel: 'Umsatzsteuer', inputTaxLabel: 'Vorsteuer',
    idLabel: 'USt-IdNr.', idPlaceholder: '', taxNumberLabel: 'Steuernummer', taxNumberShort: 'St.-Nr.',
    smallBusinessLabel: 'Steuerbefreit / Kleinunternehmer',
    smallBusinessHint: 'Auf Rechnungen wird keine Umsatzsteuer ausgewiesen.',
    smallBusinessNote: 'Es wird keine Umsatzsteuer berechnet.',
    currency: 'EUR', legalHint: 'Firmen- und Steuerangaben für Ihre Rechnungen.',
  },
};

export const COUNTRY_OPTIONS: [string, CountryCode][] = [['Deutschland', 'DE'], ['Österreich', 'AT'], ['Schweiz', 'CH']];

export function countryCode(country: string | undefined): CountryCode | null {
  const c = (country || '').trim().toLowerCase();
  if (!c || ['deutschland', 'germany', 'de', 'd'].includes(c)) return 'DE';
  if (['österreich', 'oesterreich', 'austria', 'at', 'a'].includes(c)) return 'AT';
  if (['schweiz', 'switzerland', 'suisse', 'svizzera', 'ch', 'liechtenstein', 'li'].includes(c)) return 'CH';
  return null;
}

export function taxProfile(company: Pick<Company, 'country'> | null | undefined): TaxProfile {
  return TAX_PROFILES[countryCode(company?.country) ?? 'OTHER'];
}

/** Voreinstellungen plus der aktuell verwendete (ggf. eigene) Satz, absteigend sortiert. */
export function vatChoices(company: Pick<Company, 'country'> | null | undefined, current?: number) {
  const set = new Set(taxProfile(company).rates);
  if (current !== undefined && Number.isFinite(current)) set.add(current);
  return [...set].sort((a, b) => b - a);
}

export const formatRate = (rate: number) => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(rate)} %`;
