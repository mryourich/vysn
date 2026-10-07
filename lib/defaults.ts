import { addDays, toISO, uid } from './calc';
import type { Company, Customer, Data, Expense, InvoiceDesign, LineItem, Material, SalesDoc, Settings } from './types';

export const emptyCompany = (): Company => ({
  plan: 'start',
  name: '',
  owner: '',
  street: '',
  zip: '',
  city: '',
  country: 'Deutschland',
  email: '',
  phone: '',
  website: '',
  taxNumber: '',
  vatId: '',
  registerCourt: '',
  registerNumber: '',
  bankName: '',
  iban: '',
  bic: '',
  logo: '',
  logoRatio: 1,
  smallBusiness: false,
  defaultVat: 19,
  paymentTermDays: 14,
  offerValidityDays: 30,
  invoicePrefix: 'RE',
  offerPrefix: 'AN',
});

export const defaultDesign = (): InvoiceDesign => ({
  layout: 'classic',
  accent: '#1f3a5f',
  font: 'Helvetica',
  logoPosition: 'right',
  logoSize: 44,
  tableStyle: 'lines',
  showSenderLine: true,
  showPositions: true,
  showFooter: true,
  showPageNumbers: true,
  invoiceIntro: 'vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Leistungen in Rechnung:',
  invoiceOutro: 'Bitte überweisen Sie den Rechnungsbetrag bis zum {faellig} unter Angabe der Rechnungsnummer {nummer}.\n\nMit freundlichen Grüßen',
  offerIntro: 'vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:',
  offerOutro: 'Dieses Angebot ist gültig bis zum {gueltig}. Wir freuen uns auf Ihre Auftragserteilung.\n\nMit freundlichen Grüßen',
});

export const defaultSettings = (): Settings => ({
  datev: { advisorNumber: '', clientNumber: '', chart: 'SKR03', fiscalYearStart: '01-01', accountLength: 4, debtorPerCustomer: false, accounts: {} },
  email: {
    autoSendInvoices: false,
    bcc: '',
    invoiceSubject: 'Rechnung {nummer} von {firma}',
    invoiceBody: 'Guten Tag,\n\nanbei erhalten Sie unsere Rechnung {nummer} über {betrag}. Bitte überweisen Sie den Betrag bis zum {faellig}.\n\nMit freundlichen Grüßen\n{firma}',
    offerSubject: 'Angebot {nummer} von {firma}',
    offerBody: 'Guten Tag,\n\nanbei erhalten Sie unser Angebot {nummer} über {betrag}. Es ist gültig bis zum {gueltig}.\n\nWir freuen uns auf Ihre Rückmeldung.\n\nMit freundlichen Grüßen\n{firma}',
  },
  numbers: { prefixes: {} },
});

export const emptyData = (): Data => ({
  version: 1,
  company: null,
  customers: [],
  materials: [],
  documents: [],
  expenses: [],
  locations: [],
  design: defaultDesign(),
  settings: defaultSettings(),
  counters: { offer: {}, confirmation: {}, delivery: {}, invoice: {}, order: {}, customer: 0, material: 0 },
  usage: { month: '', counts: {} },
});

/** Neuer Kunde – Land vorbelegt mit dem Land der Firma. */
export const emptyCustomer = (country = 'Deutschland'): Customer => ({
  id: '',
  number: '',
  name: '',
  contactPerson: '',
  street: '',
  zip: '',
  city: '',
  country,
  email: '',
  phone: '',
  vatId: '',
  notes: '',
  createdAt: '',
});

export const emptyMaterial = (vat = 19): Material => ({
  id: '',
  number: '',
  name: '',
  description: '',
  category: '',
  unit: 'Stück',
  purchasePrice: 0,
  salePrice: 0,
  vat,
  stock: 0,
  minStock: 0,
  locationId: '',
  movements: [],
});

export const emptyItem = (vat = 19): LineItem => ({
  id: uid(),
  description: '',
  details: '',
  quantity: 1,
  unit: 'Stück',
  unitPrice: 0,
  vat,
  discount: 0,
});

export const UNITS = ['Stück', 'Std.', 'Pauschal', 'm', 'm²', 'm³', 'kg', 't', 'l', 'Sack', 'Rolle', 'Platte', 'Paket', 'Tag', 'km'];

/** Builds a realistic sample company with a year of activity relative to today. */
export function demoData(): Data {
  const data = emptyData();
  const now = new Date();
  const year = now.getFullYear();
  data.company = {
    ...emptyCompany(),
    name: 'Berger Innenausbau GmbH',
    owner: 'Jonas Berger',
    street: 'Werkstraße 12',
    zip: '80339',
    city: 'München',
    email: 'info@berger-innenausbau.de',
    phone: '+49 89 123 456 0',
    website: 'www.berger-innenausbau.de',
    taxNumber: '143/123/45678',
    vatId: 'DE123456789',
    registerCourt: 'Amtsgericht München',
    registerNumber: 'HRB 234567',
    bankName: 'Stadtsparkasse München',
    iban: 'DE89 7015 0000 0012 3456 78',
    bic: 'SSKMDEMMXXX',
  };

  const customers: [string, string, string, string, string][] = [
    ['Hausverwaltung Lindner KG', 'Sabine Lindner', 'Leopoldstraße 88', '80802', 'München'],
    ['Architekturbüro Weiß & Partner', 'Thomas Weiß', 'Sendlinger Str. 21', '80331', 'München'],
    ['Familie Schneider', 'Markus Schneider', 'Am Anger 4', '82061', 'Neuried'],
    ['Café Morgenrot', 'Lea Hoffmann', 'Gärtnerplatz 3', '80469', 'München'],
    ['Praxis Dr. Yilmaz', 'Dr. Aylin Yilmaz', 'Rosenheimer Str. 140', '81669', 'München'],
  ];
  data.customers = customers.map(([name, contactPerson, street, zip, city], i) => ({
    ...emptyCustomer(),
    id: uid(),
    number: `KD-${String(i + 1).padStart(4, '0')}`,
    name,
    contactPerson,
    street,
    zip,
    city,
    email: contactPerson.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@example.de',
    createdAt: `${year - 1}-0${i + 1}-15`,
  }));
  data.counters.customer = customers.length;

  const materials: [string, string, string, number, number, number, number][] = [
    ['Gipskartonplatte 12,5 mm', 'Trockenbau', 'Platte', 7.9, 13.5, 64, 30],
    ['CW-Profil 50 mm, 3 m', 'Trockenbau', 'Stück', 3.2, 5.9, 18, 40],
    ['Mineralwolle 60 mm', 'Dämmung', 'Rolle', 32, 49, 6, 10],
    ['Spachtelmasse 25 kg', 'Baustoffe', 'Sack', 14.5, 24, 22, 10],
    ['Eichenparkett geölt', 'Boden', 'm²', 38, 62, 45, 20],
    ['Trittschalldämmung 2 mm', 'Boden', 'm²', 2.1, 4.2, 120, 50],
    ['Innentür Weißlack 86 cm', 'Türen', 'Stück', 189, 295, 3, 2],
    ['Schnellbauschrauben 3,9×35 (1000)', 'Befestigung', 'Paket', 11.9, 19.5, 9, 5],
  ];
  data.materials = materials.map(([name, category, unit, purchasePrice, salePrice, stock, minStock], i) => ({
    ...emptyMaterial(),
    id: uid(),
    number: `ART-${String(i + 1).padStart(4, '0')}`,
    name,
    category,
    unit,
    purchasePrice,
    salePrice,
    stock,
    minStock,
    movements: [{ id: uid(), date: `${year}-01-02`, quantity: stock, note: 'Anfangsbestand' }],
  }));
  data.counters.material = materials.length;
  data.locations = [
    { id: uid(), code: 'A-01', name: 'Regal A · Trockenbau', note: 'Halle links' },
    { id: uid(), code: 'B-01', name: 'Regal B · Boden & Dämmung', note: 'Halle rechts' },
    { id: uid(), code: 'C-01', name: 'Regal C · Kleinteile & Türen', note: 'Werkstatt' },
  ];
  const locationFor = ['A-01', 'A-01', 'B-01', 'A-01', 'B-01', 'B-01', 'C-01', 'C-01'];
  data.materials = data.materials.map((m, i) => ({ ...m, locationId: data.locations.find((l) => l.code === locationFor[i])!.id }));

  const labour = (hours: number): LineItem => ({ id: uid(), description: 'Montagearbeiten Facharbeiter', details: '', quantity: hours, unit: 'Std.', unitPrice: 62, vat: 19, discount: 0 });
  const mat = (index: number, quantity: number): LineItem => {
    const m = data.materials[index];
    return { id: uid(), materialId: m.id, description: m.name, details: '', quantity, unit: m.unit, unitPrice: m.salePrice, vat: 19, discount: 0 };
  };

  const subjects = ['Trockenbau Büroräume', 'Parkett Wohnzimmer', 'Innentüren tauschen', 'Deckenabhängung Praxis', 'Dachgeschossausbau', 'Akustikdecke Gastraum', 'Renovierung Treppenhaus'];
  const docs: SalesDoc[] = [];
  for (let back = 11; back >= 0; back--) {
    const month = new Date(year, now.getMonth() - back, 1);
    const perMonth = back === 0 ? 2 : 3;
    for (let k = 0; k < perMonth; k++) {
      const day = Math.min(4 + k * 8, 26);
      const date = toISO(new Date(month.getFullYear(), month.getMonth(), day));
      if (date > toISO(now)) continue;
      const customer = data.customers[(back + k) % data.customers.length];
      const items = [labour(44 + ((back * 7 + k * 5) % 50)), mat((back + k) % 8, 4 + ((back + k * 3) % 12)), mat((back + k + 3) % 8, 2 + (k % 4))];
      const y = date.slice(0, 4);
      data.counters.invoice[y] = (data.counters.invoice[y] || 0) + 1;
      const dueDate = addDays(date, 14);
      const paid = dueDate < toISO(now) ? (back + k) % 11 !== 3 : back > 0 && k === 0;
      const status = back === 0 && k === 1 ? 'draft' : paid ? 'paid' : 'sent';
      docs.push({
        id: uid(),
        kind: 'invoice',
        number: `RE-${y}-${String(data.counters.invoice[y]).padStart(4, '0')}`,
        status,
        customerId: customer.id,
        recipient: { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: 'Deutschland', vatId: '' },
        subject: subjects[(back + k) % subjects.length],
        date,
        dueDate,
        serviceDate: formatMonth(month),
        intro: '',
        outro: '',
        items,
        paidDate: status === 'paid' ? addDays(date, 6 + ((back + k) % 7)) : '',
        sourceId: '',
        stockBooked: true,
        createdAt: date,
        sentAt: status === 'draft' ? '' : date + 'T09:00:00.000Z',
        sentTo: status === 'draft' ? '' : customer.email,
      });
    }
    if (back <= 2) {
      const date = toISO(new Date(month.getFullYear(), month.getMonth(), 12));
      if (date > toISO(now)) continue;
      const customer = data.customers[(back + 2) % data.customers.length];
      const y = date.slice(0, 4);
      data.counters.offer[y] = (data.counters.offer[y] || 0) + 1;
      docs.push({
        id: uid(),
        kind: 'offer',
        number: `AN-${y}-${String(data.counters.offer[y]).padStart(4, '0')}`,
        status: back === 0 ? 'sent' : back === 1 ? 'draft' : 'accepted',
        customerId: customer.id,
        recipient: { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: 'Deutschland', vatId: '' },
        subject: subjects[(back + 4) % subjects.length],
        date,
        dueDate: addDays(date, 30),
        serviceDate: '',
        intro: '',
        outro: '',
        items: [labour(24 + back * 6), mat(4, 38), mat(5, 38), mat(6, 2)],
        paidDate: '',
        sourceId: '',
        stockBooked: false,
        createdAt: date,
        sentAt: '',
        sentTo: '',
      });
    }
  }
  data.documents = docs.reverse();

  const fixed: [string, string, string, number, number][] = [
    ['Miete & Nebenkosten', 'Gewerbehof Süd GmbH', 'Miete Werkstatt & Lager', 1450, 19],
    ['Fahrzeug', 'Autohaus Kraus', 'Leasing Transporter', 389, 19],
    ['Versicherungen', 'Allianz', 'Betriebshaftpflicht', 96, 0],
    ['Büro & Software', 'Telekom', 'Internet & Mobilfunk', 79, 19],
    ['Personal', 'Lohnabrechnung', 'Löhne & Gehälter inkl. SV', 6800, 0],
  ];
  const expenses: Expense[] = [];
  for (let back = 11; back >= 0; back--) {
    const month = new Date(year, now.getMonth() - back, 1);
    for (const [category, supplier, description, net, vat] of fixed) {
      const date = toISO(new Date(month.getFullYear(), month.getMonth(), 3));
      if (date > toISO(now)) continue;
      expenses.push({ id: uid(), kind: 'expense', date, supplier, description, category, net, vat, receiptNo: '' });
    }
    const date = toISO(new Date(month.getFullYear(), month.getMonth(), 18));
    if (date <= toISO(now)) {
      expenses.push({ id: uid(), kind: 'expense', date, supplier: 'Baustoff Union', description: 'Materialeinkauf', category: 'Material & Waren', net: 1800 + ((back * 373) % 1400), vat: 19, receiptNo: `BU-${4400 + back}` });
      if (back % 3 === 0) expenses.push({ id: uid(), kind: 'expense', date, supplier: 'Elektro Maier', description: 'Elektroinstallation (Subunternehmer)', category: 'Fremdleistungen', net: 1200 + back * 90, vat: 19, receiptNo: '' });
      if (back % 4 === 1) expenses.push({ id: uid(), kind: 'expense', date, supplier: 'Druckerei Ost', description: 'Flyer & Fahrzeugbeschriftung', category: 'Marketing', net: 340, vat: 19, receiptNo: '' });
    }
  }
  // einige Einnahmen ohne Rechnung
  for (const back of [1, 4, 7]) {
    const date = toISO(new Date(year, now.getMonth() - back, 22));
    expenses.push({ id: uid(), kind: 'income', date, supplier: 'Barverkauf Werkstatt', description: 'Restmaterial an Privatkunden', category: 'Barverkauf', net: 180 + back * 25, vat: 19, receiptNo: `KB-${100 + back}` });
  }
  expenses.sort((a, b) => a.date.localeCompare(b.date));
  data.expenses = expenses.reverse();
  return data;
}

function formatMonth(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${m}/${d.getFullYear()}`;
}
