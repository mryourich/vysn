export type PlanId = 'start' | 'solo' | 'business' | 'team';
/** Kostenpflichtige Tarife (über Stripe buchbar). */
export type PaidPlan = Exclude<PlanId, 'start'>;

export type Company = {
  /** Tarif – in Supabase serverseitig verwaltet, lokal frei wählbar (Testmodus) */
  plan: PlanId;
  name: string;
  owner: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  bankName: string;
  iban: string;
  bic: string;
  logo: string;
  logoRatio: number;
  smallBusiness: boolean;
  defaultVat: number;
  paymentTermDays: number;
  offerValidityDays: number;
  invoicePrefix: string;
  offerPrefix: string;
  /** Abo-Status (nur lesend, wird vom Server/Stripe gepflegt) */
  billing?: Billing;
};

export type Billing = {
  status: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | string;
  trialEndsAt: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  trialUsed: boolean;
  /** Zahlungsrhythmus des laufenden Abos */
  interval: 'monthly' | 'yearly' | '';
  /** Vorgemerkter Wechsel zum Laufzeitende ('start' = gekündigt) */
  pendingPlan: PlanId | '';
  pendingInterval: 'monthly' | 'yearly' | '';
  pendingAt: string;
};

export type Customer = {
  id: string;
  number: string;
  name: string;
  contactPerson: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  vatId: string;
  notes: string;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  date: string;
  quantity: number;
  note: string;
};

export type Material = {
  id: string;
  number: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  vat: number;
  stock: number;
  minStock: number;
  /** Lagerplatz (Regal/Fach), leer = ohne festen Platz */
  locationId: string;
  movements: StockMovement[];
};

/** Lagerplatz, z. B. Regal A – Fach 3. Erhält ein QR-Etikett zum Scannen. */
export type StorageLocation = {
  id: string;
  code: string;
  name: string;
  note: string;
};

export type LineItem = {
  id: string;
  materialId?: string;
  description: string;
  details: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vat: number;
  discount: number;
  /** Angebot: optionale Position bzw. Alternative – nicht in der Angebotssumme enthalten */
  variant?: 'optional' | 'alternative';
  /** Vom Kunden gewählt: wird beim Umwandeln (Auftragsbestätigung/Rechnung) als normale Position übernommen */
  chosen?: boolean;
};

/** Belegarten: Angebot, Auftragsbestätigung, Lieferschein, Rechnung, Bestellung (an Lieferanten). */
export type DocKind = 'offer' | 'confirmation' | 'delivery' | 'invoice' | 'order';
export const DOC_KIND_LIST: DocKind[] = ['offer', 'confirmation', 'delivery', 'invoice', 'order'];
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'declined';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export type Recipient = {
  name: string;
  contactPerson: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  vatId: string;
};

export type SalesDoc = {
  id: string;
  kind: DocKind;
  number: string;
  status: OfferStatus | InvoiceStatus;
  customerId: string;
  recipient: Recipient;
  subject: string;
  date: string;
  dueDate: string;
  serviceDate: string;
  intro: string;
  outro: string;
  items: LineItem[];
  paidDate: string;
  sourceId: string;
  stockBooked: boolean;
  createdAt: string;
  /** Letzter E-Mail-Versand */
  sentAt: string;
  sentTo: string;
};

export const EXPENSE_CATEGORIES = [
  'Material & Waren',
  'Fremdleistungen',
  'Personal',
  'Miete & Nebenkosten',
  'Fahrzeug',
  'Büro & Software',
  'Versicherungen',
  'Marketing',
  'Reisekosten',
  'Sonstiges',
] as const;

export const INCOME_CATEGORIES = [
  'Umsatz ohne Rechnung',
  'Barverkauf',
  'Zinserträge',
  'Fördermittel & Zuschüsse',
  'Erstattungen',
  'Sonstige Erträge',
] as const;

/** Buchung außerhalb der Rechnungen: Ausgabe (Beleg) oder Einnahme (z. B. Barverkauf). */
export type Expense = {
  id: string;
  kind: 'expense' | 'income';
  date: string;
  supplier: string;
  description: string;
  category: string;
  net: number;
  vat: number;
  receiptNo: string;
};

export type InvoiceDesign = {
  layout: 'classic' | 'modern' | 'minimal';
  accent: string;
  font: 'Helvetica' | 'Times-Roman' | 'Courier';
  logoPosition: 'left' | 'right';
  logoSize: number;
  tableStyle: 'lines' | 'striped' | 'boxed';
  showSenderLine: boolean;
  showPositions: boolean;
  showFooter: boolean;
  showPageNumbers: boolean;
  invoiceIntro: string;
  invoiceOutro: string;
  offerIntro: string;
  offerOutro: string;
  /** Standardtexte weiterer Belegarten (leer = Vorgabe aus lib/docs.ts) */
  texts?: Partial<Record<DocKind, { intro: string; outro: string }>>;
};

export type DatevSettings = {
  advisorNumber: string;
  clientNumber: string;
  chart: 'SKR03' | 'SKR04';
  fiscalYearStart: string;
  accountLength: number;
  /** true = je Kunde ein Debitorenkonto (10000 + Kundennummer), sonst Sammeldebitor */
  debtorPerCustomer: boolean;
  /** Kontonummern, die vom Standard abweichen (Schlüssel siehe lib/datev.ts) */
  accounts: Record<string, string>;
};

export type EmailSettings = {
  /** Rechnungen beim Festschreiben automatisch an den Kunden senden */
  autoSendInvoices: boolean;
  bcc: string;
  invoiceSubject: string;
  invoiceBody: string;
  offerSubject: string;
  offerBody: string;
  /** Vorlagen der weiteren Belegarten (Auftragsbestätigung, Lieferschein, Bestellung) */
  templates?: Partial<Record<DocKind, { subject: string; body: string }>>;
};

/** Nummernkreis-Präfixe weiterer Belegarten (Rechnung/Angebot stehen in den Firmendaten) */
export type NumberSettings = { prefixes: Partial<Record<DocKind, string>> };

export type Settings = { datev: DatevSettings; email: EmailSettings; numbers: NumberSettings };

/** Kurzinfo einer Firma für den Firmenwechsler */
export type CompanySummary = { id: string; name: string; logo: string; plan: PlanId; role?: string };

/** Arten, die je Tarif pro Monat begrenzt sind. */
export type UsageKind = DocKind | 'customer' | 'material' | 'booking';
/** Im laufenden Monat angelegte Elemente (gelöschte zählen mit). `month` = „YYYY-MM“. */
export type Usage = { month: string; counts: Partial<Record<UsageKind, number>> };

export type Data = {
  version: 1;
  company: Company | null;
  customers: Customer[];
  materials: Material[];
  documents: SalesDoc[];
  expenses: Expense[];
  locations: StorageLocation[];
  design: InvoiceDesign;
  settings: Settings;
  counters: Record<DocKind, Record<string, number>> & { customer: number; material: number };
  /** Monatsnutzung für Tariflimits – wird vom Server geführt, nicht vom Client gespeichert. */
  usage: Usage;
};
