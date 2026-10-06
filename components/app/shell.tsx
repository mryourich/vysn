'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3, Boxes, Building2, CreditCard, FileSpreadsheet, FileText, LayoutDashboard, Lock, MoreHorizontal, Palette, ReceiptText, ScanLine, Settings2, UserPlus, Users, Wallet, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StoreProvider, useStore } from '../../lib/store';
import { ADMIN_PATHS, ROLE_LABEL, isAdminRole, pendingInvite } from '../../lib/team';
import { Brand } from './brand';
import { Empty } from './ui';
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
    { href: '/app/scan', label: 'Lager-Scanner', icon: ScanLine },
    { href: '/app/ausgaben', label: 'Einnahmen & Ausgaben', icon: Wallet },
  ] },
  { group: 'Auswertung', items: [
    { href: '/app/guv', label: 'GuV & Finanzen', icon: BarChart3 },
    { href: '/app/export', label: 'DATEV-Export', icon: FileSpreadsheet },
  ] },
  { group: 'Einstellungen', items: [
    { href: '/app/firma', label: 'Firmendaten', icon: Building2 },
    { href: '/app/design', label: 'Rechnungsdesign', icon: Palette },
    { href: '/app/einstellungen', label: 'E-Mail & Versand', icon: Settings2 },
    { href: '/app/team', label: 'Team & Rechte', icon: UserPlus },
    { href: '/app/tarif', label: 'Tarif & Abrechnung', icon: CreditCard },
  ] },
];

const MOBILE_TABS: NavItem[] = [
  { href: '/app', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/app/rechnungen', label: 'Rechnungen', icon: ReceiptText },
  { href: '/app/scan', label: 'Scannen', icon: ScanLine },
  { href: '/app/ausgaben', label: 'Buchungen', icon: Wallet },
];

const isActive = (pathname: string, href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

function Shell({ children }: { children: React.ReactNode }) {
  const { data, ready, authenticated, auth, sync, role } = useStore();
  const pathname = usePathname() || '/app';
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  const invitePage = pathname.startsWith('/app/einladung');
  // Offene Einladung (z. B. nach Registrierung und E-Mail-Bestätigung) zuerst annehmen
  useEffect(() => {
    if (!authenticated || auth.mode !== 'supabase' || invitePage) return;
    const token = pendingInvite();
    if (token) router.replace(`/app/einladung?token=${token}`);
  }, [authenticated, auth.mode, invitePage, router]);

  if (invitePage) return <>{children}</>;

  if (!ready) return <div className="app-loading"><span className="spinner" /></div>;
  if (!authenticated) return <Login />;
  if (!data.company) {
    if (sync.state === 'error') return <LoadError message={sync.error} />;
    return <Onboarding />;
  }

  const company = data.company;
  const admin = isAdminRole(role);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => admin || !ADMIN_PATHS.includes(i.href)) })).filter((g) => g.items.length);
  const blocked = !admin && ADMIN_PATHS.some((p) => isActive(pathname, p));
  const current = NAV.flatMap((g) => g.items).filter((i) => isActive(pathname, i.href)).pop();

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand href="/app" />
        <nav>
          {nav.map((g) => (
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
        <main className="app-content">{blocked ? <NoAccess role={ROLE_LABEL[role]} /> : children}</main>
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
              {nav.flatMap((g) => g.items).map((item) => (
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

function NoAccess({ role }: { role: string }) {
  return (
    <div className="card">
      <Empty icon={<Lock size={24} />} title="Kein Zugriff"
        text={`Mit der Rolle „${role}“ können Sie diesen Bereich nicht öffnen. Firmendaten, Design, Einstellungen und Tarif verwalten Inhaber und Admins.`}
        action={<Link href="/app" className="btn">Zum Dashboard</Link>} />
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
