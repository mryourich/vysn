import Link from 'next/link';
import { Logo } from './site-header';

export function SiteFooter() {
  return (
    <footer>
      <div className="shell footer-grid">
        <div><Logo /><p>Die Arbeitsplattform für Unternehmen, die mehr vorhaben.</p></div>
        <div><b>Plattform</b><Link href="/produkt">Produkt</Link><Link href="/loesungen">Lösungen</Link><Link href="/preise">Preise</Link></div>
        <div><b>Vertrauen</b><Link href="/sicherheit">Sicherheit</Link><a href="mailto:hallo@vysn.de">Kontakt</a></div>
        <div><b>Rechtliches</b><span>Impressum</span><span>Datenschutz</span><span>AGB</span></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 VYSN. Alle Rechte vorbehalten.</span><span>Entwickelt für Unternehmen in Europa.</span></div>
    </footer>
  );
}
