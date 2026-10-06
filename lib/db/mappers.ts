import { defaultDesign, emptyCompany } from '../defaults';
import { defaultSettings } from '../defaults';
import type { Company, Customer, Expense, InvoiceDesign, LineItem, Material, Recipient, SalesDoc, Settings, StockMovement, StorageLocation } from '../types';

/*
 * Conversion between the app model (camelCase, '' for empty dates) and the
 * database rows (snake_case, NULL for empty dates). Column names match
 * supabase/migrations/*_init.sql.
 */

type Row = Record<string, unknown>;

const dateOrNull = (v: string) => (v ? v : null);
const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v));

/** `plan` wird bewusst nicht geschrieben – der Tarif wird serverseitig gepflegt. */
export const companyToRow = (c: Company, design: InvoiceDesign, settings: Settings): Row => ({
  settings,
  name: c.name,
  owner: c.owner,
  street: c.street,
  zip: c.zip,
  city: c.city,
  country: c.country,
  email: c.email,
  phone: c.phone,
  website: c.website,
  tax_number: c.taxNumber,
  vat_id: c.vatId,
  register_court: c.registerCourt,
  register_number: c.registerNumber,
  bank_name: c.bankName,
  iban: c.iban,
  bic: c.bic,
  logo: c.logo,
  logo_ratio: c.logoRatio,
  small_business: c.smallBusiness,
  default_vat: c.defaultVat,
  payment_term_days: c.paymentTermDays,
  offer_validity_days: c.offerValidityDays,
  invoice_prefix: c.invoicePrefix,
  offer_prefix: c.offerPrefix,
  design,
});

export const companyFromRow = (r: Row): { company: Company; design: InvoiceDesign; settings: Settings } => ({
  settings: {
    datev: { ...defaultSettings().datev, ...(((r.settings as Partial<Settings>) || {}).datev || {}) },
    email: { ...defaultSettings().email, ...(((r.settings as Partial<Settings>) || {}).email || {}) },
  },
  company: {
    ...emptyCompany(),
    plan: (['start', 'business', 'team'].includes(str(r.plan)) ? str(r.plan) : 'start') as Company['plan'],
    name: str(r.name),
    owner: str(r.owner),
    street: str(r.street),
    zip: str(r.zip),
    city: str(r.city),
    country: str(r.country),
    email: str(r.email),
    phone: str(r.phone),
    website: str(r.website),
    taxNumber: str(r.tax_number),
    vatId: str(r.vat_id),
    registerCourt: str(r.register_court),
    registerNumber: str(r.register_number),
    bankName: str(r.bank_name),
    iban: str(r.iban),
    bic: str(r.bic),
    logo: str(r.logo),
    logoRatio: num(r.logo_ratio) || 1,
    smallBusiness: !!r.small_business,
    defaultVat: num(r.default_vat),
    paymentTermDays: num(r.payment_term_days),
    offerValidityDays: num(r.offer_validity_days),
    invoicePrefix: str(r.invoice_prefix),
    offerPrefix: str(r.offer_prefix),
  },
  design: { ...defaultDesign(), ...((r.design as Partial<InvoiceDesign>) || {}) },
});

export const customerToRow = (c: Customer, companyId: string): Row => ({
  company_id: companyId,
  id: c.id,
  number: c.number,
  name: c.name,
  contact_person: c.contactPerson,
  street: c.street,
  zip: c.zip,
  city: c.city,
  country: c.country,
  email: c.email,
  phone: c.phone,
  vat_id: c.vatId,
  notes: c.notes,
  created_at: dateOrNull(c.createdAt),
});

export const customerFromRow = (r: Row): Customer => ({
  id: str(r.id),
  number: str(r.number),
  name: str(r.name),
  contactPerson: str(r.contact_person),
  street: str(r.street),
  zip: str(r.zip),
  city: str(r.city),
  country: str(r.country),
  email: str(r.email),
  phone: str(r.phone),
  vatId: str(r.vat_id),
  notes: str(r.notes),
  createdAt: str(r.created_at),
});

export const materialToRow = (m: Material, companyId: string): Row => ({
  company_id: companyId,
  id: m.id,
  number: m.number,
  name: m.name,
  description: m.description,
  category: m.category,
  unit: m.unit,
  purchase_price: m.purchasePrice,
  sale_price: m.salePrice,
  vat: m.vat,
  stock: m.stock,
  min_stock: m.minStock,
  location_id: m.locationId || null,
});

export const materialFromRow = (r: Row, movements: StockMovement[]): Material => ({
  id: str(r.id),
  number: str(r.number),
  name: str(r.name),
  description: str(r.description),
  category: str(r.category),
  unit: str(r.unit),
  purchasePrice: num(r.purchase_price),
  salePrice: num(r.sale_price),
  vat: num(r.vat),
  stock: num(r.stock),
  minStock: num(r.min_stock),
  locationId: str(r.location_id),
  movements,
});

export type MovementWithMaterial = StockMovement & { materialId: string };

export const movementToRow = (m: MovementWithMaterial, companyId: string): Row => ({
  company_id: companyId,
  id: m.id,
  material_id: m.materialId,
  date: m.date,
  quantity: m.quantity,
  note: m.note,
});

export const movementFromRow = (r: Row): MovementWithMaterial => ({
  id: str(r.id),
  materialId: str(r.material_id),
  date: str(r.date),
  quantity: num(r.quantity),
  note: str(r.note),
});

export const documentToRow = (d: SalesDoc, companyId: string): Row => ({
  company_id: companyId,
  id: d.id,
  kind: d.kind,
  number: d.number,
  status: d.status,
  customer_id: d.customerId || null,
  recipient: d.recipient,
  subject: d.subject,
  date: d.date,
  due_date: dateOrNull(d.dueDate),
  service_date: d.serviceDate,
  intro: d.intro,
  outro: d.outro,
  items: d.items,
  paid_date: dateOrNull(d.paidDate),
  source_id: d.sourceId,
  stock_booked: d.stockBooked,
  sent_at: d.sentAt || null,
  sent_to: d.sentTo,
  created_at: d.createdAt || new Date().toISOString(),
});

export const documentFromRow = (r: Row): SalesDoc => ({
  id: str(r.id),
  kind: r.kind as SalesDoc['kind'],
  number: str(r.number),
  status: r.status as SalesDoc['status'],
  customerId: str(r.customer_id),
  recipient: (r.recipient as Recipient) || { name: '', contactPerson: '', street: '', zip: '', city: '', country: '', vatId: '' },
  subject: str(r.subject),
  date: str(r.date),
  dueDate: str(r.due_date),
  serviceDate: str(r.service_date),
  intro: str(r.intro),
  outro: str(r.outro),
  items: ((r.items as LineItem[]) || []).map((i) => ({ ...i, quantity: num(i.quantity), unitPrice: num(i.unitPrice), vat: num(i.vat), discount: num(i.discount) })),
  paidDate: str(r.paid_date),
  sourceId: str(r.source_id),
  stockBooked: !!r.stock_booked,
  sentAt: r.sent_at ? new Date(str(r.sent_at)).toISOString() : '',
  sentTo: str(r.sent_to),
  createdAt: str(r.created_at),
});

export const expenseToRow = (e: Expense, companyId: string): Row => ({
  company_id: companyId,
  id: e.id,
  kind: e.kind,
  date: e.date,
  supplier: e.supplier,
  description: e.description,
  category: e.category,
  net: e.net,
  vat: e.vat,
  receipt_no: e.receiptNo,
});

export const expenseFromRow = (r: Row): Expense => ({
  id: str(r.id),
  kind: r.kind === 'income' ? 'income' : 'expense',
  date: str(r.date),
  supplier: str(r.supplier),
  description: str(r.description),
  category: str(r.category),
  net: num(r.net),
  vat: num(r.vat),
  receiptNo: str(r.receipt_no),
});

export const locationToRow = (l: StorageLocation, companyId: string): Row => ({
  company_id: companyId,
  id: l.id,
  code: l.code,
  name: l.name,
  note: l.note,
});

export const locationFromRow = (r: Row): StorageLocation => ({
  id: str(r.id),
  code: str(r.code),
  name: str(r.name),
  note: str(r.note),
});
