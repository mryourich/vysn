'use client';

import { formatDate, money, today } from '../../lib/calc';
import type { ProfitLoss } from '../../lib/calc';
import type { Company } from '../../lib/types';
import { Img, PageFrame, PageNumber, T, V } from './primitives';
import type { Style } from './primitives';

type Props = { company: Company; pl: ProfitLoss; periodLabel: string; basisLabel: string; accent: string };

const MUTED = '#6a717a';
const LINE = '#dcdfe3';

export function ReportTemplate({ company, pl, periodLabel, basisLabel, accent }: Props) {
  const bold: Style = { fontFamily: 'Helvetica', fontWeight: 'bold' };
  const row = (label: string, value: number, opts: { strong?: boolean; indent?: boolean; sign?: '-' | '+' } = {}) => (
    <V key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: opts.strong ? 6 : 3.5, paddingLeft: opts.indent ? 14 : 0, borderBottomWidth: 0.5, borderBottomColor: LINE, backgroundColor: opts.strong ? '#f4f5f7' : undefined, paddingHorizontal: opts.strong ? 6 : undefined }}>
      <T style={opts.strong ? bold : { color: opts.indent ? MUTED : '#1d232a' }}>{label}</T>
      <T style={opts.strong ? bold : {}}>{`${opts.sign === '-' && value ? '– ' : ''}${money(value)}`}</T>
    </V>
  );
  return (
    <PageFrame title={`GuV ${periodLabel}`} style={{ fontFamily: 'Helvetica', fontSize: 9.5, paddingTop: 44, paddingBottom: 60, paddingHorizontal: 50, color: '#1d232a' }}>
      <V style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
        <V>
          <T style={[bold, { fontSize: 11 }]}>{company.name}</T>
          <T style={{ fontSize: 8, color: MUTED }}>{[company.street, [company.zip, company.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</T>
        </V>
        {company.logo ? <Img src={company.logo} style={{ height: 34, width: Math.min(34 * (company.logoRatio || 1), 160) }} /> : null}
      </V>
      <T style={[bold, { fontSize: 17, color: accent }]}>Gewinn- und Verlustrechnung</T>
      <T style={{ color: MUTED, marginTop: 2, marginBottom: 18 }}>{`${periodLabel} · ${basisLabel} · erstellt am ${formatDate(today())}`}</T>

      {row('Umsatzerlöse (netto)', pl.revenue, { strong: true })}
      <V style={{ height: 8 }} />
      {pl.costOfSales.map((r) => row(r.category, r.amount, { indent: true, sign: '-' }))}
      {row('Material- und Wareneinsatz', pl.costOfSalesTotal, { sign: '-' })}
      <V style={{ height: 8 }} />
      {row('Rohertrag', pl.grossProfit, { strong: true })}
      <V style={{ height: 8 }} />
      {pl.operating.map((r) => row(r.category, r.amount, { indent: true, sign: '-' }))}
      {row('Betriebliche Aufwendungen', pl.operatingTotal, { sign: '-' })}
      <V style={{ height: 8 }} />
      {row(pl.result >= 0 ? 'Ergebnis (Gewinn vor Steuern)' : 'Ergebnis (Verlust vor Steuern)', pl.result, { strong: true })}

      {company.smallBusiness ? (
        <T style={{ marginTop: 18, fontSize: 8.5, color: MUTED }}>Kleinunternehmer gem. § 19 UStG – Ausgaben sind brutto als Aufwand erfasst, es wird keine Umsatzsteuer ausgewiesen.</T>
      ) : (
        <V style={{ marginTop: 24 }}>
          <T style={[bold, { marginBottom: 6, color: accent }]}>Umsatzsteuer im Zeitraum</T>
          {row('Vereinnahmte Umsatzsteuer', pl.outputVat)}
          {row('Gezahlte Vorsteuer', pl.inputVat, { sign: '-' })}
          {row(pl.vatPayable >= 0 ? 'Zahllast' : 'Erstattung', Math.abs(pl.vatPayable), { strong: true })}
        </V>
      )}

      <T style={{ marginTop: 22, fontSize: 7.5, color: MUTED }}>
        Vereinfachte Auswertung auf Basis der in VYSN One erfassten Rechnungen und Ausgaben. Ersetzt keinen steuerlichen Jahresabschluss.
      </T>
      <V fixed style={{ position: 'absolute', bottom: 26, left: 50, right: 50, flexDirection: 'row', justifyContent: 'space-between' }}>
        <T style={{ fontSize: 7, color: MUTED }}>{company.name}</T>
        <PageNumber style={{ fontSize: 7, color: MUTED }} />
      </V>
    </PageFrame>
  );
}
