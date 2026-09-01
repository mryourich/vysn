'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Bell, Boxes, BriefcaseBusiness, CalendarDays, Check, ChevronDown,
  CirclePlus, Download, FileCheck2, LayoutDashboard, Menu, Pencil, ReceiptText,
  Search, Settings, Trash2, Users, WalletCards, X
} from 'lucide-react';

type ModuleId = 'dashboard'|'orders'|'material'|'offers'|'invoices'|'finance'|'customers'|'reports'|'settings';
type EntityModule = 'orders'|'material'|'offers'|'invoices'|'customers';
type Row = { id:string; title:string; detail:string; value:string; status:string; meta?:string };
type Store = Record<EntityModule, Row[]>;

const nav = [
  ['dashboard','Dashboard',LayoutDashboard],['orders','Aufträge',BriefcaseBusiness],['material','Materialbestand',Boxes],
  ['offers','Angebote',FileCheck2],['invoices','Rechnungen',ReceiptText],['finance','Einnahmen & Ausgaben',WalletCards],
  ['customers','Kunden',Users],['reports','Berichte',BarChart3],['settings','Einstellungen',Settings]
] as const;

const initialStore:Store = {
  orders:[
    {id:'BA-2026-018',title:'Neubau Einfamilienhaus',detail:'Müller Bauprojekt',value:'18.750 €',status:'In Arbeit',meta:'65%'},
    {id:'BA-2026-017',title:'Sanierung Altbau',detail:'Wohnbau Lange',value:'12.340 €',status:'In Arbeit',meta:'40%'},
    {id:'BA-2026-016',title:'Anbau Wohnhaus',detail:'Familie Weber',value:'8.950 €',status:'Geplant',meta:'20%'},
    {id:'BA-2026-015',title:'Dachgeschossausbau',detail:'Klein Immobilien',value:'14.500 €',status:'In Arbeit',meta:'80%'}],
  material:[
    {id:'MAT-001',title:'Zement 25 kg',detail:'Baustoffe',value:'12 Sack',status:'Nachbestellen',meta:'Minimum 20'},
    {id:'MAT-002',title:'Holzlatten 4 × 6 cm',detail:'Holz',value:'18 Stück',status:'Niedrig',meta:'Minimum 25'},
    {id:'MAT-003',title:'Dämmwolle 10 cm',detail:'Dämmung',value:'5 Rollen',status:'Niedrig',meta:'Minimum 10'},
    {id:'MAT-004',title:'Rigipsplatte 12,5 mm',detail:'Trockenbau',value:'48 Platten',status:'Verfügbar',meta:'Minimum 20'}],
  offers:[
    {id:'ANG-2026-028',title:'Neubau Müller',detail:'Müller Bauprojekt',value:'18.750 €',status:'In Bearbeitung',meta:'01.09.2026'},
    {id:'ANG-2026-027',title:'Sanierung Schule',detail:'Gemeinde Nord',value:'12.340 €',status:'Versendet',meta:'28.08.2026'},
    {id:'ANG-2026-026',title:'Anbau Weber',detail:'Familie Weber',value:'8.950 €',status:'Entwurf',meta:'26.08.2026'},
    {id:'ANG-2026-025',title:'Dachausbau Klein',detail:'Klein Immobilien',value:'14.500 €',status:'Angenommen',meta:'20.08.2026'}],
  invoices:[
    {id:'RE-2026-045',title:'Bauprojekt Schmidt',detail:'Schmidt Projektbau',value:'2.850 €',status:'Bezahlt',meta:'30.08.2026'},
    {id:'RE-2026-044',title:'Müller Innenausbau',detail:'Müller GmbH',value:'4.120 €',status:'Teilweise bezahlt',meta:'05.09.2026'},
    {id:'RE-2026-043',title:'Architektur König',detail:'König Architektur',value:'1.980 €',status:'Bezahlt',meta:'25.08.2026'},
    {id:'RE-2026-042',title:'Privatkunde Wagner',detail:'Petra Wagner',value:'3.450 €',status:'Überfällig',meta:'18.08.2026'}],
  customers:[
    {id:'KD-001',title:'Müller Innenausbau GmbH',detail:'Max Müller · max@mueller.de',value:'3 Vorgänge',status:'Aktiv',meta:'+49 170 1234567'},
    {id:'KD-002',title:'Architektur König',detail:'Anna König · anna@koenig.de',value:'1 Angebot',status:'Aktiv',meta:'+49 171 2233445'},
    {id:'KD-003',title:'Wohnbau Lange',detail:'Stefan Lange · s.lange@wohnbau.de',value:'2 Aufträge',status:'Aktiv',meta:'+49 172 5566778'},
    {id:'KD-004',title:'Privatkunde Wagner',detail:'Petra Wagner · p.wagner@mail.de',value:'1 Rechnung',status:'Offen',meta:'+49 173 7788990'}]
};

const moduleCopy:Record<EntityModule,{eyebrow:string;title:string;description:string;button:string;labels:[string,string,string,string]}>= {
  orders:{eyebrow:'PROJEKTSTEUERUNG',title:'Aufträge',description:'Projekte, Fortschritt und Verantwortlichkeiten zentral steuern.',button:'Auftrag anlegen',labels:['Auftrag','Kunde','Auftragswert','Status']},
  material:{eyebrow:'LAGER & MATERIAL',title:'Materialbestand',description:'Bestände, Mindestmengen und Beschaffung im Blick behalten.',button:'Material anlegen',labels:['Material','Kategorie','Bestand','Status']},
  offers:{eyebrow:'VERKAUF',title:'Angebote',description:'Angebote erstellen, nachverfolgen und direkt in Aufträge überführen.',button:'Angebot erstellen',labels:['Angebot','Kunde','Betrag','Status']},
  invoices:{eyebrow:'ABRECHNUNG',title:'Rechnungen',description:'Zahlungseingänge, Fälligkeiten und offene Posten kontrollieren.',button:'Rechnung erstellen',labels:['Rechnung','Kunde','Betrag','Status']},
  customers:{eyebrow:'KUNDENVERWALTUNG',title:'Kunden',description:'Kontakte, Vorgänge und die gesamte Kundenhistorie an einem Ort.',button:'Kunde anlegen',labels:['Kunde','Kontakt','Vorgänge','Status']}
};

const euro = (value:string) => Number(value.replace(/[^0-9,-]/g,'').replace('.','').replace(',','.')) || 0;
const money = (value:number) => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);

function Brand(){return <div className="portal-brand"><span className="portal-logo"><i/><i/></span><b>VYSN</b><em>ONE</em></div>}

function Status({children}:{children:string}){
  const tone = /bezahlt|aktiv|verfügbar|angenommen/i.test(children)?'good':/überfällig|nachbestellen/i.test(children)?'danger':/niedrig|teilweise/i.test(children)?'warn':'info';
  return <span className={`portal-status ${tone}`}>{children}</span>;
}

function TrendChart(){return <div className="portal-chart"><div className="portal-chart-lines"/><svg viewBox="0 0 800 260" preserveAspectRatio="none" aria-label="Einnahmen und Ausgaben im Jahresverlauf" role="img"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1974f2" stopOpacity=".22"/><stop offset="1" stopColor="#1974f2" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 205 C55 200 75 160 125 164 S210 115 265 132 S355 84 410 107 S510 66 565 79 S665 43 720 55 S770 31 800 36 L800 260 L0 260Z"/><path className="income" d="M0 205 C55 200 75 160 125 164 S210 115 265 132 S355 84 410 107 S510 66 565 79 S665 43 720 55 S770 31 800 36"/><path className="expense" d="M0 226 C80 220 110 205 175 211 S285 187 350 202 S465 180 530 200 S650 177 710 190 S765 165 800 171"/></svg><div className="portal-months"><span>Jan</span><span>Mär</span><span>Mai</span><span>Jul</span><span>Sep</span><span>Nov</span></div></div>}

function Dashboard({store,onNavigate}:{store:Store;onNavigate:(id:ModuleId)=>void}){
  const openInvoices=store.invoices.filter(x=>x.status!=='Bezahlt');
  const lowStock=store.material.filter(x=>/Niedrig|Nachbestellen/.test(x.status));
  const openOffers=store.offers.filter(x=>x.status!=='Angenommen');
  return <>
    <div className="portal-page-head"><div><span>DIENSTAG, 1. SEPTEMBER 2026</span><h1>Guten Morgen, Max! 👋</h1><p>Hier ist die Übersicht für heute.</p></div></div>
    <div className="portal-kpis">
      <button onClick={()=>onNavigate('orders')}><i className="blue"><CalendarDays/></i><span>Offene Aufträge<strong>{store.orders.length}</strong><small>Gesamtwert: {money(store.orders.reduce((n,r)=>n+euro(r.value),0))}</small></span></button>
      <button onClick={()=>onNavigate('material')}><i className="cyan"><Boxes/></i><span>Lagerwert<strong>86.250 €</strong><small>{store.material.length} Positionen erfasst</small></span></button>
      <button onClick={()=>onNavigate('offers')}><i className="violet"><FileCheck2/></i><span>Offene Angebote<strong>{openOffers.length}</strong><small>Gesamtwert: {money(openOffers.reduce((n,r)=>n+euro(r.value),0))}</small></span></button>
      <button onClick={()=>onNavigate('invoices')}><i className="orange"><ReceiptText/></i><span>Offene Rechnungen<strong>{openInvoices.length}</strong><small>Gesamtwert: {money(openInvoices.reduce((n,r)=>n+euro(r.value),0))}</small></span></button>
    </div>
    <div className="portal-overview"><section className="portal-card chart-card"><div className="portal-card-head"><div><span>GESCHÄFTSENTWICKLUNG</span><h2>Einnahmen vs. Ausgaben</h2></div><button>Dieses Jahr <ChevronDown/></button></div><div className="portal-legend"><span><i/>Einnahmen</span><span><i/>Ausgaben</span></div><TrendChart/></section>
      <section className="portal-card"><div className="portal-card-head"><h2>Letzte Rechnungen</h2><button onClick={()=>onNavigate('invoices')}>Alle anzeigen</button></div><div className="mini-list">{store.invoices.slice(0,5).map(r=><div key={r.id}><small>{r.id}</small><b>{r.title}</b><span>{r.value}</span><Status>{r.status}</Status></div>)}</div></section></div>
    <div className="portal-bottom-grid"><section className="portal-card"><div className="portal-card-head"><h2>Niedriger Materialbestand</h2><button onClick={()=>onNavigate('material')}>Alle</button></div><div className="compact-list">{lowStock.slice(0,4).map(r=><div key={r.id}><b>{r.title}</b><span>{r.value}</span><Status>{r.status}</Status></div>)}</div></section>
      <section className="portal-card"><div className="portal-card-head"><h2>Angebote in Bearbeitung</h2><button onClick={()=>onNavigate('offers')}>Alle</button></div><div className="compact-list">{openOffers.slice(0,4).map(r=><div key={r.id}><b>{r.id}</b><span>{r.title}</span><em>{r.value}</em></div>)}</div></section>
      <section className="portal-card"><div className="portal-card-head"><h2>Aktive Aufträge</h2><button onClick={()=>onNavigate('orders')}>Alle</button></div><div className="progress-list">{store.orders.slice(0,4).map(r=><div key={r.id}><b>{r.title}</b><i><em style={{width:r.meta}}/></i><span>{r.meta}</span></div>)}</div></section></div>
  </>
}

function EntityView({kind,rows,query,onCreate,onEdit,onDelete,onConvert}:{kind:EntityModule;rows:Row[];query:string;onCreate:()=>void;onEdit:(row:Row)=>void;onDelete:(id:string)=>void;onConvert:(row:Row)=>void}){
  const config=moduleCopy[kind];
  const filtered=rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase()));
  return <><div className="portal-page-head with-action"><div><span>{config.eyebrow}</span><h1>{config.title}</h1><p>{config.description}</p></div><button className="portal-primary" onClick={onCreate}><CirclePlus/>{config.button}</button></div>
    <div className="portal-table-card"><div className="portal-table-head"><span>{filtered.length} Einträge</span><div><button><Download/> Exportieren</button><button>Alle Status <ChevronDown/></button></div></div>
      <div className="portal-table"><div className="portal-tr portal-th"><span>{config.labels[0]}</span><span>{config.labels[1]}</span><span>{config.labels[2]}</span><span>{config.labels[3]}</span><span/></div>{filtered.map(row=><div className="portal-tr" key={row.id}><span><b>{row.title}</b><small>{row.id}</small></span><span>{row.detail}<small>{row.meta}</small></span><span><strong>{row.value}</strong></span><span><Status>{row.status}</Status></span><span className="row-actions"><button aria-label={`${row.title} bearbeiten`} onClick={()=>onEdit(row)}><Pencil/></button>{kind==='offers'&&row.status==='Angenommen'&&<button aria-label="In Auftrag umwandeln" onClick={()=>onConvert(row)}><Check/></button>}<button aria-label={`${row.title} löschen`} onClick={()=>onDelete(row.id)}><Trash2/></button></span></div>)}{filtered.length===0&&<div className="portal-empty"><Search/><h3>Keine Einträge gefunden</h3><p>Ändere die Suche oder lege einen neuen Datensatz an.</p></div>}</div>
    </div></>
}

type Transaction={id:string;date:string;text:string;type:'Einnahme'|'Ausgabe';amount:number};
const initialTransactions:Transaction[]=[{id:'BU-1042',date:'01.09.2026',text:'Abschlagsrechnung Müller',type:'Einnahme',amount:8500},{id:'BU-1041',date:'30.08.2026',text:'Baustoffhandel Nord',type:'Ausgabe',amount:2850},{id:'BU-1040',date:'28.08.2026',text:'Rechnung Schmidt',type:'Einnahme',amount:4120},{id:'BU-1039',date:'27.08.2026',text:'Werkzeug & Maschinen',type:'Ausgabe',amount:980}];

function Finance({transactions,onAdd}:{transactions:Transaction[];onAdd:(t:Transaction)=>void}){
  const [open,setOpen]=useState(false); const income=transactions.filter(t=>t.type==='Einnahme').reduce((n,t)=>n+t.amount,0); const expense=transactions.filter(t=>t.type==='Ausgabe').reduce((n,t)=>n+t.amount,0);
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const d=new FormData(e.currentTarget);onAdd({id:`BU-${1043+transactions.length}`,date:new Date().toLocaleDateString('de-DE'),text:String(d.get('text')),type:d.get('type') as Transaction['type'],amount:Number(d.get('amount'))});setOpen(false)}
  return <><div className="portal-page-head with-action"><div><span>FINANZEN</span><h1>Einnahmen & Ausgaben</h1><p>Geschäftsentwicklung und Ergebnis jederzeit verstehen.</p></div><button className="portal-primary" onClick={()=>setOpen(true)}><CirclePlus/>Buchung erfassen</button></div>
    <div className="finance-summary"><article><span>Einnahmen</span><strong>{money(income)}</strong><small>↗ 14,2 % zum Vormonat</small></article><article><span>Ausgaben</span><strong>{money(expense)}</strong><small className="neutral">↗ 3,1 % zum Vormonat</small></article><article><span>Ergebnis</span><strong>{money(income-expense)}</strong><small>↗ Positiver Cashflow</small></article></div>
    <section className="portal-card finance-main"><div className="portal-card-head"><div><span>JAHRESVERLAUF</span><h2>Einnahmen vs. Ausgaben</h2></div></div><TrendChart/></section>
    <section className="portal-card transaction-card"><div className="portal-card-head"><h2>Letzte Buchungen</h2><button><Download/> CSV Export</button></div><div className="transaction-list">{transactions.map(t=><div key={t.id}><span><b>{t.text}</b><small>{t.id} · {t.date}</small></span><Status>{t.type}</Status><strong className={t.type==='Ausgabe'?'negative':''}>{t.type==='Ausgabe'?'−':'+'} {money(t.amount)}</strong></div>)}</div></section>
    {open&&<div className="portal-modal-backdrop" onMouseDown={()=>setOpen(false)}><form className="portal-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>NEUE BUCHUNG</span><h2>Buchung erfassen</h2></div><button type="button" onClick={()=>setOpen(false)}><X/></button></div><label>Beschreibung<input name="text" required placeholder="z. B. Abschlagsrechnung"/></label><div className="modal-grid"><label>Typ<select name="type"><option>Einnahme</option><option>Ausgabe</option></select></label><label>Betrag in €<input name="amount" type="number" min="0" step="0.01" required/></label></div><button className="portal-primary" type="submit">Buchung speichern</button></form></div>}</>
}

function Reports({store}:{store:Store}){return <><div className="portal-page-head with-action"><div><span>AUSWERTUNGEN</span><h1>Berichte</h1><p>Entwicklungen erkennen und fundierte Entscheidungen treffen.</p></div><button className="portal-primary" onClick={()=>window.print()}><Download/>Bericht exportieren</button></div><div className="report-cards">{[['Umsatzentwicklung','+14,2 %','gegenüber Vorjahr'],['Angebotsquote',`${Math.round(store.offers.filter(x=>x.status==='Angenommen').length/Math.max(1,store.offers.length)*100)} %`,'angenommene Angebote'],['Ø Zahlungsdauer','12 Tage','2 Tage schneller'],['Materialwarnungen',String(store.material.filter(x=>/Niedrig|Nachbestellen/.test(x.status)).length),'Positionen prüfen']].map(x=><article key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><small>{x[2]}</small></article>)}</div><section className="portal-card finance-main"><div className="portal-card-head"><div><span>12 MONATE</span><h2>Geschäftsentwicklung</h2></div></div><TrendChart/></section><div className="report-split"><section className="portal-card"><div className="portal-card-head"><h2>Auftragsstatus</h2></div><div className="donut-wrap"><div className="donut"><span>{store.orders.length}<small>Aufträge</small></span></div><div className="donut-legend"><span><i className="l1"/>In Arbeit</span><span><i className="l2"/>Geplant</span><span><i className="l3"/>Abgeschlossen</span></div></div></section><section className="portal-card"><div className="portal-card-head"><h2>Handlungsempfehlungen</h2></div><div className="recommendations"><p><i>1</i><span><b>{store.invoices.filter(x=>x.status==='Überfällig').length} überfällige Rechnung prüfen</b><small>Zahlungserinnerung versenden</small></span></p><p><i>2</i><span><b>Materialbedarf disponieren</b><small>Niedrige Positionen nachbestellen</small></span></p><p><i>3</i><span><b>Offene Angebote nachfassen</b><small>Abschlussquote aktiv verbessern</small></span></p></div></section></div></>}

function SettingsView(){const [saved,setSaved]=useState(false);function save(e:FormEvent){e.preventDefault();setSaved(true);setTimeout(()=>setSaved(false),2500)}return <><div className="portal-page-head"><div><span>KONFIGURATION</span><h1>Einstellungen</h1><p>Firmendaten, Dokumente und Benachrichtigungen verwalten.</p></div></div><form className="settings-form" onSubmit={save}><section className="portal-card"><div className="settings-title"><div><b>Unternehmensdaten</b><span>Diese Angaben erscheinen auf deinen Dokumenten.</span></div></div><div className="settings-fields"><label>Firmenname<input defaultValue="Musterbau GmbH"/></label><label>E-Mail<input type="email" defaultValue="info@musterbau.de"/></label><label>Adresse<input defaultValue="Musterstraße 12, 10115 Berlin"/></label><label>Telefon<input defaultValue="+49 30 12345678"/></label><label>Steuernummer<input defaultValue="DE 123 456 789"/></label><label>IBAN<input defaultValue="DE89 3704 0044 0532 0130 00"/></label></div></section><section className="portal-card"><div className="settings-title"><div><b>Benachrichtigungen</b><span>Lege fest, wann VYSN One dich informiert.</span></div></div><div className="toggle-list">{['Überfällige Rechnungen','Material unter Mindestbestand','Neue Angebotsantworten','Wöchentlicher Geschäftsbericht'].map((x,i)=><label key={x}><span><b>{x}</b><small>{i===3?'Jeden Montag per E-Mail':'Direkt in der Plattform und per E-Mail'}</small></span><input type="checkbox" defaultChecked={i<3}/><i/></label>)}</div></section><div className="settings-save"><button className="portal-primary" type="submit">{saved?<><Check/>Gespeichert</>:'Änderungen speichern'}</button></div></form></>}

function EntityModal({kind,row,onClose,onSave}:{kind:EntityModule;row:Row|null;onClose:()=>void;onSave:(row:Row)=>void}){const cfg=moduleCopy[kind];function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const d=new FormData(e.currentTarget);onSave({id:String(d.get('id')),title:String(d.get('title')),detail:String(d.get('detail')),value:String(d.get('value')),status:String(d.get('status')),meta:String(d.get('meta'))});onClose()}return <div className="portal-modal-backdrop" onMouseDown={onClose}><form className="portal-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>{row?'EINTRAG BEARBEITEN':'NEU ANLEGEN'}</span><h2>{row?row.title:cfg.button}</h2></div><button type="button" onClick={onClose}><X/></button></div><div className="modal-grid"><label>Nummer<input name="id" required defaultValue={row?.id||`${kind.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-5)}`}/></label><label>Status<select name="status" defaultValue={row?.status||'Entwurf'}><option>Entwurf</option><option>Geplant</option><option>In Arbeit</option><option>Versendet</option><option>Angenommen</option><option>Bezahlt</option><option>Überfällig</option><option>Aktiv</option><option>Verfügbar</option><option>Niedrig</option><option>Nachbestellen</option></select></label></div><label>{cfg.labels[0]}<input name="title" required defaultValue={row?.title}/></label><label>{cfg.labels[1]}<input name="detail" required defaultValue={row?.detail}/></label><div className="modal-grid"><label>{cfg.labels[2]}<input name="value" required defaultValue={row?.value}/></label><label>Zusatzinformation<input name="meta" defaultValue={row?.meta}/></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Abbrechen</button><button className="portal-primary" type="submit">Speichern</button></div></form></div>}

export function VysnPlatform(){
  const [active,setActive]=useState<ModuleId>('dashboard'); const [store,setStore]=useState<Store>(initialStore); const [transactions,setTransactions]=useState(initialTransactions); const [query,setQuery]=useState(''); const [mobileOpen,setMobileOpen]=useState(false); const [modal,setModal]=useState<{kind:EntityModule;row:Row|null}|null>(null); const [toast,setToast]=useState('');
  useEffect(()=>{const saved=localStorage.getItem('vysn-one-store');const tx=localStorage.getItem('vysn-one-transactions');if(saved)setStore(JSON.parse(saved));if(tx)setTransactions(JSON.parse(tx))},[]);
  useEffect(()=>{localStorage.setItem('vysn-one-store',JSON.stringify(store))},[store]); useEffect(()=>{localStorage.setItem('vysn-one-transactions',JSON.stringify(transactions))},[transactions]);
  const current=useMemo(()=>nav.find(n=>n[0]===active),[active]);
  function navigate(id:ModuleId){setActive(id);setQuery('');setMobileOpen(false)}
  function saveRow(kind:EntityModule,row:Row){setStore(s=>({...s,[kind]:s[kind].some(x=>x.id===row.id)?s[kind].map(x=>x.id===row.id?row:x):[row,...s[kind]]}));notify('Eintrag erfolgreich gespeichert')}
  function removeRow(kind:EntityModule,id:string){if(window.confirm('Möchtest du diesen Eintrag wirklich löschen?')){setStore(s=>({...s,[kind]:s[kind].filter(x=>x.id!==id)}));notify('Eintrag wurde gelöscht')}}
  function convertOffer(row:Row){const order={...row,id:row.id.replace('ANG','BA'),status:'Geplant',meta:'0%'};setStore(s=>({...s,orders:[order,...s.orders]}));navigate('orders');notify('Angebot wurde in einen Auftrag umgewandelt')}
  function notify(text:string){setToast(text);setTimeout(()=>setToast(''),2600)}
  return <div className="portal-shell">
    <aside className={`portal-sidebar ${mobileOpen?'open':''}`}><div className="sidebar-top"><Brand/><button className="sidebar-close" onClick={()=>setMobileOpen(false)}><X/></button></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={active===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span>{id==='invoices'&&<em>{store.invoices.filter(x=>x.status!=='Bezahlt').length}</em>}</button>)}</nav><div className="portal-plan"><span>✦ VYSN ONE</span><b>Business Plan</b><small>Alle Funktionen aktiviert</small><button>Plan verwalten</button></div><div className="portal-company"><span>MM</span><div><b>Musterbau GmbH</b><small>Max Mustermann</small></div><ChevronDown/></div></aside>
    {mobileOpen&&<button className="sidebar-scrim" aria-label="Menü schließen" onClick={()=>setMobileOpen(false)}/>}<main className="portal-main"><header className="portal-topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="global-search"><Search/><input aria-label="Suchen" placeholder={`In ${current?.[1]||'VYSN One'} suchen …`} value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><div className="top-actions"><button aria-label="Kalender"><CalendarDays/></button><button aria-label="Benachrichtigungen" className="notification"><Bell/><i>3</i></button><span>MM</span></div></header><div className="portal-content">{active==='dashboard'?<Dashboard store={store} onNavigate={navigate}/>:active==='finance'?<Finance transactions={transactions} onAdd={t=>{setTransactions(x=>[t,...x]);notify('Buchung erfolgreich gespeichert')}}/>:active==='reports'?<Reports store={store}/>:active==='settings'?<SettingsView/>:<EntityView kind={active} rows={store[active]} query={query} onCreate={()=>setModal({kind:active,row:null})} onEdit={row=>setModal({kind:active,row})} onDelete={id=>removeRow(active,id)} onConvert={convertOffer}/>}</div></main>
    {modal&&<EntityModal kind={modal.kind} row={modal.row} onClose={()=>setModal(null)} onSave={row=>saveRow(modal.kind,row)}/>} {toast&&<div className="portal-toast"><Check/>{toast}</div>}
  </div>
}
