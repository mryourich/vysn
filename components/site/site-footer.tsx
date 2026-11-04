import Link from 'next/link';
import { Brand } from '../app/brand';
import { CONTACT_EMAIL } from '../../lib/site';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>Angebote, Rechnungen, Material und Zahlen für kleine Unternehmen – klar und ohne Ballast.</p>
        </div>
        <div>
          <h4>Produkt</h4>
          <Link href="/#funktionen">Funktionen</Link>
          <Link href="/#laufende-kosten">Monatliche Kosten</Link>
          <Link href="/#app">App für iPhone & Android</Link>
          <Link href="/#rechnungsdesign">Rechnungsdesign</Link>
          <Link href="/#preise">Preise</Link>
          <Link href="/app">Anwendung öffnen</Link>
        </div>
        <div>
          <h4>Unternehmen</h4>
          <Link href="/#kontakt">Kontakt</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <Link href="/#faq">Häufige Fragen</Link>
        </div>
        <div>
          <h4>Rechtliches</h4>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/widerruf">Vertrag widerrufen</Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} VYSNER One</span>
        <span>Für KMU, Handwerk und Dienstleister in Deutschland, Österreich und der Schweiz</span>
      </div>
    </footer>
  );
}
