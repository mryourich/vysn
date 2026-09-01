import Link from 'next/link';
import { Logo } from './site-header';

export function SiteFooter() {
  return <footer><div className="shell footer-grid"><div><Logo/><p>Das Betriebssystem für kleine Unternehmen: Aufträge, Material, Kunden, Dokumente und Finanzen an einem Ort.</p></div><div><b>VYSN One</b><Link href="/produkt">Produkt</Link><Link href="/loesungen">Lösungen</Link><Link href="/preise">Preise</Link></div><div><b>Unternehmen</b><Link href="/sicherheit">Sicherheit</Link><Link href="/kontakt">Kontakt</Link></div><div><b>Rechtliches</b><span>Impressum</span><span>Datenschutz</span><span>AGB</span></div></div><div className="shell footer-bottom"><span>© 2026 VYSN One. Alle Rechte vorbehalten.</span><span>Entwickelt für kleine Unternehmen in Europa.</span></div></footer>;
}
