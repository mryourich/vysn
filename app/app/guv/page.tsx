'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { MONTHS_LONG, money, monthlySeries, periodFor, profitLoss } from '../../../lib/calc';
import type { Basis } from '../../../lib/calc';
import { useStore } from '../../../lib/store';
import { taxProfile } from '../../../lib/tax';
import { RevenueChart } from '../../../components/app/bar-chart';
import { downloadPdf } from '../../../components/pdf/export';
import { ReportTemplate } from '../../../components/pdf/report-template';
import { PageHeader, Segmented, StatCard } from '../../../components/app/ui';

type Mode = 'year' | 'q1' | 'q2' | 'q3' | 'q4' | 'month';

export default function ProfitLossPage() {
  const { data } = useStore();
  const company = data.company!;
  const tax = taxProfile(company);
  const years = useMemo(() => {
    const s = new Set<string>([String(new Date().getFullYear())]);
    data.documents.forEach((d) => s.add(d.date.slice(0, 4)));
    data.expenses.forEach((e) => s.add(e.date.slice(0, 4)));
    return [...s].sort().reverse();
  }, [data.documents, data.expenses]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<Mode>('year');
  const [month, setMonth] = useState(new Date().getMonth());
  const [basis, setBasis] = useState<Basis>('cash');
  const [busy, setBusy] = useState(false);

  const period = periodFor(year, mode === 'month' ? month : mode);
  const pl = profitLoss(data, period, basis);
  const series = monthlySeries(data, year, basis);
  const basisLabel = basis === 'cash' ? 'Ist-Prinzip (Zahlungseingang)' : 'Soll-Prinzip (Rechnungsdatum)';
  const pct = (v: number) => (pl.revenue ? `${((v / pl.revenue) * 100).toFixed(1).replace('.', ',')} %` : '–');

  const exportPdf = async () => {
    setBusy(true);
    try {
      await downloadPdf(<ReportTemplate company={company} pl={pl} periodLabel={period.label} basisLabel={basisLabel} accent={data.design.accent} />, `GuV ${period.label}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = [['Monat', 'Umsatz netto', 'Ausgaben', 'Ergebnis'], ...series.map((r, i) => [`${MONTHS_LONG[i]} ${year}`, r.revenue, r.expenses, r.result].map(String))];
    const csv = rows.map((r) => r.map((c) => (/^-?\d+(\.\d+)?$/.test(c) ? c.replace('.', ',') : `"${c}"`)).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Monatsuebersicht ${year}.csv`;
    a.click();
  };

  const Line = ({ label, value, strong, indent, minus }: { label: string; value: number; strong?: boolean; indent?: boolean; minus?: boolean }) => (
    <div className={`pl-row${strong ? ' pl-strong' : ''}${indent ? ' pl-indent' : ''}`}>
      <span>{label}</span>
      <span className="pl-pct hide-sm">{strong || !indent ? pct(value) : ''}</span>
      <span className={strong && value < 0 ? 'text-danger' : ''}>{minus && value ? '– ' : ''}{money(value)}</span>
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="GuV & Finanzen" description="Gewinn- und Verlustrechnung aus Ihren Rechnungen und Ausgaben – automatisch aktuell."
        actions={<>
          <button className="btn" onClick={exportCsv}><FileSpreadsheet size={16} /> CSV</button>
          <button className="btn btn-primary" onClick={exportPdf} disabled={busy}><Download size={16} /> {busy ? 'Erstelle…' : 'GuV als PDF'}</button>
        </>} />

      <div className="filters">
        <select className="select-inline" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Jahr">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <Segmented value={mode} onChange={setMode} options={[['year', 'Jahr'], ['q1', 'Q1'], ['q2', 'Q2'], ['q3', 'Q3'], ['q4', 'Q4'], ['month', 'Monat']]} />
        {mode === 'month' ? (
          <select className="select-inline" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Monat">
            {MONTHS_LONG.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        ) : null}
        <Segmented value={basis} onChange={setBasis} options={[['cash', 'Ist (bezahlt)'], ['accrual', 'Soll (gestellt)']]} />
      </div>

      <div className="stats">
        <StatCard label="Umsatz netto" value={money(pl.revenue)} sub={`${pl.invoices} Rechnungen · ${period.label}`} />
        <StatCard label="Rohertrag" value={money(pl.grossProfit)} sub={`${pct(pl.grossProfit)} vom Umsatz`} />
        <StatCard label="Ergebnis" value={money(pl.result)} tone={pl.result < 0 ? 'danger' : 'success'} sub={`Marge ${pct(pl.result)}`} />
        {company.smallBusiness
          ? <StatCard label={tax.longLabel} value="–" sub={tax.smallBusinessLabel} />
          : <StatCard label={pl.vatPayable >= 0 ? `${tax.label}-Zahllast` : `${tax.label}-Erstattung`} value={money(Math.abs(pl.vatPayable))} sub={`${money(pl.outputVat)} ${tax.label} – ${money(pl.inputVat)} Vorsteuer`} />}
      </div>

      <div className="grid-2-1 grid-pl">
        <section className="card">
          <div className="card-head"><div><h2>Gewinn- und Verlustrechnung</h2><p>{period.label} · {basisLabel}</p></div></div>
          <div className="pl">
            <Line label="Umsatzerlöse" value={pl.revenue} strong />
            {pl.costOfSales.map((r) => <Line key={r.category} label={r.category} value={r.amount} indent minus />)}
            <Line label="Material- und Wareneinsatz" value={pl.costOfSalesTotal} minus />
            <Line label="Rohertrag" value={pl.grossProfit} strong />
            {pl.operating.map((r) => <Line key={r.category} label={r.category} value={r.amount} indent minus />)}
            <Line label="Betriebliche Aufwendungen" value={pl.operatingTotal} minus />
            <Line label={pl.result >= 0 ? 'Gewinn vor Steuern' : 'Verlust vor Steuern'} value={pl.result} strong />
          </div>
          <p className="muted small pad-s">Vereinfachte Auswertung für die Unternehmenssteuerung. Ersetzt nicht den Jahresabschluss durch Ihre Steuerberatung.</p>
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Kostenstruktur</h2><p>Anteil am Gesamtaufwand</p></div></div>
          <div className="bars">
            {[...pl.costOfSales, ...pl.operating].sort((a, b) => b.amount - a.amount).map((r) => {
              const total = pl.costOfSalesTotal + pl.operatingTotal;
              const share = total ? r.amount / total : 0;
              return (
                <div key={r.category} className="hbar" title={`${r.category}: ${money(r.amount)}`}>
                  <div className="hbar-label"><span>{r.category}</span><span>{money(r.amount)}</span></div>
                  <div className="hbar-track"><div style={{ width: `${Math.max(1, share * 100)}%` }} /></div>
                </div>
              );
            })}
            {!pl.costOfSales.length && !pl.operating.length ? <p className="muted small">Keine Ausgaben im Zeitraum.</p> : null}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><div><h2>Monatsverlauf {year}</h2><p>{basisLabel}</p></div></div>
        <RevenueChart data={series} />
        <div className="table month-table">
          <div className="tr th tr-month"><span>Monat</span><span className="td-num">Umsatz</span><span className="td-num">Ausgaben</span><span className="td-num">Ergebnis</span></div>
          {series.map((r, i) => (
            <div key={r.label} className="tr tr-month">
              <span>{MONTHS_LONG[i]}</span>
              <span className="td-num">{money(r.revenue)}</span>
              <span className="td-num td-muted">{money(r.expenses)}</span>
              <span className={`td-num${r.result < 0 ? ' text-danger' : ''}`}>{money(r.result)}</span>
            </div>
          ))}
          <div className="tr tr-month tr-total">
            <span>Summe</span>
            <span className="td-num">{money(series.reduce((s, r) => s + r.revenue, 0))}</span>
            <span className="td-num">{money(series.reduce((s, r) => s + r.expenses, 0))}</span>
            <span className="td-num">{money(series.reduce((s, r) => s + r.result, 0))}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
