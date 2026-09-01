'use client';

import { useState } from 'react';
import { BriefcaseBusiness, FileText, LayoutDashboard, Users, WalletCards } from 'lucide-react';

type ViewId = 'uebersicht' | 'auftraege' | 'kunden' | 'finanzen' | 'dokumente';

const navigation = [
  { id: 'uebersicht' as ViewId, label: 'Übersicht', icon: LayoutDashboard },
  { id: 'auftraege' as ViewId, label: 'Aufträge', icon: BriefcaseBusiness },
  { id: 'kunden' as ViewId, label: 'Kunden', icon: Users },
  { id: 'finanzen' as ViewId, label: 'Finanzen', icon: WalletCards },
  { id: 'dokumente' as ViewId, label: 'Dokumente', icon: FileText },
];

const orders = [
  ['BA-2026-018', 'Neubau Müller', '18.750 €', 'In Arbeit'],
  ['BA-2026-017', 'Sanierung Altbau', '12.340 €', 'In Arbeit'],
  ['BA-2026-016', 'Anbau Wohnhaus', '8.950 €', 'Geplant'],
  ['BA-2026-015', 'Dachgeschossausbau', '14.500 €', 'Freigabe'],
];

const customers = [
  ['MM', 'Müller Innenausbau', 'Max Müller', '3 offene Vorgänge'],
  ['AK', 'Architektur König', 'Anna König', '1 offenes Angebot'],
  ['WL', 'Wohnbau Lange', 'Stefan Lange', 'Aktiver Kunde'],
  ['PW', 'Privatkunde Wagner', 'Petra Wagner', 'Rechnung offen'],
];

const documents = [
  ['RE-2026-045', 'Bauprojekt Schmidt', '2.850,00 €', 'Bezahlt'],
  ['RE-2026-044', 'Müller Innenausbau', '4.120,00 €', 'Teilweise bezahlt'],
  ['ANG-2026-028', 'Neubau Müller', '18.750,00 €', 'In Bearbeitung'],
  ['RE-2026-042', 'Privatkunde Wagner', '3.450,00 €', 'Überfällig'],
];

function Overview() {
  return <>
    <div className="dash-metrics">
      <article><small>Offene Aufträge</small><strong>18</strong><span>↗ 12% diesen Monat</span></article>
      <article><small>Umsatz im September</small><strong>€ 42.850</strong><span>↗ 8,4% zum Vormonat</span></article>
      <article><small>Offene Rechnungen</small><strong>9</strong><em>€ 12.620 ausstehend</em></article>
    </div>
    <div className="dash-overview-grid">
      <article className="dash-chart-card">
        <div className="dash-card-head"><div><small>GESCHÄFTSENTWICKLUNG</small><h4>Einnahmen &amp; Ausgaben</h4></div><button type="button">Dieses Jahr⌄</button></div>
        <div className="dash-chart"><div className="dash-gridlines"/><svg viewBox="0 0 700 240" role="img" aria-label="Steigende Umsatzentwicklung"><path className="dash-area" d="M0 190 C65 185 85 145 140 150 S230 105 290 125 S380 72 440 98 S545 58 600 70 S665 35 700 43 L700 240 L0 240Z"/><path className="dash-line" d="M0 190 C65 185 85 145 140 150 S230 105 290 125 S380 72 440 98 S545 58 600 70 S665 35 700 43"/></svg><div className="dash-months"><span>Jan</span><span>Mär</span><span>Mai</span><span>Jul</span><span>Sep</span><span>Nov</span></div></div>
      </article>
      <article className="dash-tasks"><div className="dash-card-head"><div><small>HEUTE</small><h4>Nächste Schritte</h4></div><b>4</b></div>{[['Angebot Müller senden','Erledigt',true],['Rechnung RE-028 prüfen','Heute, 14:00',false],['Materialbestand aktualisieren','Heute',false]].map(([task,time,done])=><div className="dash-task" key={String(task)}><i className={done?'checked':''}>{done?'✓':''}</i><p><strong>{String(task)}</strong><small>{String(time)}</small></p></div>)}</article>
    </div>
  </>;
}

function ListView({ kind }: { kind: Exclude<ViewId, 'uebersicht' | 'finanzen'> }) {
  const config = kind === 'auftraege'
    ? { kicker:'AUFTRAGSMANAGEMENT', title:'Aktive Aufträge', copy:'Alle laufenden Vorgänge mit Status und Auftragswert.', data:orders, columns:['Nummer','Projekt','Wert','Status'] }
    : kind === 'kunden'
      ? { kicker:'KUNDENMANAGEMENT', title:'Kunden', copy:'Kontakte, Unternehmen und offene Themen im Überblick.', data:customers, columns:['Kontakt','Unternehmen','Ansprechpartner','Status'] }
      : { kicker:'DOKUMENTE', title:'Angebote & Rechnungen', copy:'Dokumente und Zahlungsstände zentral verwalten.', data:documents, columns:['Nummer','Kunde / Projekt','Betrag','Status'] };
  return <div className="dash-list-view"><div className="dash-view-head"><div><small>{config.kicker}</small><h3>{config.title}</h3><p>{config.copy}</p></div><button type="button">+ Neu anlegen</button></div><div className="dash-table"><div className="dash-table-row dash-table-head">{config.columns.map(x=><span key={x}>{x}</span>)}</div>{config.data.map((row,index)=><div className="dash-table-row" key={row[0]}>{row.map((cell,i)=><span key={cell} className={i===3?`status status-${index}`:''}>{i===0&&kind==='kunden'?<b className="customer-avatar">{cell}</b>:cell}</span>)}</div>)}</div></div>;
}

function FinanceView() {
  return <div className="dash-finance-view"><div className="dash-view-head"><div><small>FINANZEN</small><h3>Finanzübersicht</h3><p>Einnahmen, Ausgaben und offene Posten auf einen Blick.</p></div><button type="button">Bericht exportieren</button></div><div className="finance-kpis"><article><small>Einnahmen</small><strong>86.250 €</strong><span>+14,2 %</span></article><article><small>Ausgaben</small><strong>31.480 €</strong><span className="neutral">+3,1 %</span></article><article><small>Ergebnis</small><strong>54.770 €</strong><span>+21,8 %</span></article></div><article className="finance-chart"><div className="dash-card-head"><div><small>MONATSVERLAUF</small><h4>Einnahmen vs. Ausgaben</h4></div></div><div className="finance-bars">{[42,55,48,68,73,88,81,96].map((height,i)=><div key={height}><i style={{height:`${height}%`}}/><em style={{height:`${Math.max(25,height-31)}%`}}/><small>{['Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep'][i]}</small></div>)}</div></article></div>;
}

export function ProductMap() {
  const [active, setActive] = useState<ViewId>('uebersicht');
  const currentLabel = navigation.find(item => item.id === active)?.label ?? 'Übersicht';
  return (
    <div className="interactive-dashboard">
      <aside className="dash-sidebar">
        <div className="dash-logo"><span className="mini-brand-mark"><i/><i/></span><b>VYSN</b></div>
        <div className="dash-nav" aria-label="Interaktive Produktnavigation">{navigation.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={active===item.id?'active':''} onClick={()=>setActive(item.id)} aria-pressed={active===item.id}><Icon/><span>{item.label}</span></button>})}</div>
        <div className="dash-plan"><strong>VYSN ONE</strong><small>Dein aktueller Plan</small></div>
      </aside>
      <section className="dash-main" aria-live="polite">
        <div className="dash-top"><div><small>DIENSTAG, 1. SEPTEMBER · {currentLabel.toUpperCase()}</small><h2>{active==='uebersicht'?'Guten Morgen, Max.':currentLabel}</h2></div><span>MM</span></div>
        {active === 'uebersicht' ? <Overview /> : active === 'finanzen' ? <FinanceView /> : <ListView kind={active} />}
      </section>
    </div>
  );
}
