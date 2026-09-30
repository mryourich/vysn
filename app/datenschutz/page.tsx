import type { Metadata } from 'next';
import { SiteFooter } from '../../components/site/site-footer';
import { SiteHeader } from '../../components/site/site-header';
import '../site.css';

export const metadata: Metadata = { title: 'Datenschutz – VYSN One' };

export default function PrivacyPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="shell legal">
        <h1>Datenschutzerklärung</h1>
        <p className="placeholder">Platzhalter – bitte vor der Veröffentlichung durch eine vollständige, geprüfte Datenschutzerklärung ersetzen.</p>
        <h2>Verantwortlicher</h2>
        <p>[Firmenname, Anschrift, E-Mail]</p>
        <h2>Speicherung Ihrer Geschäftsdaten</h2>
        <p>
          Die in der Anwendung erfassten Daten (Firmendaten, Kunden, Material, Angebote, Rechnungen und Ausgaben) werden ausschließlich lokal
          im Speicher Ihres Browsers (localStorage) auf Ihrem Gerät abgelegt und nicht an unsere Server übertragen. Über die Funktion
          „Datensicherung“ können Sie Ihre Daten jederzeit exportieren oder löschen.
        </p>
        <h2>Server-Logfiles</h2>
        <p>Beim Aufruf der Website verarbeitet der Hosting-Anbieter technisch notwendige Verbindungsdaten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite).</p>
        <h2>Ihre Rechte</h2>
        <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Beschwerde bei einer Aufsichtsbehörde.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
