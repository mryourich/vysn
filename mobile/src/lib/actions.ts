/**
 * Änderungen am Datenstand – dieselben Regeln wie in der Website (lib/store.tsx):
 * Nummernkreise, Monatskontingente, Lagerbuchung bei Rechnung/Wareneingang, Folgebelege.
 * Alle Funktionen sind rein: alter Stand rein, neuer Stand raus.
 */
import { addDays, today, uid } from '../shared/calc';
import { docPrefix } from '../shared/docs';
import { countUsage } from '../shared/plans';
import { isProvisional } from '../shared/db/ops';
import type { Customer, Data, DocKind, Material, SalesDoc } from '../shared/types';

export function applyStock(data: Data, doc: SalesDoc, sign: 1 | -1, note: string): Material[] {
  const date = today();
  return data.materials.map((m) => {
    const q = doc.items.filter((i) => i.materialId === m.id).reduce((s, i) => s + i.quantity, 0);
    if (!q) return m;
    return { ...m, stock: m.stock + sign * q, movements: [{ id: uid(), date, quantity: sign * q, note }, ...m.movements] };
  });
}

export function addCustomer(d: Data, customer: Customer, n: number): [Data, Customer] {
  const id = uid();
  const saved = { ...customer, id, number: customer.number || `KD-${String(n).padStart(4, '0')}`, createdAt: today() };
  return [countUsage({ ...d, customers: [saved, ...d.customers], counters: { ...d.counters, customer: Math.max(d.counters.customer, n) } }, 'customer'), saved];
}

export function addMaterial(d: Data, material: Material, n: number): [Data, Material] {
  const id = uid();
  const movements = material.stock ? [{ id: uid(), date: today(), quantity: material.stock, note: 'Anfangsbestand' }] : [];
  const saved = { ...material, id, number: material.number || `ART-${String(n).padStart(4, '0')}`, movements };
  return [countUsage({ ...d, materials: [saved, ...d.materials], counters: { ...d.counters, material: Math.max(d.counters.material, n) } }, 'material'), saved];
}

export function bookStock(d: Data, materialId: string, quantity: number, note: string): Data {
  return {
    ...d,
    materials: d.materials.map((m) => (m.id === materialId ? { ...m, stock: m.stock + quantity, movements: [{ id: uid(), date: today(), quantity, note }, ...m.movements] } : m)),
  };
}

export function newDoc(d: Data, kind: DocKind, n: number, customerId = ''): [Data, SalesDoc] {
  const date = today();
  const year = date.slice(0, 4);
  const id = uid();
  const customer = d.customers.find((c) => c.id === customerId);
  const company = d.company;
  const doc: SalesDoc = {
    id,
    kind,
    number: `${docPrefix(d, kind)}-${year}-${String(n).padStart(4, '0')}`,
    status: 'draft',
    customerId,
    recipient: customer
      ? { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: customer.country, vatId: customer.vatId }
      : { name: '', contactPerson: '', street: '', zip: '', city: '', country: company?.country || 'Deutschland', vatId: '' },
    subject: '',
    date,
    dueDate: addDays(date, kind === 'invoice' ? company?.paymentTermDays ?? 14 : kind === 'offer' ? company?.offerValidityDays ?? 30 : kind === 'delivery' ? 0 : kind === 'order' ? 7 : 14),
    serviceDate: kind === 'invoice' ? date.split('-').reverse().join('.') : '',
    intro: '',
    outro: '',
    items: [],
    paidDate: '',
    sourceId: '',
    stockBooked: false,
    createdAt: new Date().toISOString(),
    sentAt: '',
    sentTo: '',
  };
  const next = countUsage({
    ...d,
    documents: [doc, ...d.documents],
    counters: { ...d.counters, [kind]: { ...d.counters[kind], [year]: Math.max(d.counters[kind][year] || 0, n) } },
  }, kind);
  return [next, doc];
}

export function saveDoc(d: Data, doc: SalesDoc): Data {
  return { ...d, documents: d.documents.map((x) => (x.id === doc.id ? doc : x)) };
}

export function deleteDoc(d: Data, id: string): Data {
  const doc = d.documents.find((x) => x.id === id);
  const materials = doc && doc.stockBooked ? applyStock(d, doc, doc.kind === 'order' ? -1 : 1, `${doc.number} gelöscht`) : d.materials;
  return { ...d, materials, documents: d.documents.filter((x) => x.id !== id) };
}

export function setDocStatus(d: Data, id: string, status: SalesDoc['status'], paidDate?: string): Data {
  const doc = d.documents.find((x) => x.id === id);
  if (!doc || (isProvisional(doc.number) && status !== 'draft')) return d;
  let materials = d.materials;
  let stockBooked = doc.stockBooked;
  if (doc.kind === 'invoice') {
    if (!stockBooked && (status === 'sent' || status === 'paid')) { materials = applyStock(d, doc, -1, `Rechnung ${doc.number}`); stockBooked = true; }
    else if (stockBooked && status === 'cancelled') { materials = applyStock(d, doc, 1, `Storno ${doc.number}`); stockBooked = false; }
  } else if (doc.kind === 'order') {
    if (!stockBooked && status === 'accepted') { materials = applyStock(d, doc, 1, `Wareneingang ${doc.number}`); stockBooked = true; }
    else if (stockBooked && status !== 'accepted') { materials = applyStock(d, doc, -1, `Wareneingang ${doc.number} zurückgenommen`); stockBooked = false; }
  }
  const next: SalesDoc = { ...doc, status, stockBooked, paidDate: status === 'paid' ? paidDate || doc.paidDate || today() : '' };
  return { ...d, materials, documents: d.documents.map((x) => (x.id === id ? next : x)) };
}

/** Folgebeleg aus einem bestehenden Beleg (Angebot → Auftragsbestätigung/Rechnung …). */
export function fillFrom(d: Data, target: SalesDoc, src: SalesDoc): [Data, SalesDoc] {
  const full: SalesDoc = {
    ...target,
    customerId: src.customerId,
    recipient: { ...src.recipient },
    subject: src.subject,
    items: src.items
      .filter((i) => (!i.variant || i.chosen) && !src.items.some((a) => a.parentId === i.id && a.chosen))
      .map(({ variant: _v, chosen: _c, parentId: _p, ...i }) => ({ ...i, id: uid() })),
    sourceId: src.id,
  };
  const next = {
    ...d,
    documents: d.documents.map((x) => (x.id === target.id ? full
      : x.id === src.id && src.kind === 'offer' && x.status !== 'accepted' ? { ...x, status: 'accepted' as const }
      : x.id === src.id && src.kind === 'confirmation' && target.kind === 'invoice' && x.status !== 'accepted' ? { ...x, status: 'accepted' as const }
      : x)),
  };
  return [next, full];
}

export function markSent(d: Data, id: string, to: string): Data {
  return {
    ...d,
    documents: d.documents.map((x) => (x.id === id
      ? { ...x, sentAt: new Date().toISOString(), sentTo: to, status: x.kind !== 'invoice' && x.status === 'draft' ? 'sent' : x.status }
      : x)),
  };
}
