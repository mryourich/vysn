export type PlanId = 'start' | 'business' | 'team';

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
  movements: StockMovement[];
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
};

export type DocKind = 'offer' | 'invoice';
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

export type Expense = {
  id: string;
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
};

/** Kurzinfo einer Firma für den Firmenwechsler */
export type CompanySummary = { id: string; name: string; logo: string; plan: PlanId; role?: string };

export type Data = {
  version: 1;
  company: Company | null;
  customers: Customer[];
  materials: Material[];
  documents: SalesDoc[];
  expenses: Expense[];
  design: InvoiceDesign;
  counters: { invoice: Record<string, number>; offer: Record<string, number>; customer: number; material: number };
};
