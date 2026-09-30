import type { Metadata } from 'next';
import { SiteFooter } from '../../components/site/site-footer';
import { SiteHeader } from '../../components/site/site-header';
import '../site.css';

export const metadata: Metadata = { title: 'Impressum – VYSN One' };

export default function ImpressumPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="shell legal">
        <h1>Impressum</h1>
        <p className="placeholder">Platzhalter – bitte vor der Veröffentlichung mit Ihren tatsächlichen Angaben ersetzen.</p>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>[Firmenname]<br />[Straße Hausnummer]<br />[PLZ Ort]</p>
        <h2>Vertreten durch</h2>
        <p>[Vor- und Nachname]</p>
        <h2>Kontakt</h2>
        <p>Telefon: [Telefonnummer]<br />E-Mail: [E-Mail-Adresse]</p>
        <h2>Registereintrag</h2>
        <p>Registergericht: [Amtsgericht]<br />Registernummer: [HRB …]</p>
        <h2>Umsatzsteuer-ID</h2>
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: [DE…]</p>
      </main>
      <SiteFooter />
    </div>
  );
}
