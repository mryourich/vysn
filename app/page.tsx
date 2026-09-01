import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { ProductMap } from '../components/product-map';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';

export default function Home() {
  return <main><SiteHeader/>
    <section className="home-hero shell"><div className="eyebrow"><Sparkles size={14}/> Die Unternehmenssoftware für kleine Betriebe</div><h1>Weniger verwalten.<br/><span>Mehr unternehmen.</span></h1><p>VYSN One verbindet Aufträge, Material, Kunden, Angebote, Rechnungen und Finanzen in einem übersichtlichen System – damit dein Betrieb jeden Tag klarer läuft.</p><div className="hero-actions"><Link className="button button-primary" href="/kontakt">Kostenlose Demo anfragen <ArrowRight size={17}/></Link><Link className="button button-ghost" href="/produkt">Produkt entdecken</Link></div><div className="trust-row"><span><Check/>Schnell startklar</span><span><Check/>Für kleine Teams</span><span><ShieldCheck/>Sicher konzipiert</span></div>
      <div className="hero-map"><div className="hero-map-label"><span><i/> INTERAKTIVE VYSN ONE PRODUKTVORSCHAU</span><p>Navigation anklicken und Funktionen entdecken</p></div><ProductMap/></div>
    </section>
    <section className="proof-band"><div className="shell proof-band-grid"><div><strong>1</strong><span>Zentrales System</span></div><div><strong>9</strong><span>Verbundene Bereiche</span></div><div><strong>360°</strong><span>Unternehmensüberblick</span></div><div><strong>0</strong><span>Tabellen-Chaos</span></div></div></section>
    <section className="home-value shell"><div className="section-heading"><div><span className="section-kicker">FÜR DEN ARBEITSALLTAG</span><h2>Alles Wichtige.<br/>Direkt griffbereit.</h2></div><p>VYSN One begleitet den kompletten Weg vom ersten Kundenkontakt bis zur bezahlten Rechnung.</p></div><div className="value-grid">{[['01','Auftrag im Griff','Termine, Status, Material und Verantwortliche bleiben miteinander verbunden.'],['02','Zahlen im Blick','Angebote, Rechnungen, Einnahmen und Ausgaben ergeben ein klares Gesamtbild.'],['03','Team auf Kurs','Jeder sieht Aufgaben, Prioritäten und den aktuellen Stand – ohne Nachfragen.']].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
    <section className="home-cta shell"><div><span className="section-kicker light">BEREIT FÜR EINEN KLAREN BETRIEB?</span><h2>Sieh VYSN One mit deinen eigenen Abläufen.</h2></div><Link className="button button-light" href="/kontakt">Persönliche Demo vereinbaren <ArrowRight/></Link></section>
    <SiteFooter/>
  </main>;
}
