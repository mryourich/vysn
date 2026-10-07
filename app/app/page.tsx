'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, FilePlus2, FileText, Plus } from 'lucide-react';
import { DOC_ICONS } from '../../components/app/doc-list';
import type { DocKind } from '../../lib/types';
import { displayStatus, docTotals, formatDate, isOverdue, money, monthlySeries, periodFor, profitLoss, today } from '../../lib/calc';
import { useStore } from '../../lib/store';
import { DOC_KINDS, docEditPath } from '../../lib/docs';
import { RevenueChart } from '../../components/app/bar-chart';
import { Badge, PageHeader, StatCard } from '../../components/app/ui';

export default function DashboardPage() {
  const { data, createDoc, can, requireFeature } = useStore();
  const router = useRouter();
  const company = data.company!;
  const small = company.smallBusiness;
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const plYear = profitLoss(data, periodFor(year, 'year'), 'cash');
  const plMonth = profitLoss(data, periodFor(year, month), 'cash');
  const series = monthlySeries(data, year, 'cash');

  const invoices = data.documents.filter((d) => d.kind === 'invoice');
  const openInvoices = invoices.filter((d) => d.status === 'sent');
  const overdue = openInvoices.filter(isOverdue);
  const openSum = openInvoices.reduce((s, d) => s + docTotals(d.items, small).gross, 0);
  const overdueSum = overdue.reduce((s, d) => s + docTotals(d.items, small).gross, 0);
  const openOffers = data.documents.filter((d) => d.kind === 'offer' && d.status === 'sent');
  const offerSum = openOffers.reduce((s, d) => s + docTotals(d.items, small).net, 0);
  const lowStock = data.materials.filter((m) => m.minStock > 0 && m.stock <= m.minStock);
  const recent = [...data.documents].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6);

  const hour = new Date().getHours();
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  const newDoc = async (kind: DocKind) => {
    const doc = await createDoc(kind);
    if (!doc) return;
    router.push(docEditPath(doc));
  };

  return (
    <div className="page">
      <PageHeader
        title={`${hello}${company.owner ? ', ' + company.owner.split(' ')[0] : ''}`}
        description={`${company.name} · ${formatDate(today())}`}
        actions={<>
          <button className="btn" onClick={() => newDoc('offer')}><FilePlus2 size={16} /> Angebot</button>
          <button className="btn btn-primary" onClick={() => newDoc('invoice')}><Plus size={16} /> Rechnung</button>
        </>}
      />

      <div className="stats">
        <StatCard label={`Umsatz ${year}`} value={money(plYear.revenue)} sub={`davon ${money(plMonth.revenue)} im laufenden Monat`} />
        <StatCard label={`Ergebnis ${year}`} value={money(plYear.result)} tone={plYear.result < 0 ? 'danger' : undefined}
          sub={plYear.revenue ? `Marge ${(plYear.margin * 100).toFixed(1).replace('.', ',')} %` : 'Noch keine Umsätze'} />
        <StatCard label="Offene Forderungen" value={money(openSum)} tone={overdue.length ? 'warning' : undefined}
          sub={overdue.length ? <span className="text-danger">{overdue.length} überfällig · {money(overdueSum)}</span> : `${openInvoices.length} offene Rechnungen`} />
        <StatCard label="Offene Angebote" value={money(offerSum)} sub={`${openOffers.length} versendet, netto`} />
      </div>

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head">
            <div><h2>Umsatz & Ausgaben {year}</h2><p>Nach Zahlungseingang, netto</p></div>
            <Link href="/app/guv" className="link" onClick={(e) => { if (!can('reports')) { e.preventDefault(); requireFeature('reports'); } }}>Zur GuV <ArrowRight size={14} /></Link>
          </div>
          <RevenueChart data={series} />
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Zu erledigen</h2><p>Was heute Aufmerksamkeit braucht</p></div></div>
          <ul className="todo">
            {overdue.slice(0, 4).map((d) => (
              <li key={d.id}><Link href={docEditPath(d)}>
                <AlertTriangle size={16} className="text-danger" />
                <span><strong>{d.number} überfällig</strong><small>{d.recipient.name} · fällig {formatDate(d.dueDate)}</small></span>
                <b>{money(docTotals(d.items, small).gross)}</b>
              </Link></li>
            ))}
            {lowStock.slice(0, 4).map((m) => (
              <li key={m.id}><Link href="/app/material">
                <AlertTriangle size={16} className="text-warning" />
                <span><strong>{m.name}</strong><small>Bestand {m.stock} {m.unit} · Mindestbestand {m.minStock}</small></span>
                <b>Nachbestellen</b>
              </Link></li>
            ))}
            {data.documents.filter((d) => d.status === 'draft').slice(0, 3).map((d) => (
              <li key={d.id}><Link href={docEditPath(d)}>
                <FileText size={16} className="text-muted" />
                <span><strong>{DOC_KINDS[d.kind].one} {d.number} im Entwurf</strong><small>{d.recipient.name || 'Kein Empfänger'}</small></span>
                <b>Öffnen</b>
              </Link></li>
            ))}
            {!overdue.length && !lowStock.length && !data.documents.some((d) => d.status === 'draft') ? (
              <li className="todo-empty">Alles erledigt. Keine überfälligen Rechnungen, keine Entwürfe, Lager ausreichend gefüllt.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div><h2>Zuletzt bearbeitet</h2><p>Angebote und Rechnungen</p></div>
          <Link href="/app/rechnungen" className="link">Alle Rechnungen <ArrowRight size={14} /></Link>
        </div>
        {recent.length ? (
          <div className="table">
            {recent.map((d) => {
              const st = displayStatus(d);
              return (
                <Link key={d.id} className="tr" href={docEditPath(d)}>
                  <span className="td-main">{(() => { const I = DOC_ICONS[d.kind]; return <I size={16} />; })()}<span><strong>{d.number}</strong><small>{d.recipient.name || '—'}{d.subject ? ` · ${d.subject}` : ''}</small></span></span>
                  <span className="td-muted hide-sm">{formatDate(d.date)}</span>
                  <span><Badge tone={st.tone}>{st.label}</Badge></span>
                  <span className="td-num">{money(docTotals(d.items, small).gross)}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="muted pad">Noch keine Belege. Erstellen Sie oben Ihr erstes Angebot oder Ihre erste Rechnung.</p>
        )}
      </section>
    </div>
  );
}
