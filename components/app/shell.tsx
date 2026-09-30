'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3, Boxes, Building2, FileText, LayoutDashboard, MoreHorizontal, Palette, ReceiptText, Users, Wallet, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StoreProvider, useStore } from '../../lib/store';
import { Brand } from './brand';
import { CompanyAvatar, CompanyList, CompanySwitcher, LogoutButton } from './company-switcher';
import { UpgradeDialog } from './upgrade-dialog';
import { Login } from './login';
import { Onboarding } from './onboarding';

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ href: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
  { group: 'Verkauf', items: [
    { href: '/app/angebote', label: 'Angebote', icon: FileText },
    { href: '/app/rechnungen', label: 'Rechnungen', icon: ReceiptText },
    { href: '/app/kunden', label: 'Kunden', icon: Users },
  ] },
  { group: 'Betrieb', items: [
    { href: '/app/material', label: 'Material & Lager', icon: Boxes },
    { href: '/app/ausgaben', label: 'Ausgaben', icon: Wallet },
  ] },
  { group: 'Auswertung', items: [{ href: '/app/guv', label: 'GuV & Finanzen', icon: BarChart3 }] },
  { group: 'Einstellungen', items: [
    { href: '/app/firma', label: 'Firmendaten', icon: Building2 },
    { href: '/app/design', label: 'Rechnungsdesign', icon: Palette },
  ] },
];

const MOBILE_TABS: NavItem[] = [
  { href: '/app', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/app/rechnungen', label: 'Rechnungen', icon: ReceiptText },
  { href: '/app/angebote', label: 'Angebote', icon: FileText },
  { href: '/app/ausgaben', label: 'Ausgaben', icon: Wallet },
];

const isActive = (pathname: string, href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

function Shell({ children }: { children: React.ReactNode }) {
  const { data, ready, authenticated, auth, sync } = useStore();
  const pathname = usePathname() || '/app';
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  if (!ready) return <div className="app-loading"><span className="spinner" /></div>;
  if (!authenticated) return <Login />;
  if (!data.company) {
    if (sync.state === 'error') return <LoadError message={sync.error} />;
    return <Onboarding />;
  }

  const company = data.company;
  const current = NAV.flatMap((g) => g.items).filter((i) => isActive(pathname, i.href)).pop();

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand href="/app" />
        <nav>
          {NAV.map((g) => (
            <div key={g.group || 'main'} className="nav-group">
              {g.group ? <span className="nav-group-label">{g.group}</span> : null}
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} className={`nav-link${isActive(pathname, item.href) ? ' active' : ''}`}>
                  <item.icon size={17} strokeWidth={1.8} />{item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <CompanySwitcher />
          <div className="sidebar-meta">
            <SyncStatus />
            <LogoutButton className="logout-btn" />
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Brand href="/app" />
          <button className="topbar-company" onClick={() => setMoreOpen(true)} aria-label={`Firma: ${company.name}`}>
            <span>{current?.label}</span>
            <CompanyAvatar name={company.name} logo={company.logo} size={30} />
          </button>
        </header>
        {sync.state === 'error' ? (
          <div className="sync-banner" role="alert">
            <span><strong>Änderung konnte nicht gespeichert werden.</strong> {sync.error}</span>
            <button className="btn btn-small" onClick={() => window.location.reload()}>Neu laden</button>
          </div>
        ) : null}
        <main className="app-content">{children}</main>
      </div>
      <UpgradeDialog />

      <nav className="tabbar" aria-label="Hauptnavigation">
        {MOBILE_TABS.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
            <item.icon size={20} strokeWidth={1.8} /><span>{item.label}</span>
          </Link>
        ))}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}>
          <MoreHorizontal size={20} /><span>Mehr</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong>Menü</strong><button className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Schließen"><X size={18} /></button></div>
            <div className="sheet-grid">
              {NAV.flatMap((g) => g.items).map((item) => (
                <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
                  <item.icon size={20} strokeWidth={1.8} />{item.label}
                </Link>
              ))}
            </div>
            <div className="sheet-section">
              <span className="sheet-label">Firma wechseln</span>
              <CompanyList onDone={() => setMoreOpen(false)} />
            </div>
            <div className="sheet-actions">
              {auth.email ? <span className="muted small">{auth.email}</span> : <Link href="/" className="muted small">Zur Startseite</Link>}
              <LogoutButton className="btn" onDone={() => setMoreOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SyncStatus() {
  const { sync, auth } = useStore();
  const label = sync.state === 'saving' ? 'Speichert…' : sync.state === 'error' ? 'Fehler beim Speichern' : 'Gespeichert';
  return <span className={`sync-status ${sync.state}`} title={sync.error || (auth.mode === 'supabase' ? 'In der Cloud gespeichert' : 'Lokal in diesem Browser gespeichert')}><i />{label}</span>;
}

function LoadError({ message }: { message: string | null }) {
  const { auth } = useStore();
  return (
    <div className="app-loading">
      <div className="empty">
        <h3>Daten konnten nicht geladen werden</h3>
        <p>{message || 'Bitte prüfen Sie Ihre Internetverbindung.'}</p>
        <div className="secondary-actions">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Erneut versuchen</button>
          {auth.mode === 'supabase' ? <button className="btn" onClick={() => auth.signOut()}>Abmelden</button> : null}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <StoreProvider><Shell>{children}</Shell></StoreProvider>;
}
