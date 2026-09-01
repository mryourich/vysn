import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { ProductMap } from '../components/product-map';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <section className="home-hero shell">
        <div className="eyebrow"><Sparkles size={14} /> Die Arbeitsplattform für moderne Unternehmen</div>
        <h1>Dein Unternehmen.<br /><span>Ein System.</span></h1>
        <p>VYSN verbindet Aufträge, Kunden, Finanzen und Teamarbeit – für klare Abläufe, weniger Verwaltung und bessere Entscheidungen.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/preise">VYSN One testen <ArrowRight size={17} /></Link>
          <Link className="button button-ghost" href="/produkt">Produkt ansehen</Link>
        </div>
        <div className="trust-row"><span><Check />14 Tage kostenlos</span><span><Check />Keine Kreditkarte</span><span><ShieldCheck />DSGVO-orientiert</span></div>
      </section>

      <section className="map-section shell">
        <div className="section-heading map-heading">
          <div><span className="section-kicker">VYSN DURCHSTÖBERN</span><h2>Alles greift ineinander.</h2></div>
          <p>Wähle einen Bereich und entdecke, wie VYSN dein Tagesgeschäft zusammenführt.</p>
        </div>
        <ProductMap />
      </section>

      <section className="version-section shell">
        <div className="section-heading centered"><span className="section-kicker">ZWEI VERSIONEN. EIN ANSPRUCH.</span><h2>VYSN wächst mit dir.</h2></div>
        <div className="version-grid">
          <article className="version-card">
            <span className="version-name">VYSN ONE</span>
            <h3>Einfach professionell starten.</h3>
            <p>Für kleine Unternehmen und Teams, die ihr Tagesgeschäft zentral organisieren möchten.</p>
            <strong>ab 39 € <small>/ Monat</small></strong>
            <Link href="/preise">One entdecken <ArrowRight /></Link>
          </article>
          <article className="version-card pro">
            <span className="version-name">VYSN PRO</span>
            <h3>Gebaut für Ihre Prozesse.</h3>
            <p>Für größere Firmen, mehrere Standorte und individuelle Anforderungen.</p>
            <strong>Individuell</strong>
            <Link href="/loesungen#pro">Pro entdecken <ArrowRight /></Link>
          </article>
        </div>
      </section>

      <section className="home-cta shell">
        <div><span className="section-kicker light">BEREIT FÜR KLARE ABLÄUFE?</span><h2>Entdecke, was VYSN für dein Unternehmen tun kann.</h2></div>
        <Link className="button button-light" href="/preise">Passende Version finden <ArrowRight /></Link>
      </section>
      <SiteFooter />
    </main>
  );
}
