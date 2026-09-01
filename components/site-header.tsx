import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="VYSN Startseite">
      <span className="brand-mark" aria-hidden="true"><i /><i /></span>
      <span>VYSN</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="nav shell" aria-label="Hauptnavigation">
        <Logo />
        <div className="nav-links">
          <Link href="/produkt">Produkt</Link>
          <Link href="/loesungen">Lösungen</Link>
          <Link href="/preise">Preise</Link>
          <Link href="/sicherheit">Sicherheit</Link>
        </div>
        <div className="nav-actions">
          <a className="login" href="mailto:hallo@vysn.de">Anmelden</a>
          <Link className="button button-dark button-small" href="/preise">VYSN starten <ArrowRight size={15} /></Link>
        </div>
      </nav>
    </header>
  );
}
