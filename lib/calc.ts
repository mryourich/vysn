import type { Data, Expense, LineItem, SalesDoc } from './types';

const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

/** Währung der geöffneten Firma (EUR für DE/AT, CHF für die Schweiz) – wird vom Store gesetzt. */
let currency: 'EUR' | 'CHF' = 'EUR';
const formatters: Record<string, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
  CHF: new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }),
};
export const setCurrency = (c: 'EUR' | 'CHF') => {
  currency = c;
};
export const currencySymbol = () => (currency === 'CHF' ? 'CHF' : '€');

export const money = (value: number) => formatters[currency].format(Number.isFinite(value) ? value : 0);
export const qty = (value: number) => num.format(Number.isFinite(value) ? value : 0);
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const today = () => toISO(new Date());
export const toISO = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
};
export const formatDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};
export const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Parses user input like "1.234,50" or "12.5" into a number. */
export const parseNumber = (input: string) => {
  const s = input.trim();
  if (!s) return 0;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const lineNet = (item: LineItem) => round2(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100));

export type Totals = { net: number; vat: number; gross: number; vatGroups: { rate: number; net: number; vat: number }[] };

export function docTotals(items: LineItem[], smallBusiness: boolean): Totals {
  const groups = new Map<number, number>();
  let net = 0;
  for (const item of items) {
    const n = lineNet(item);
    net += n;
    const rate = smallBusiness ? 0 : item.vat;
    groups.set(rate, (groups.get(rate) || 0) + n);
  }
  const vatGroups = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, groupNet]) => ({ rate, net: round2(groupNet), vat: round2((groupNet * rate) / 100) }));
  const vat = round2(vatGroups.reduce((s, g) => s + g.vat, 0));
  net = round2(net);
  return { net, vat, gross: round2(net + vat), vatGroups };
}

export const expenseGross = (e: Expense) => round2(e.net * (1 + e.vat / 100));
export const expenseVat = (e: Expense) => round2((e.net * e.vat) / 100);

export type DisplayStatus = { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' };

export function isOverdue(doc: SalesDoc) {
  return doc.kind === 'invoice' && doc.status === 'sent' && !!doc.dueDate && doc.dueDate < today();
}

export function displayStatus(doc: SalesDoc): DisplayStatus {
  if (doc.kind === 'invoice') {
    if (isOverdue(doc)) return { label: 'Überfällig', tone: 'danger' };
    switch (doc.status) {
      case 'draft': return { label: 'Entwurf', tone: 'neutral' };
      case 'sent': return { label: 'Offen', tone: 'info' };
      case 'paid': return { label: 'Bezahlt', tone: 'success' };
      case 'cancelled': return { label: 'Storniert', tone: 'neutral' };
    }
  }
  switch (doc.status) {
    case 'draft': return { label: 'Entwurf', tone: 'neutral' };
    case 'sent': return { label: 'Versendet', tone: 'info' };
    case 'accepted': return { label: 'Angenommen', tone: 'success' };
    case 'declined': return { label: 'Abgelehnt', tone: 'danger' };
  }
  return { label: doc.status, tone: 'neutral' };
}

export type Period = { from: string; to: string; label: string };

export function periodFor(year: number, mode: 'year' | 'q1' | 'q2' | 'q3' | 'q4' | number): Period {
  if (mode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Geschäftsjahr ${year}` };
  if (typeof mode === 'number') {
    const m = String(mode + 1).padStart(2, '0');
    const last = new Date(year, mode + 1, 0).getDate();
    return { from: `${year}-${m}-01`, to: `${year}-${m}-${last}`, label: `${MONTHS_LONG[mode]} ${year}` };
  }
  const q = Number(mode[1]);
  const startMonth = (q - 1) * 3;
  const last = new Date(year, startMonth + 3, 0).getDate();
  return {
    from: `${year}-${String(startMonth + 1).padStart(2, '0')}-01`,
    to: `${year}-${String(startMonth + 3).padStart(2, '0')}-${last}`,
    label: `${q}. Quartal ${year}`,
  };
}

export type Basis = 'cash' | 'accrual';

/** Date on which an invoice counts as revenue: payment date (Ist) or invoice date (Soll). */
export function revenueDate(doc: SalesDoc, basis: Basis) {
  if (doc.kind !== 'invoice' || doc.status === 'draft' || doc.status === 'cancelled') return '';
  if (basis === 'cash') return doc.status === 'paid' ? doc.paidDate || doc.date : '';
  return doc.date;
}

const COST_OF_SALES = ['Material & Waren', 'Fremdleistungen'];
/** Einnahme-Kategorien, die als Umsatzerlöse zählen; alle anderen sind sonstige Erträge. */
export const REVENUE_INCOME = ['Umsatz ohne Rechnung', 'Barverkauf'];

export type ProfitLoss = {
  revenue: number;
  /** Erträge ohne Rechnung, die nicht Umsatz sind (Zinsen, Zuschüsse …) */
  otherIncome: { category: string; amount: number }[];
  otherIncomeTotal: number;
  outputVat: number;
  invoices: number;
  costOfSales: { category: string; amount: number }[];
  costOfSalesTotal: number;
  grossProfit: number;
  operating: { category: string; amount: number }[];
  operatingTotal: number;
  result: number;
  inputVat: number;
  vatPayable: number;
  margin: number;
};

export function profitLoss(data: Data, period: Period, basis: Basis): ProfitLoss {
  const small = !!data.company?.smallBusiness;
  let revenue = 0;
  let outputVat = 0;
  let invoices = 0;
  for (const doc of data.documents) {
    const d = revenueDate(doc, basis);
    if (!d || d < period.from || d > period.to) continue;
    const t = docTotals(doc.items, small);
    revenue += t.net;
    outputVat += t.vat;
    invoices++;
  }
  const byCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();
  let inputVat = 0;
  for (const e of data.expenses) {
    if (e.date < period.from || e.date > period.to) continue;
    if (e.kind === 'income') {
      // Kleinunternehmer weisen keine Steuer aus: Ertrag ist der Bruttobetrag.
      const amount = small ? expenseGross(e) : e.net;
      if (!small) outputVat += expenseVat(e);
      if (REVENUE_INCOME.includes(e.category)) revenue += amount;
      else incomeByCategory.set(e.category, (incomeByCategory.get(e.category) || 0) + amount);
      continue;
    }
    // Kleinunternehmer können keine Vorsteuer ziehen: Aufwand ist dann der Bruttobetrag.
    const amount = small ? expenseGross(e) : e.net;
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + amount);
    if (!small) inputVat += expenseVat(e);
  }
  const rows = [...byCategory.entries()].map(([category, amount]) => ({ category, amount: round2(amount) }));
  const costOfSales = rows.filter((r) => COST_OF_SALES.includes(r.category)).sort((a, b) => b.amount - a.amount);
  const operating = rows.filter((r) => !COST_OF_SALES.includes(r.category)).sort((a, b) => b.amount - a.amount);
  const costOfSalesTotal = round2(costOfSales.reduce((s, r) => s + r.amount, 0));
  const operatingTotal = round2(operating.reduce((s, r) => s + r.amount, 0));
  revenue = round2(revenue);
  const otherIncome = [...incomeByCategory.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
  const otherIncomeTotal = round2(otherIncome.reduce((s, r) => s + r.amount, 0));
  const grossProfit = round2(revenue - costOfSalesTotal);
  const result = round2(grossProfit + otherIncomeTotal - operatingTotal);
  return {
    revenue,
    otherIncome,
    otherIncomeTotal,
    outputVat: round2(outputVat),
    invoices,
    costOfSales,
    costOfSalesTotal,
    grossProfit,
    operating,
    operatingTotal,
    result,
    inputVat: round2(inputVat),
    vatPayable: round2(outputVat - inputVat),
    margin: revenue ? result / revenue : 0,
  };
}

/** Revenue and expenses per month for a given year (net amounts). */
export function monthlySeries(data: Data, year: number, basis: Basis) {
  const small = !!data.company?.smallBusiness;
  const rows = MONTHS.map((label) => ({ label, revenue: 0, expenses: 0 }));
  for (const doc of data.documents) {
    const d = revenueDate(doc, basis);
    if (!d || !d.startsWith(String(year))) continue;
    rows[Number(d.slice(5, 7)) - 1].revenue += docTotals(doc.items, small).net;
  }
  for (const e of data.expenses) {
    if (!e.date.startsWith(String(year))) continue;
    const amount = small ? expenseGross(e) : e.net;
    if (e.kind === 'income') rows[Number(e.date.slice(5, 7)) - 1].revenue += amount;
    else rows[Number(e.date.slice(5, 7)) - 1].expenses += amount;
  }
  return rows.map((r) => ({ ...r, revenue: round2(r.revenue), expenses: round2(r.expenses), result: round2(r.revenue - r.expenses) }));
}

export function companyAddressLine(data: Data) {
  const c = data.company;
  if (!c) return '';
  return [c.name, c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}
