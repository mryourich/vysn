'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FilePlus2, Mail, Pencil, Phone, Plus, ReceiptText, Search, Trash2, Users } from 'lucide-react';
import { docTotals, money } from '../../../lib/calc';
import { useStore } from '../../../lib/store';
import type { Customer } from '../../../lib/types';
import { CustomerModal } from '../../../components/app/customer-form';
import { Empty, PageHeader, useCreateAction } from '../../../components/app/ui';
import { QuotaBar } from '../../../components/app/quota';

export default function CustomersPage() {
  const { data, deleteCustomer, createDoc } = useStore();
  const router = useRouter();
  const [editing, setEditing] = useState<Customer | null | 'new'>(null);
  const [q, setQ] = useState('');
  useCreateAction(() => setEditing('new'));
  const small = !!data.company?.smallBusiness;

  const stats = (id: string) => {
    const docs = data.documents.filter((d) => d.customerId === id && d.kind === 'invoice');
    const revenue = docs.filter((d) => d.status === 'sent' || d.status === 'paid').reduce((s, d) => s + docTotals(d.items, small).net, 0);
    const open = docs.filter((d) => d.status === 'sent').reduce((s, d) => s + docTotals(d.items, small).gross, 0);
    return { revenue, open, count: data.documents.filter((d) => d.customerId === id).length };
  };

  const list = data.customers
    .filter((c) => !q || `${c.name} ${c.contactPerson} ${c.city} ${c.number} ${c.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const newDoc = async (kind: 'invoice' | 'offer', customerId: string) => {
    const doc = await createDoc(kind, customerId);
    if (!doc) return;
    router.push(`/app/${kind === 'invoice' ? 'rechnungen' : 'angebote'}/bearbeiten?id=${doc.id}`);
  };

  return (
    <div className="page">
      <PageHeader title="Kunden" description="Kontakte, Anschriften und Umsätze Ihrer Kunden."
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Neuer Kunde</button>} />
      <QuotaBar kind="customer" />
      <section className="card">
        {data.customers.length ? (
          <>
            <div className="toolbar">
              <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Ort, Kundennummer…" /></label>
              <span className="muted small">{data.customers.length} Kunden</span>
            </div>
            <div className="table">
              <div className="tr th tr-cust"><span>Kunde</span><span className="hide-sm">Kontakt</span><span className="td-num hide-sm">Umsatz netto</span><span className="td-num">Offen</span><span /></div>
              {list.map((c) => {
                const s = stats(c.id);
                return (
                  <div key={c.id} className="tr tr-cust" onClick={() => setEditing(c)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEditing(c)}>
                    <span className="td-main"><span className="avatar">{c.name.slice(0, 1)}</span><span><strong>{c.name}</strong><small>{c.number}{c.city ? ` · ${c.city}` : ''}</small></span></span>
                    <span className="td-muted hide-sm contact-cell">
                      {c.email ? <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}><Mail size={13} /> {c.email}</a> : null}
                      {c.phone ? <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()}><Phone size={13} /> {c.phone}</a> : null}
                      {!c.email && !c.phone ? c.contactPerson || '—' : null}
                    </span>
                    <span className="td-num hide-sm">{money(s.revenue)}</span>
                    <span className={`td-num${s.open ? '' : ' td-muted'}`}>{money(s.open)}</span>
                    <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title="Angebot erstellen" onClick={() => newDoc('offer', c.id)}><FilePlus2 size={16} /></button>
                      <button className="icon-btn" title="Rechnung erstellen" onClick={() => newDoc('invoice', c.id)}><ReceiptText size={16} /></button>
                      <button className="icon-btn hide-sm" title="Bearbeiten" onClick={() => setEditing(c)}><Pencil size={16} /></button>
                      <button className="icon-btn danger hide-sm" title="Löschen" onClick={() => {
                        if (s.count) return alert(`${c.name} hat ${s.count} Belege und kann nicht gelöscht werden.`);
                        if (confirm(`${c.name} löschen?`)) deleteCustomer(c.id);
                      }}><Trash2 size={16} /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <Empty icon={<Users />} title="Noch keine Kunden" text="Legen Sie Ihre Kunden einmal an – Anschrift und Kundennummer werden dann automatisch in Angebote und Rechnungen übernommen."
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Kunde anlegen</button>} />
        )}
      </section>
      {editing ? <CustomerModal initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
