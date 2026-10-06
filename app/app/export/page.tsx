'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, Info } from 'lucide-react';
import { MONTHS_LONG, formatDate, money, periodFor } from '../../../lib/calc';
import { ACCOUNT_LABELS, account, datevBookings, datevCsv, defaultAccount, toWindows1252 } from '../../../lib/datev';
import { useStore } from '../../../lib/store';
import { countryCode } from '../../../lib/tax';
import type { DatevSettings } from '../../../lib/types';
import { Field, PageHeader, Segmented } from '../../../components/app/ui';

type Mode = 'year' | 'q1' | 'q2' | 'q3' | 'q4' | 'month';

export default function ExportPage() {
  const { data, saveSettings } = useStore();
  const s = data.settings.datev;
  const set = (patch: Partial<DatevSettings>) => saveSettings({ ...data.settings, datev: { ...s, ...patch } });
  const years = useMemo(() => {
    const ys = new Set<string>([String(new Date().getFullYear())]);
    data.documents.forEach((d) => ys.add(d.date.slice(0, 4)));
    data.expenses.forEach((e) => ys.add(e.date.slice(0, 4)));
    return [...ys].sort().reverse();
  }, [data.documents, data.expenses]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(new Date().getMonth());
  const [showAccounts, setShowAccounts] = useState(false);
  const period = periodFor(year, mode === 'month' ? month : mode);
  const bookings = datevBookings(data, period);
  const isGermany = countryCode(data.company?.country) === 'DE';
  const missing = !s.advisorNumber || !s.clientNumber;

  const download = () => {
    const bytes = toWindows1252(datevCsv(data, period, bookings));
    const blob = new Blob([bytes as BlobPart], { type: 'text/csv;charset=windows-1252' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EXTF_Buchungsstapel_${period.from.replace(/-/g, '')}-${period.to.replace(/-/g, '')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  return (
    <div className="page">
      <PageHeader title="DATEV-Export" description="Rechnungen, Zahlungen, Einnahmen und Ausgaben als DATEV-Buchungsstapel für Ihre Steuerberatung."
        actions={<button className="btn btn-primary" onClick={download} disabled={!bookings.length}><Download size={16} /> Buchungsstapel herunterladen</button>} />

      {!isGermany ? <div className="notice notice-warn"><Info size={16} /><span>DATEV wird vor allem in Deutschland genutzt. Für Österreich und die Schweiz eignet sich der CSV-Export unter „GuV & Finanzen“; die Kontenzuordnung unten können Sie trotzdem anpassen.</span></div> : null}

      <section className="card">
        <div className="card-head"><div><h2>Zeitraum</h2><p>{period.label} · {bookings.length} Buchungen</p></div></div>
        <div className="filters">
          <select className="select-inline" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Jahr">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Segmented value={mode} onChange={setMode} options={[['month', 'Monat'], ['q1', 'Q1'], ['q2', 'Q2'], ['q3', 'Q3'], ['q4', 'Q4'], ['year', 'Jahr']]} />
          {mode === 'month' ? (
            <select className="select-inline" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Monat">
              {MONTHS_LONG.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          ) : null}
        </div>
        {bookings.length ? (
          <div className="table datev-table">
            <div className="tr th tr-datev"><span>Datum</span><span>Beleg</span><span className="hide-sm">Buchungstext</span><span>Konto</span><span>Gegenkonto</span><span className="hide-sm">BU</span><span className="td-num">Betrag</span></div>
            {bookings.slice(0, 50).map((b, i) => (
              <div key={i} className="tr tr-datev">
                <span className="td-muted">{formatDate(b.date)}</span>
                <span>{b.receipt || '—'}</span>
                <span className="td-muted hide-sm ellipsis">{b.text}</span>
                <span>{b.account}</span>
                <span>{b.contra}</span>
                <span className="td-muted hide-sm">{b.buKey || '–'}</span>
                <span className="td-num">{money(b.amount)}</span>
              </div>
            ))}
            {bookings.length > 50 ? <p className="muted small pad-s">… und {bookings.length - 50} weitere Buchungen in der Datei.</p> : null}
          </div>
        ) : <p className="muted pad">Keine Buchungen in diesem Zeitraum.</p>}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>DATEV-Einstellungen</h2><p>Die Angaben erhalten Sie von Ihrer Steuerberatung.</p></div></div>
        {missing ? <p className="field-hint mb">Ohne Berater- und Mandantennummer lässt sich der Stapel zwar erzeugen, in DATEV müssen diese aber beim Import passen.</p> : null}
        <div className="form-grid">
          <Field label="Beraternummer"><input inputMode="numeric" value={s.advisorNumber} onChange={(e) => set({ advisorNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })} placeholder="z. B. 1234567" /></Field>
          <Field label="Mandantennummer"><input inputMode="numeric" value={s.clientNumber} onChange={(e) => set({ clientNumber: e.target.value.replace(/\D/g, '').slice(0, 5) })} placeholder="z. B. 10001" /></Field>
          <Field label="Kontenrahmen"><Segmented value={s.chart} onChange={(chart) => set({ chart })} options={[['SKR03', 'SKR03'], ['SKR04', 'SKR04']]} /></Field>
          <Field label="Wirtschaftsjahr beginnt" hint="MM-TT, meist 01-01"><input value={s.fiscalYearStart} onChange={(e) => set({ fiscalYearStart: e.target.value })} placeholder="01-01" /></Field>
          <Field label="Sachkontenlänge"><select value={s.accountLength} onChange={(e) => set({ accountLength: Number(e.target.value) })}>{[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          <label className="check"><input type="checkbox" checked={s.debtorPerCustomer} onChange={(e) => set({ debtorPerCustomer: e.target.checked })} /><span>Eigenes Debitorenkonto je Kunde<br /><small className="muted">{account(s, 'debtor')} + Kundennummer, sonst Sammeldebitor</small></span></label>
        </div>
        <button className="link mt" onClick={() => setShowAccounts(!showAccounts)}><ChevronDown size={15} style={{ transform: showAccounts ? 'rotate(180deg)' : undefined }} /> Kontenzuordnung {showAccounts ? 'ausblenden' : 'anpassen'}</button>
        {showAccounts ? (
          <div className="account-grid">
            {ACCOUNT_LABELS.map(([key, label]) => (
              <Field key={key} label={label}>
                <input inputMode="numeric" value={s.accounts[key] ?? ''} placeholder={defaultAccount(s.chart, key)}
                  onChange={(e) => set({ accounts: { ...s.accounts, [key]: e.target.value.replace(/\D/g, '') } })} />
              </Field>
            ))}
          </div>
        ) : null}
        <div className="datev-note"><FileSpreadsheet size={16} /><p>Erzeugt wird ein DATEV-Buchungsstapel (Format EXTF 700) mit Rechnungen (Debitor an Erlös), Zahlungseingängen (Bank an Debitor), Einnahmen und Ausgaben (Kosten an Bank) inklusive BU-Schlüssel. Ihre Steuerberatung importiert die Datei über „Stapelverarbeitung → Import“. Bitte stimmen Sie die Kontenzuordnung einmalig mit ihr ab.</p></div>
      </section>
    </div>
  );
}
