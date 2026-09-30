'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FileText, Plus, ReceiptText, Search } from 'lucide-react';
import { displayStatus, docTotals, formatDate, isOverdue, money } from '../../lib/calc';
import { useStore } from '../../lib/store';
import type { DocKind } from '../../lib/types';
import { Badge, Empty, PageHeader, Segmented, StatCard } from './ui';

export function DocList({ kind }: { kind: DocKind }) {
  const { data, createDoc } = useStore();
  const router = useRouter();
  const isInvoice = kind === 'invoice';
  const base = isInvoice ? '/app/rechnungen' : '/app/angebote';
  const small = !!data.company?.smallBusiness;
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const docs = useMemo(() => data.documents.filter((d) => d.kind === kind).sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number)), [data.documents, kind]);

  const filters: [string, string][] = isInvoice
    ? [['all', 'Alle'], ['open', 'Offen'], ['overdue', 'Überfällig'], ['paid', 'Bezahlt'], ['draft', 'Entwürfe']]
    : [['all', 'Alle'], ['draft', 'Entwürfe'], ['sent', 'Versendet'], ['accepted', 'Angenommen'], ['declined', 'Abgelehnt']];

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

  const sum = (list: typeof docs, field: 'net' | 'gross' = 'gross') => list.reduce((s, d) => s + docTotals(d.items, small)[field], 0);
  const create = () => {
    const doc = createDoc(kind);
    router.push(`${base}/bearbeiten?id=${doc.id}`);
  };
  const year = String(new Date().getFullYear());

  return (
    <div className="page">
      <PageHeader
        title={isInvoice ? 'Rechnungen' : 'Angebote'}
        description={isInvoice ? 'Rechnungen gestalten, versenden und Zahlungseingänge verfolgen.' : 'Angebote erstellen und mit einem Klick in Rechnungen umwandeln.'}
        actions={<button className="btn btn-primary" onClick={create}><Plus size={16} /> {isInvoice ? 'Neue Rechnung' : 'Neues Angebot'}</button>}
      />

      <div className="stats">
        {isInvoice ? (
          <>
            <StatCard label="Offen" value={money(sum(docs.filter((d) => d.status === 'sent')))} sub={`${docs.filter((d) => d.status === 'sent').length} Rechnungen`} />
            <StatCard label="Überfällig" value={money(sum(docs.filter(isOverdue)))} tone={docs.some(isOverdue) ? 'danger' : undefined} sub={`${docs.filter(isOverdue).length} Rechnungen`} />
            <StatCard label={`Bezahlt ${year}`} value={money(sum(docs.filter((d) => d.status === 'paid' && d.paidDate.startsWith(year))))} sub="brutto" />
            <StatCard label={`Gestellt ${year}`} value={money(sum(docs.filter((d) => d.date.startsWith(year) && d.status !== 'draft' && d.status !== 'cancelled'), 'net'))} sub="netto" />
          </>
        ) : (
          <>
            <StatCard label="Versendet" value={money(sum(docs.filter((d) => d.status === 'sent'), 'net'))} sub={`${docs.filter((d) => d.status === 'sent').length} Angebote, netto`} />
            <StatCard label="Angenommen" value={money(sum(docs.filter((d) => d.status === 'accepted'), 'net'))} tone="success" sub={`${docs.filter((d) => d.status === 'accepted').length} Angebote`} />
            <StatCard label="Entwürfe" value={String(docs.filter((d) => d.status === 'draft').length)} sub="in Bearbeitung" />
            <StatCard label="Annahmequote" value={(() => {
              const decided = docs.filter((d) => d.status === 'accepted' || d.status === 'declined');
              return decided.length ? `${Math.round((docs.filter((d) => d.status === 'accepted').length / decided.length) * 100)} %` : '–';
            })()} sub="angenommen / entschieden" />
          </>
        )}
      </div>

      <section className="card">
        <div className="toolbar">
          <Segmented value={filter} options={filters} onChange={setFilter} />
          <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nummer, Kunde, Betreff…" /></label>
        </div>
        {visible.length ? (
          <div className="table">
            <div className="tr th">
              <span>{isInvoice ? 'Rechnung' : 'Angebot'}</span>
              <span className="hide-sm">Datum</span>
              <span className="hide-sm">{isInvoice ? 'Fällig' : 'Gültig bis'}</span>
              <span>Status</span>
              <span className="td-num">Betrag</span>
            </div>
            {visible.map((d) => {
              const st = displayStatus(d);
              return (
                <Link key={d.id} href={`${base}/bearbeiten?id=${d.id}`} className="tr tr-5">
                  <span className="td-main">{isInvoice ? <ReceiptText size={16} /> : <FileText size={16} />}<span><strong>{d.number}</strong><small>{d.recipient.name || 'Kein Empfänger'}{d.subject ? ` · ${d.subject}` : ''}</small></span></span>
                  <span className="td-muted hide-sm">{formatDate(d.date)}</span>
                  <span className="td-muted hide-sm">{formatDate(d.dueDate)}</span>
                  <span><Badge tone={st.tone}>{st.label}</Badge></span>
                  <span className="td-num">{money(docTotals(d.items, small).gross)}</span>
                </Link>
              );
            })}
          </div>
        ) : docs.length ? (
          <p className="muted pad">Keine Treffer für diesen Filter.</p>
        ) : (
          <Empty icon={isInvoice ? <ReceiptText /> : <FileText />} title={isInvoice ? 'Noch keine Rechnungen' : 'Noch keine Angebote'}
            text={isInvoice ? 'Erstellen Sie Ihre erste Rechnung – Positionen aus dem Materialstamm übernehmen, PDF herunterladen, fertig.' : 'Erstellen Sie Ihr erstes Angebot und wandeln Sie es später mit einem Klick in eine Rechnung um.'}
            action={<button className="btn btn-primary" onClick={create}><Plus size={16} /> {isInvoice ? 'Rechnung erstellen' : 'Angebot erstellen'}</button>} />
        )}
      </section>
    </div>
  );
}
