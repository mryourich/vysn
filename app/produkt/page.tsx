import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, BriefcaseBusiness, Check, FileText, Users, WalletCards, Workflow } from 'lucide-react';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';

export const metadata: Metadata = { title: 'Produkt | VYSN', description: 'Entdecke die Module und Arbeitsabläufe der VYSN Unternehmensplattform.' };

const modules = [
  { id:'auftraege', icon:BriefcaseBusiness, tag:'Operations', title:'Aufträge von Anfang bis Abschluss.', text:'Status, Termine, Zuständigkeiten und Dokumente bleiben automatisch am Vorgang. So weiß jeder, was als Nächstes passiert.', points:['Klare Projektphasen','Aufgaben & Verantwortliche','Vollständige Auftragshistorie'] },
  { id:'kunden', icon:Users, tag:'CRM', title:'Kundenbeziehungen mit Kontext.', text:'Alle Kontakte, Gespräche, Angebote und offenen Themen in einer gemeinsamen Kundenakte.', points:['Zentrale Kontaktdaten','Aktivitäten & Wiedervorlagen','Kundenbezogene Dokumente'] },
  { id:'finanzen', icon:WalletCards, tag:'Finanzen', title:'Zahlen, die im Alltag helfen.', text:'Einnahmen, Ausgaben und offene Posten sind jederzeit sichtbar und direkt mit den passenden Vorgängen verbunden.', points:['Liquiditätsübersicht','Offene Posten','Monatliche Entwicklung'] },
  { id:'dokumente', icon:FileText, tag:'Dokumente', title:'Vom Angebot zur Rechnung.', text:'Professionelle Dokumente entstehen aus vorhandenen Daten, ohne doppelte Eingaben und verstreute Vorlagen.', points:['Angebote & Rechnungen','Einheitliches Erscheinungsbild','Status und Fälligkeiten'] },
  { id:'insights', icon:BarChart3, tag:'Insights', title:'Entscheiden statt zusammensuchen.', text:'Dashboards verdichten operative Daten zu verständlichen Kennzahlen für Geschäftsführung und Team.', points:['Echtzeit-Kennzahlen','Standardberichte','Pro-Dashboards nach Bedarf'] },
];

export default function ProductPage(){return <main><SiteHeader />
  <section className="page-hero shell"><span className="section-kicker">DIE VYSN PLATTFORM</span><h1>Ein Arbeitsfluss.<br/><span>Kein Systemchaos.</span></h1><p>VYSN verbindet die zentralen Bereiche deines Unternehmens. Informationen fließen weiter, statt in Tabellen, Postfächern und Insellösungen stecken zu bleiben.</p><Link className="button button-primary" href="/preise">VYSN starten <ArrowRight /></Link></section>
  <section className="flow-strip"><div className="shell flow-row"><span>Anfrage</span><ArrowRight/><span>Kunde</span><ArrowRight/><span>Auftrag</span><ArrowRight/><span>Rechnung</span><ArrowRight/><span>Auswertung</span></div></section>
  <section className="detail-section shell"><div className="section-heading"><div><span className="section-kicker">MODULE</span><h2>Alles verbunden.<br/>Trotzdem übersichtlich.</h2></div><p>Jedes Modul funktioniert eigenständig. Gemeinsam entsteht ein vollständiges Bild deines Unternehmens.</p></div><div className="module-list">{modules.map((m,index)=>{const Icon=m.icon;return <article id={m.id} className="module-row" key={m.id}><div className="module-copy"><div className="detail-icon"><Icon/></div><span>{m.tag}</span><h3>{m.title}</h3><p>{m.text}</p><ul>{m.points.map(p=><li key={p}><Check/>{p}</li>)}</ul></div><div className={`module-visual visual-${index+1}`}><div className="visual-window"><small>VYSN / {m.tag}</small><strong>{index===0?'12 aktive Aufträge':index===1?'128 Kunden':index===2?'42.850 €':index===3?'RE-2026-045':'+12,4 %'}</strong><i/><i/><i/></div></div></article>})}</div></section>
  <section className="split-cta shell"><div><Workflow/><span className="section-kicker light">VYSN PRO</span><h2>Dein Prozess ist besonders?</h2><p>Mit VYSN Pro bilden wir individuelle Abläufe, Freigaben und Integrationen ab.</p></div><Link className="button button-light" href="/loesungen#pro">Pro-Lösung ansehen <ArrowRight/></Link></section>
  <SiteFooter /></main>}
