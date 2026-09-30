'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, nextNumber, today, uid } from './calc';
import { defaultDesign, demoData, emptyCompany, emptyData } from './defaults';
import type { Company, Customer, Data, DocKind, Expense, InvoiceDesign, Material, SalesDoc } from './types';

const STORAGE_KEY = 'vysn-one-data-v1';

function migrate(raw: unknown): Data {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<Data>;
  return {
    ...base,
    ...d,
    company: d.company ? { ...emptyCompany(), ...d.company } : null,
    design: { ...defaultDesign(), ...(d.design || {}) },
    counters: { ...base.counters, ...(d.counters || {}) },
  } as Data;
}

type Store = {
  data: Data;
  ready: boolean;
  saveCompany: (company: Company) => void;
  saveCustomer: (customer: Customer) => Customer;
  deleteCustomer: (id: string) => void;
  saveMaterial: (material: Material) => Material;
  deleteMaterial: (id: string) => void;
  bookStock: (materialId: string, quantity: number, note: string, date?: string) => void;
  createDoc: (kind: DocKind, customerId?: string) => SalesDoc;
  saveDoc: (doc: SalesDoc) => void;
  deleteDoc: (id: string) => void;
  setDocStatus: (id: string, status: SalesDoc['status'], paidDate?: string) => void;
  offerToInvoice: (offerId: string) => SalesDoc | null;
  duplicateDoc: (id: string) => SalesDoc | null;
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  saveDesign: (design: InvoiceDesign) => void;
  replaceAll: (data: unknown) => void;
  loadDemo: () => void;
  reset: () => void;
};

const StoreContext = createContext<Store | null>(null);

/** Adjusts stock for all material positions of a document (sign -1 = Abgang, +1 = Zugang). */
function applyStock(data: Data, doc: SalesDoc, sign: 1 | -1, note: string): Material[] {
  const date = today();
  return data.materials.map((m) => {
    const qty = doc.items.filter((i) => i.materialId === m.id).reduce((s, i) => s + i.quantity, 0);
    if (!qty) return m;
    return {
      ...m,
      stock: m.stock + sign * qty,
      movements: [{ id: uid(), date, quantity: sign * qty, note }, ...m.movements],
    };
  });
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(emptyData);
  const [ready, setReady] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setData(migrate(JSON.parse(stored)));
    } catch {
      /* Speicher nicht verfügbar – App läuft mit leerem Bestand */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* z. B. Speicher voll oder privater Modus */
    }
  }, [data, ready]);

  const update = useCallback((fn: (d: Data) => Data) => setData((d) => fn(d)), []);

  const saveCompany = useCallback((company: Company) => update((d) => ({ ...d, company })), [update]);

  const saveCustomer = useCallback((customer: Customer) => {
    let saved = customer;
    if (!customer.id) {
      const n = dataRef.current.counters.customer + 1;
      saved = { ...customer, id: uid(), number: customer.number || `KD-${String(n).padStart(4, '0')}`, createdAt: today() };
      update((d) => ({ ...d, customers: [saved, ...d.customers], counters: { ...d.counters, customer: d.counters.customer + 1 } }));
    } else {
      update((d) => ({ ...d, customers: d.customers.map((c) => (c.id === customer.id ? customer : c)) }));
    }
    return saved;
  }, [update]);

  const deleteCustomer = useCallback((id: string) => update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) })), [update]);

  const saveMaterial = useCallback((material: Material) => {
    let saved = material;
    if (!material.id) {
      const n = dataRef.current.counters.material + 1;
      const movements = material.stock ? [{ id: uid(), date: today(), quantity: material.stock, note: 'Anfangsbestand' }] : [];
      saved = { ...material, id: uid(), number: material.number || `ART-${String(n).padStart(4, '0')}`, movements };
      update((d) => ({ ...d, materials: [saved, ...d.materials], counters: { ...d.counters, material: d.counters.material + 1 } }));
    } else {
      update((d) => ({ ...d, materials: d.materials.map((m) => (m.id === material.id ? material : m)) }));
    }
    return saved;
  }, [update]);

  const deleteMaterial = useCallback((id: string) => update((d) => ({ ...d, materials: d.materials.filter((m) => m.id !== id) })), [update]);

  const bookStock = useCallback((materialId: string, quantity: number, note: string, date = today()) => {
    update((d) => ({
      ...d,
      materials: d.materials.map((m) =>
        m.id === materialId ? { ...m, stock: m.stock + quantity, movements: [{ id: uid(), date, quantity, note }, ...m.movements] } : m,
      ),
    }));
  }, [update]);

  const createDoc = useCallback((kind: DocKind, customerId = '') => {
    const d = dataRef.current;
    const date = today();
    const { number, year, n } = nextNumber(d, kind, date);
    const customer = d.customers.find((c) => c.id === customerId);
    const company = d.company;
    const doc: SalesDoc = {
      id: uid(),
      kind,
      number,
      status: 'draft',
      customerId,
      recipient: customer
        ? { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: customer.country, vatId: customer.vatId }
        : { name: '', contactPerson: '', street: '', zip: '', city: '', country: 'Deutschland', vatId: '' },
      subject: '',
      date,
      dueDate: addDays(date, kind === 'invoice' ? company?.paymentTermDays ?? 14 : company?.offerValidityDays ?? 30),
      serviceDate: kind === 'invoice' ? date.split('-').reverse().join('.') : '',
      intro: '',
      outro: '',
      items: [],
      paidDate: '',
      sourceId: '',
      stockBooked: false,
      createdAt: new Date().toISOString(),
    };
    update((s) => ({
      ...s,
      documents: [doc, ...s.documents],
      counters: { ...s.counters, [kind]: { ...s.counters[kind], [year]: n } },
    }));
    return doc;
  }, [update]);

  const saveDoc = useCallback((doc: SalesDoc) => update((d) => ({ ...d, documents: d.documents.map((x) => (x.id === doc.id ? doc : x)) })), [update]);

  const deleteDoc = useCallback((id: string) => update((d) => {
    const doc = d.documents.find((x) => x.id === id);
    // Bereits gebuchter Materialverbrauch wird beim Löschen zurückgebucht.
    const materials = doc && doc.stockBooked ? applyStock(d, doc, 1, `${doc.number} gelöscht`) : d.materials;
    return { ...d, materials, documents: d.documents.filter((x) => x.id !== id) };
  }), [update]);

  const setDocStatus = useCallback((id: string, status: SalesDoc['status'], paidDate?: string) => update((d) => {
    const doc = d.documents.find((x) => x.id === id);
    if (!doc) return d;
    let materials = d.materials;
    let stockBooked = doc.stockBooked;
    if (doc.kind === 'invoice') {
      if (!stockBooked && (status === 'sent' || status === 'paid')) {
        materials = applyStock(d, doc, -1, `Rechnung ${doc.number}`);
        stockBooked = true;
      } else if (stockBooked && status === 'cancelled') {
        materials = applyStock(d, doc, 1, `Storno ${doc.number}`);
        stockBooked = false;
      }
    }
    const next: SalesDoc = { ...doc, status, stockBooked, paidDate: status === 'paid' ? paidDate || doc.paidDate || today() : '' };
    return { ...d, materials, documents: d.documents.map((x) => (x.id === id ? next : x)) };
  }), [update]);

  const offerToInvoice = useCallback((offerId: string) => {
    const offer = dataRef.current.documents.find((x) => x.id === offerId);
    if (!offer) return null;
    const invoice = createDoc('invoice', '');
    const full: SalesDoc = {
      ...invoice,
      customerId: offer.customerId,
      recipient: { ...offer.recipient },
      subject: offer.subject,
      items: offer.items.map((i) => ({ ...i, id: uid() })),
      sourceId: offer.id,
    };
    update((d) => ({
      ...d,
      documents: d.documents.map((x) => (x.id === invoice.id ? full : x.id === offer.id && x.status !== 'accepted' ? { ...x, status: 'accepted' } : x)),
    }));
    return full;
  }, [createDoc, update]);

  const duplicateDoc = useCallback((id: string) => {
    const src = dataRef.current.documents.find((x) => x.id === id);
    if (!src) return null;
    const copy = createDoc(src.kind, '');
    const full: SalesDoc = { ...copy, customerId: src.customerId, recipient: { ...src.recipient }, subject: src.subject, intro: src.intro, outro: src.outro, items: src.items.map((i) => ({ ...i, id: uid() })) };
    update((d) => ({ ...d, documents: d.documents.map((x) => (x.id === copy.id ? full : x)) }));
    return full;
  }, [createDoc, update]);

  const saveExpense = useCallback((expense: Expense) => update((d) => ({
    ...d,
    expenses: expense.id && d.expenses.some((e) => e.id === expense.id)
      ? d.expenses.map((e) => (e.id === expense.id ? expense : e))
      : [{ ...expense, id: expense.id || uid() }, ...d.expenses],
  })), [update]);

  const deleteExpense = useCallback((id: string) => update((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) })), [update]);
  const saveDesign = useCallback((design: InvoiceDesign) => update((d) => ({ ...d, design })), [update]);
  const replaceAll = useCallback((raw: unknown) => setData(migrate(raw)), []);
  const loadDemo = useCallback(() => setData(demoData()), []);
  const reset = useCallback(() => setData(emptyData()), []);

  const value = useMemo<Store>(() => ({
    data, ready, saveCompany, saveCustomer, deleteCustomer, saveMaterial, deleteMaterial, bookStock, createDoc, saveDoc, deleteDoc,
    setDocStatus, offerToInvoice, duplicateDoc, saveExpense, deleteExpense, saveDesign, replaceAll, loadDemo, reset,
  }), [data, ready, saveCompany, saveCustomer, deleteCustomer, saveMaterial, deleteMaterial, bookStock, createDoc, saveDoc, deleteDoc,
    setDocStatus, offerToInvoice, duplicateDoc, saveExpense, deleteExpense, saveDesign, replaceAll, loadDemo, reset]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
