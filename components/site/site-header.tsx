'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Brand } from '../app/brand';

const LINKS = [
  ['#funktionen', 'Funktionen'],
  ['#rechnungsdesign', 'Rechnungsdesign'],
  ['#preise', 'Preise'],
  ['#faq', 'Fragen'],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="shell nav">
        <Brand />
        <nav className={`nav-links${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
          {LINKS.map(([href, label]) => <a key={href} href={`/${href}`}>{label}</a>)}
          <Link href="/app" className="nav-login mobile-nav-only">Zur Anwendung</Link>
        </nav>
        <div className="nav-actions">
          <Link href="/app" className="nav-login">Anmelden</Link>
          <Link href="/app" className="btn btn-primary">Kostenlos starten</Link>
          <button className="icon-btn nav-toggle" aria-label="Menü" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
