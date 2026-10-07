import { docTotals, expenseGross, expenseVat, round2 } from './calc';
import type { Period } from './calc';
import { REVENUE_INCOME } from './calc';
import type { Data, DatevSettings, Expense } from './types';

/**
 * DATEV-Export im Format „Buchungsstapel“ (EXTF, Version 700, Kategorie 21).
 * Die Kontenzuordnung folgt den DATEV-Standardkontenrahmen SKR03/SKR04 und
 * kann je Firma überschrieben werden. Bitte die Zuordnung mit der
 * Steuerberatung abstimmen – sie prüft den Import vor dem Festschreiben.
 */

type AccountKey =
  | 'bank' | 'cash' | 'debtor'
  | 'revenue19' | 'revenue7' | 'revenue0' | 'revenueSmall'
  | 'otherIncome' | 'interest'
  | `expense:${string}` | `goods${'19' | '7' | '0'}`;

export const ACCOUNT_LABELS: [AccountKey, string][] = [
  ['bank', 'Bank'],
  ['cash', 'Kasse (Barverkauf)'],
  ['debtor', 'Sammeldebitor / Debitoren ab'],
  ['revenue19', 'Erlöse 19 % USt'],
  ['revenue7', 'Erlöse 7 % USt'],
  ['revenue0', 'Erlöse steuerfrei / 0 %'],
  ['revenueSmall', 'Erlöse Kleinunternehmer § 19 UStG'],
  ['otherIncome', 'Sonstige Erträge'],
  ['interest', 'Zinserträge'],
  ['goods19', 'Wareneingang 19 % Vorsteuer'],
  ['goods7', 'Wareneingang 7 % Vorsteuer'],
  ['goods0', 'Wareneingang ohne Vorsteuer'],
  ['expense:Fremdleistungen', 'Fremdleistungen'],
  ['expense:Personal', 'Löhne & Gehälter'],
  ['expense:Miete & Nebenkosten', 'Miete & Nebenkosten'],
  ['expense:Fahrzeug', 'Fahrzeugkosten'],
  ['expense:Büro & Software', 'Bürobedarf & Software'],
  ['expense:Versicherungen', 'Versicherungen'],
  ['expense:Marketing', 'Werbekosten'],
  ['expense:Reisekosten', 'Reisekosten'],
  ['expense:Sonstiges', 'Sonstige Kosten'],
];

const DEFAULTS: Record<'SKR03' | 'SKR04', Record<string, string>> = {
  SKR03: {
    bank: '1200', cash: '1000', debtor: '10000',
    revenue19: '8400', revenue7: '8300', revenue0: '8200', revenueSmall: '8195',
    otherIncome: '2700', interest: '2650',
    goods19: '3400', goods7: '3300', goods0: '3200',
    'expense:Fremdleistungen': '3100', 'expense:Personal': '4120', 'expense:Miete & Nebenkosten': '4210',
    'expense:Fahrzeug': '4530', 'expense:Büro & Software': '4930', 'expense:Versicherungen': '4360',
    'expense:Marketing': '4600', 'expense:Reisekosten': '4660', 'expense:Sonstiges': '4900',
  },
  SKR04: {
    bank: '1800', cash: '1600', debtor: '10000',
    revenue19: '4400', revenue7: '4300', revenue0: '4200', revenueSmall: '4185',
    otherIncome: '4830', interest: '7100',
    goods19: '5400', goods7: '5300', goods0: '5200',
    'expense:Fremdleistungen': '5900', 'expense:Personal': '6020', 'expense:Miete & Nebenkosten': '6310',
    'expense:Fahrzeug': '6530', 'expense:Büro & Software': '6815', 'expense:Versicherungen': '6400',
    'expense:Marketing': '6600', 'expense:Reisekosten': '6650', 'expense:Sonstiges': '6300',
  },
};

/** Automatikkonten (Steuer wird von DATEV selbst berechnet → kein BU-Schlüssel). */
const AUTOMATIC = new Set(['revenue19', 'revenue7', 'goods19', 'goods7']);

export const defaultAccount = (chart: 'SKR03' | 'SKR04', key: string) => DEFAULTS[chart][key] || '';
export const account = (s: DatevSettings, key: string) => s.accounts[key]?.trim() || defaultAccount(s.chart, key);

export type Booking = {
  amount: number;
  /** S = Konto im Soll */
  side: 'S' | 'H';
  account: string;
  contra: string;
  buKey: string;
  date: string;
  receipt: string;
  text: string;
};

const revenueKey = (rate: number, small: boolean) => (small ? 'revenueSmall' : rate >= 19 ? 'revenue19' : rate >= 7 ? 'revenue7' : 'revenue0');

/** Ausgangssteuer-BU-Schlüssel für Nicht-Automatikkonten */
const outputBu = (rate: number) => (rate >= 19 ? '3' : rate >= 7 ? '2' : '');
/** Vorsteuer-BU-Schlüssel */
const inputBu = (rate: number) => (rate >= 19 ? '9' : rate >= 7 ? '8' : '');

function debtorAccount(data: Data, customerId: string) {
  const s = data.settings.datev;
  const base = Number(account(s, 'debtor')) || 10000;
  if (!s.debtorPerCustomer) return String(base);
  const c = data.customers.find((x) => x.id === customerId);
  const n = Number((c?.number || '').replace(/\D/g, ''));
  return n ? String(base + n) : String(base);
}

export function datevBookings(data: Data, period: Period): Booking[] {
  const s = data.settings.datev;
  const small = !!data.company?.smallBusiness;
  const out: Booking[] = [];
  const inRange = (d: string) => !!d && d >= period.from && d <= period.to;

  for (const doc of data.documents) {
    if (doc.kind !== 'invoice' || doc.status === 'draft' || doc.status === 'cancelled') continue;
    const debtor = debtorAccount(data, doc.customerId);
    const t = docTotals(doc.items, small);
    if (inRange(doc.date)) {
      for (const g of t.vatGroups) {
        const key = revenueKey(g.rate, small);
        out.push({
          amount: round2(g.net + g.vat), side: 'S', account: debtor, contra: account(s, key),
          buKey: AUTOMATIC.has(key) || small ? '' : outputBu(g.rate), date: doc.date, receipt: doc.number,
          text: `${doc.recipient.name || 'Rechnung'}`.slice(0, 60),
        });
      }
    }
    if (doc.status === 'paid' && inRange(doc.paidDate)) {
      out.push({ amount: t.gross, side: 'S', account: account(s, 'bank'), contra: debtor, buKey: '', date: doc.paidDate, receipt: doc.number, text: `Zahlung ${doc.number}`.slice(0, 60) });
    }
  }

  for (const e of data.expenses) {
    if (!inRange(e.date)) continue;
    out.push(expenseBooking(data, e));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.receipt.localeCompare(b.receipt));
}

function expenseBooking(data: Data, e: Expense): Booking {
  const s = data.settings.datev;
  const small = !!data.company?.smallBusiness;
  const gross = small ? round2(e.net * (1 + e.vat / 100)) : expenseGross(e);
  const text = [e.supplier, e.description].filter(Boolean).join(' – ').slice(0, 60);
  if (e.kind === 'income') {
    const isRevenue = REVENUE_INCOME.includes(e.category);
    const key = isRevenue ? revenueKey(e.vat, small) : e.category === 'Zinserträge' ? 'interest' : 'otherIncome';
    const bu = small || AUTOMATIC.has(key) || !expenseVat(e) ? '' : outputBu(e.vat);
    return { amount: gross, side: 'S', account: account(s, e.category === 'Barverkauf' ? 'cash' : 'bank'), contra: account(s, key), buKey: bu, date: e.date, receipt: e.receiptNo, text };
  }
  const key = e.category === 'Material & Waren' ? (small ? 'goods0' : e.vat >= 19 ? 'goods19' : e.vat >= 7 ? 'goods7' : 'goods0') : `expense:${e.category}`;
  const bu = small || AUTOMATIC.has(key) ? '' : inputBu(e.vat);
  return { amount: gross, side: 'S', account: account(s, key) || account(s, 'expense:Sonstiges'), contra: account(s, 'bank'), buKey: bu, date: e.date, receipt: e.receiptNo, text };
}

const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
const num = (v: number) => v.toFixed(2).replace('.', ',');
const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
const ymd = (iso: string) => iso.replace(/-/g, '');
/** Belegfeld 1: DATEV erlaubt nur bestimmte Zeichen, max. 36 */
const receiptField = (v: string) => v.replace(/[^A-Za-z0-9$&%*+\-/.]/g, '').slice(0, 36);

export function datevCsv(data: Data, period: Period, bookings = datevBookings(data, period)) {
  const s = data.settings.datev;
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}000`;
  const year = period.from.slice(0, 4);
  const [fyMonth, fyDay] = (s.fiscalYearStart || '01-01').split('-');
  const header = [
    q('EXTF'), '700', '21', q('Buchungsstapel'), '13', stamp, '', q('RE'), q('VYSNER One'), q(''),
    s.advisorNumber || '', s.clientNumber || '', `${year}${fyMonth}${fyDay}`, String(s.accountLength || 4),
    ymd(period.from), ymd(period.to), q(`VYSNER ${period.label}`.slice(0, 30)), q(''), '1', '0', '0', q('EUR'),
    '', q(''), '', '', q(s.chart === 'SKR04' ? '04' : '03'), '', '', '', q(''),
  ].join(';');
  const columns = [
    'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz',
    'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
  ].join(';');
  const rows = bookings.map((b) => [
    num(b.amount), q(b.side), q('EUR'), '', '', '', b.account, b.contra, q(b.buKey), ddmm(b.date), q(receiptField(b.receipt)), q(''), '', q(b.text),
  ].join(';'));
  return [header, columns, ...rows].join('\r\n') + '\r\n';
}

/** DATEV erwartet ANSI (Windows-1252). */
export function toWindows1252(text: string): Uint8Array {
  const special: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97 };
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    out[i] = special[ch] ?? (code < 256 ? code : 0x3f);
  }
  return out;
}
