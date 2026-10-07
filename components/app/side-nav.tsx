'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, BookOpen, Boxes, ChevronDown, ClipboardCheck, FileSpreadsheet, FileText, FolderOpen,
  LayoutDashboard, Lock, PieChart, Puzzle, ReceiptText, ShoppingCart, Truck, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { featureForPath } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ADMIN_PATHS, isAdminRole } from '../../lib/team';

type NavLinkItem = { href: string; label: string; icon: LucideIcon };
type NavEntry = NavLinkItem | { group: string; label: string; icon: LucideIcon; items: NavLinkItem[] };

/** Hauptmenü wie bei gängiger Buchhaltungssoftware: Einträge und aufklappbare Gruppen. */
export const NAV: NavEntry[] = [
  { href: '/app', label: 'Startseite', icon: LayoutDashboard },
  { group: 'docs', label: 'Dokumente', icon: FolderOpen, items: [
    { href: '/app/angebote', label: 'Angebote', icon: FileText },
    { href: '/app/auftragsbestaetigungen', label: 'Auftragsbestätigungen', icon: ClipboardCheck },
    { href: '/app/lieferscheine', label: 'Lieferscheine', icon: Truck },
    { href: '/app/rechnungen', label: 'Rechnungen', icon: ReceiptText },
    { href: '/app/bestellungen', label: 'Bestellungen', icon: ShoppingCart },
  ] },
  { href: '/app/kunden', label: 'Kunden', icon: Users },
  { href: '/app/material', label: 'Material & Lager', icon: Boxes },
  { group: 'books', label: 'Buchführung', icon: BookOpen, items: [
    { href: '/app/ausgaben?art=einnahmen', label: 'Einnahmen', icon: ArrowDownLeft },
    { href: '/app/ausgaben?art=ausgaben', label: 'Ausgaben', icon: ArrowUpRight },
  ] },
  { group: 'reports', label: 'Berichte', icon: PieChart, items: [
    { href: '/app/guv', label: 'GuV & Finanzen', icon: BarChart3 },
    { href: '/app/export', label: 'DATEV-Export', icon: FileSpreadsheet },
  ] },
  { href: '/app/erweiterungen', label: 'Erweiterungen', icon: Puzzle },
];

const OPEN_KEY = 'vysn-nav-open';

function active(pathname: string, search: string, href: string) {
  const [path, query] = href.split('?');
  if (path === '/app') return pathname === '/app';
  if (!pathname.startsWith(path)) return false;
  return !query || new URLSearchParams(search).toString().includes(query);
}

function readOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch { return {}; }
}

function Nav({ search }: { search: string }) {
  const pathname = usePathname() || '/app';
  const { role, can, requireFeature } = useStore();
  const admin = isAdminRole(role);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => setOpen(readOpen()), []);
  const toggle = (group: string, value: boolean) => {
    const next = { ...open, [group]: value };
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* privates Fenster */ }
  };
  const lockedFor = (href: string) => { const f = featureForPath(href.split('?')[0]); return f && !can(f) ? f : null; };
  const visible = (i: NavLinkItem) => admin || !ADMIN_PATHS.includes(i.href);

  const link = (item: NavLinkItem, sub = false) => {
    const locked = lockedFor(item.href);
    const on = active(pathname, search, item.href);
    return (
      <Link key={item.href} href={item.href} className={`nav-link${sub ? ' nav-sub' : ''}${on ? ' active' : ''}`} aria-current={on ? 'page' : undefined}
        onClick={(e) => { if (locked) { e.preventDefault(); requireFeature(locked); } }}>
        <item.icon size={sub ? 16 : 17} strokeWidth={1.8} />{item.label}
        {locked ? <Lock size={13} className="nav-lock" aria-label="Nicht im Tarif" /> : null}
      </Link>
    );
  };

  return (
    <nav className="side-nav">
      {NAV.map((entry) => {
        if (!('group' in entry)) return visible(entry) ? link(entry) : null;
        const items = entry.items.filter(visible);
        if (!items.length) return null;
        const current = items.some((i) => active(pathname, search, i.href));
        // Gruppe mit der aktuellen Seite ist immer offen
        const isOpen = current || !!open[entry.group];
        return (
          <div key={entry.group} className={`nav-fold${isOpen ? ' open' : ''}`}>
            <button type="button" className={`nav-link nav-fold-head${current ? ' has-active' : ''}`} aria-expanded={isOpen}
              onClick={() => toggle(entry.group, !isOpen)}>
              <entry.icon size={17} strokeWidth={1.8} />{entry.label}
              <ChevronDown size={15} className="nav-chevron" />
            </button>
            {isOpen ? <div className="nav-fold-items">{items.map((i) => link(i, true))}</div> : null}
          </div>
        );
      })}
    </nav>
  );
}

function WithSearch() {
  const search = useSearchParams()?.toString() || '';
  return <Nav search={search} />;
}

export function SideNav() {
  return <Suspense fallback={<Nav search="" />}><WithSearch /></Suspense>;
}
