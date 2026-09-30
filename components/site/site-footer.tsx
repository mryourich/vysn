import Link from 'next/link';
import { Brand } from '../app/brand';

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
          <a href="/#funktionen">Funktionen</a>
          <a href="/#rechnungsdesign">Rechnungsdesign</a>
          <a href="/#preise">Preise</a>
          <Link href="/app">Anwendung öffnen</Link>
        </div>
        <div>
          <h4>Unternehmen</h4>
          <a href="/#kontakt">Kontakt</a>
          <a href="/#faq">Häufige Fragen</a>
        </div>
        <div>
          <h4>Rechtliches</h4>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} VYSN One</span>
        <span>Made in Germany · Für KMU, Handwerk und Dienstleister</span>
      </div>
    </footer>
  );
}
