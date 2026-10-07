'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ClipboardCheck, FileText, Plus, ReceiptText, Search, ShoppingCart, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { displayStatus, docTotals, formatDate, isOverdue, money } from '../../lib/calc';
import { DOC_KINDS, docEditPath } from '../../lib/docs';
import { useStore } from '../../lib/store';
import { QuotaBar } from './quota';
import type { DocKind, SalesDoc } from '../../lib/types';
import { Badge, Empty, PageHeader, Segmented, StatCard } from './ui';

export const DOC_ICONS: Record<DocKind, LucideIcon> = {
  offer: FileText, confirmation: ClipboardCheck, delivery: Truck, invoice: ReceiptText, order: ShoppingCart,
};

export function DocList({ kind }: { kind: DocKind }) {
  const { data, createDoc } = useStore();
  const router = useRouter();
  const cfg = DOC_KINDS[kind];
  const Icon = DOC_ICONS[kind];
  const isInvoice = kind === 'invoice';
  const small = !!data.company?.smallBusiness;
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const docs = useMemo(() => data.documents.filter((d) => d.kind === kind).sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number)), [data.documents, kind]);

  const filters: [string, string][] = isInvoice
    ? [['all', 'Alle'], ['open', 'Offen'], ['overdue', 'Überfällig'], ['paid', 'Bezahlt'], ['draft', 'Entwürfe']]
    : [['all', 'Alle'], ...Object.entries(cfg.status).map(([k, v]) => [k, k === 'draft' ? 'Entwürfe' : v!.label] as [string, string])];

  const visible = docs.filter((d) => {
    if (filter === 'open' && d.status !== 'sent') return false;
    if (filter === 'overdue' && !isOverdue(d)) return false;
    if (!['all', 'open', 'overdue'].includes(filter) && d.status !== filter) return false;
    if (q) {
      const hay = `${d.number} ${d.recipient.name} ${d.subject}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const sum = (list: SalesDoc[], field: 'net' | 'gross' = 'gross') => list.reduce((s, d) => s + docTotals(d.items, small)[field], 0);
  const count = (status: SalesDoc['status']) => docs.filter((d) => d.status === status);
  const create = async () => {
    const doc = await createDoc(kind);
    if (doc) router.push(docEditPath(doc));
  };
  const year = String(new Date().getFullYear());
  const newLabel = `${cfg.article === 'ein' ? 'Neues' : 'Neue'} ${cfg.one}`.replace('Neues Lieferschein', 'Neuer Lieferschein');

  const stats = (() => {
    switch (kind) {
      case 'invoice': return (
        <>
          <StatCard label="Offen" value={money(sum(count('sent')))} sub={`${count('sent').length} Rechnungen`} />
          <StatCard label="Überfällig" value={money(sum(docs.filter(isOverdue)))} tone={docs.some(isOverdue) ? 'danger' : undefined} sub={`${docs.filter(isOverdue).length} Rechnungen`} />
          <StatCard label={`Bezahlt ${year}`} value={money(sum(docs.filter((d) => d.status === 'paid' && d.paidDate.startsWith(year))))} sub="brutto" />
          <StatCard label={`Gestellt ${year}`} value={money(sum(docs.filter((d) => d.date.startsWith(year) && d.status !== 'draft' && d.status !== 'cancelled'), 'net'))} sub="netto" />
        </>
      );
      case 'offer': return (
        <>
          <StatCard label="Versendet" value={money(sum(count('sent'), 'net'))} sub={`${count('sent').length} Angebote, netto`} />
          <StatCard label="Angenommen" value={money(sum(count('accepted'), 'net'))} tone="success" sub={`${count('accepted').length} Angebote`} />
          <StatCard label="Entwürfe" value={String(count('draft').length)} sub="in Bearbeitung" />
          <StatCard label="Annahmequote" value={(() => {
            const decided = docs.filter((d) => d.status === 'accepted' || d.status === 'declined');
            return decided.length ? `${Math.round((count('accepted').length / decided.length) * 100)} %` : '–';
          })()} sub="angenommen / entschieden" />
        </>
      );
      case 'confirmation': return (
        <>
          <StatCard label="Bestätigt" value={money(sum(count('sent'), 'net'))} sub={`${count('sent').length} offene Aufträge, netto`} />
          <StatCard label="Erledigt" value={String(count('accepted').length)} tone="success" sub="abgerechnet" />
          <StatCard label="Entwürfe" value={String(count('draft').length)} sub="in Bearbeitung" />
        </>
      );
      case 'delivery': return (
        <>
          <StatCard label="Geliefert" value={String(count('sent').length)} tone="success" sub={`davon ${count('sent').filter((d) => d.date.startsWith(year)).length} in ${year}`} />
          <StatCard label="Entwürfe" value={String(count('draft').length)} sub="noch nicht geliefert" />
        </>
      );
      case 'order': return (
        <>
          <StatCard label="Bestellt" value={money(sum(count('sent'), 'net'))} sub={`${count('sent').length} offen, netto`} />
          <StatCard label={`Erhalten ${year}`} value={money(sum(count('accepted').filter((d) => d.date.startsWith(year)), 'net'))} tone="success" sub="Wareneingang, netto" />
          <StatCard label="Entwürfe" value={String(count('draft').length)} sub="in Bearbeitung" />
        </>
      );
    }
  })();

  return (
    <div className="page">
      <PageHeader title={cfg.many} description={cfg.description}
        actions={<button className="btn btn-primary" onClick={create}><Plus size={16} /> {newLabel}</button>} />

      <QuotaBar kind={kind} />

      <div className="stats">{stats}</div>

      <section className="card">
        <div className="toolbar">
          <Segmented value={filter} options={filters} onChange={setFilter} />
          <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Nummer, ${cfg.partner}, Betreff…`} /></label>
        </div>
        {visible.length ? (
          <div className="table">
            <div className="tr th">
              <span>{cfg.one}</span>
              <span className="hide-sm">Datum</span>
              <span className="hide-sm">{isInvoice ? 'Fällig' : cfg.dueLabel}</span>
              <span>Status</span>
              <span className="td-num">{cfg.prices ? 'Betrag' : 'Positionen'}</span>
            </div>
            {visible.map((d) => {
              const st = displayStatus(d);
              return (
                <Link key={d.id} href={docEditPath(d)} className="tr tr-5">
                  <span className="td-main"><Icon size={16} /><span><strong>{d.number}</strong><small>{d.recipient.name || 'Kein Empfänger'}{d.subject ? ` · ${d.subject}` : ''}</small></span></span>
                  <span className="td-muted hide-sm">{formatDate(d.date)}</span>
                  <span className="td-muted hide-sm">{formatDate(d.dueDate)}</span>
                  <span><Badge tone={st.tone}>{st.label}</Badge></span>
                  <span className="td-num">{cfg.prices ? money(docTotals(d.items, small).gross) : d.items.length}</span>
                </Link>
              );
            })}
          </div>
        ) : docs.length ? (
          <p className="muted pad">Keine Treffer für diesen Filter.</p>
        ) : (
          <Empty icon={<Icon />} title={`Noch keine ${cfg.many}`} text={cfg.emptyText}
            action={<button className="btn btn-primary" onClick={create}><Plus size={16} /> {cfg.one} erstellen</button>} />
        )}
      </section>
    </div>
  );
}
