'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3, Boxes, FileSpreadsheet, FileText, LayoutDashboard, Lock, ReceiptText, ScanLine, Users, Wallet, CloudOff, X, Sparkles,
} from 'lucide-react';
import { StoreProvider, useStore } from '../../lib/store';
import { ADMIN_PATHS, ROLE_LABEL, isAdminRole, pendingInvite } from '../../lib/team';
import { FEATURES, featureForPath } from '../../lib/plans';
import type { Feature } from '../../lib/plans';
import { Brand } from './brand';
import { Empty } from './ui';
import { CompanyAvatar, LogoutButton } from './company-switcher';
import { ProfileButton } from './profile';
import { MobileNav } from './mobile-nav';
import type { NavGroup } from './mobile-nav';
import { UpgradeDialog } from './upgrade-dialog';
import { Login } from './login';
import { Onboarding } from './onboarding';

const NAV: NavGroup[] = [
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
];

const isActive = (pathname: string, href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

function Shell({ children }: { children: React.ReactNode }) {
  const { data, ready, authenticated, auth, sync, role, dismissSyncNotice, can, requireFeature } = useStore();
  const pathname = usePathname() || '/app';
  const router = useRouter();
  const [sheet, setSheet] = useState<'menu' | 'create' | 'profile' | null>(null);
  useEffect(() => setSheet(null), [pathname]);
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
  const pageFeature = featureForPath(pathname);
  const featureLocked = pageFeature && !can(pageFeature) ? pageFeature : null;
  /** Gesperrte Funktion: Link bleibt sichtbar, Klick öffnet „Jetzt upgraden“. */
  const lockedFor = (href: string) => { const f = featureForPath(href); return f && !can(f) ? f : null; };

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand href="/app" />
        <nav>
          {nav.map((g) => (
            <div key={g.group || 'main'} className="nav-group">
              {g.group ? <span className="nav-group-label">{g.group}</span> : null}
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} className={`nav-link${isActive(pathname, item.href) ? ' active' : ''}`}
                  onClick={(e) => { const f = lockedFor(item.href); if (f) { e.preventDefault(); requireFeature(f); } }}>
                  <item.icon size={17} strokeWidth={1.8} />{item.label}
                  {lockedFor(item.href) ? <Lock size={13} className="nav-lock" aria-label="Nicht im Tarif" /> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ProfileButton />
          <div className="sidebar-meta">
            <SyncStatus />
            <LogoutButton className="logout-btn" />
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Brand href="/app" />
          <button className="topbar-company" onClick={() => setSheet('profile')} aria-label={`Profil & Einstellungen – ${company.name}`}>
            <span>{company.name}</span>
            <CompanyAvatar name={company.name} logo={company.logo} size={30} />
          </button>
        </header>
        {sync.state === 'error' ? (
          <div className="sync-banner" role="alert">
            <span><strong>Änderung konnte nicht gespeichert werden.</strong> {sync.error}</span>
            <button className="btn btn-small" onClick={() => window.location.reload()}>Neu laden</button>
          </div>
        ) : sync.state === 'offline' ? (
          <div className="sync-banner sync-offline" role="status">
            <CloudOff size={16} />
            <span>
              <strong>{sync.offlineSince ? 'Offline-Modus.' : 'Keine Verbindung.'}</strong>{' '}
              {sync.offlineSince ? `Stand vom ${new Date(sync.offlineSince).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}. ` : ''}
              {sync.pending
                ? `${sync.pending === 1 ? 'Eine Änderung ist' : `${sync.pending} Änderungen sind`} auf diesem Gerät gesichert und ${sync.pending === 1 ? 'wird' : 'werden'} automatisch übertragen.`
                : 'Änderungen werden auf diesem Gerät gesichert und automatisch übertragen, sobald wieder Verbindung besteht.'}
            </span>
          </div>
        ) : null}
        {sync.notice ? (
          <div className="sync-banner sync-notice" role="status">
            <span>{sync.notice}</span>
            <button className="icon-btn" onClick={dismissSyncNotice} aria-label="Hinweis schließen"><X size={16} /></button>
          </div>
        ) : null}
        <main className="app-content">{blocked ? <NoAccess role={ROLE_LABEL[role]} /> : featureLocked ? <FeatureLocked feature={featureLocked} /> : children}</main>
      </div>
      <UpgradeDialog />
      <MobileNav nav={nav} open={sheet} onOpen={setSheet} />
    </div>
  );
}

function FeatureLocked({ feature }: { feature: Feature }) {
  const { requireFeature } = useStore();
  const f = FEATURES[feature];
  return (
    <div className="card">
      <Empty icon={<Lock size={24} />} title={f.label}
        text={`${f.text} Diese Funktion ist ab dem Tarif ${f.plan === 'team' ? 'Team' : 'Business'} enthalten.`}
        action={<button className="btn btn-primary" onClick={() => requireFeature(feature)}><Sparkles size={16} /> Jetzt upgraden</button>} />
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
  const label = sync.state === 'saving' ? 'Speichert…' : sync.state === 'error' ? 'Fehler beim Speichern' : sync.state === 'offline' ? `Offline (${sync.pending})` : 'Gespeichert';
  return <span className={`sync-status ${sync.state}`} title={sync.error || (auth.mode === 'supabase' ? 'In der Cloud gespeichert' : 'Lokal in diesem Browser gespeichert')}><i />{label}</span>;
}

function LoadError({ message }: { message: string | null }) {
  const { auth } = useStore();
  const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || /fetch|network|load failed/i.test(message || '');
  return (
    <div className="app-loading">
      <div className="empty">
        <h3>{offline ? 'Keine Verbindung' : 'Daten konnten nicht geladen werden'}</h3>
        <p>{offline
          ? 'Diese Firma wurde auf diesem Gerät noch nicht geöffnet. Öffnen Sie VYSN One einmal mit Internet – danach steht sie auch offline zur Verfügung.'
          : message || 'Bitte prüfen Sie Ihre Internetverbindung.'}</p>
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
