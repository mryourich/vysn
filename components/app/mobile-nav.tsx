'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Boxes, ChevronRight, FileText, LayoutDashboard, Menu, Plus, ReceiptText, ScanLine, UserPlus, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../../lib/store';
import { featureForPath } from '../../lib/plans';
import { ProfilePanel } from './profile';
import { CREATE_EVENT } from './ui';

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { group: string; items: NavItem[] };

const isActive = (pathname: string, href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

type Sheet = 'create' | 'profile' | null;

/** Handy-Navigation: Tab-Leiste mit „+“ (Schnellaktionen) und gruppiertem Menü. */
export function MobileNav({ open, onOpen, onMenu, menuOpen }: { open: Sheet; onOpen: (s: Sheet) => void; onMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname() || '/app';
  const close = () => onOpen(null);
  const { can, requireFeature } = useStore();
  /** Gesperrte Funktion: Klick öffnet „Jetzt upgraden“ statt der Seite. */
  const guard = (href: string) => (e: React.MouseEvent) => {
    const f = featureForPath(href);
    if (f && !can(f)) { e.preventDefault(); onOpen(null); requireFeature(f); }
  };

  // Hintergrund nicht mitscrollen und Escape schließt
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpen(null);
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onOpen]);

  const tab = (href: string, label: string, Icon: LucideIcon) => (
    <Link href={href} className={isActive(pathname, href) && !open ? 'active' : ''} aria-current={isActive(pathname, href) ? 'page' : undefined} onClick={guard(href)}>
      <Icon size={21} strokeWidth={1.8} /><span>{label}</span>
    </Link>
  );

  return (
    <>
      <nav className="tabbar" aria-label="Hauptnavigation">
        {tab('/app', 'Übersicht', LayoutDashboard)}
        {tab('/app/rechnungen', 'Rechnungen', ReceiptText)}
        <button className={`tab-create${open === 'create' ? ' open' : ''}`} onClick={() => onOpen(open === 'create' ? null : 'create')} aria-label="Neu erstellen" aria-expanded={open === 'create'}>
          <span><Plus size={24} strokeWidth={2.2} /></span>
        </button>
        {tab('/app/scan', 'Scannen', ScanLine)}
        <button className={menuOpen ? 'active' : ''} onClick={() => { onOpen(null); onMenu(); }} aria-expanded={menuOpen}>
          <Menu size={21} strokeWidth={1.8} /><span>Menü</span>
        </button>
      </nav>
      {open ? (
        <div className="sheet-backdrop" onClick={close}>
          <div className={`sheet ${open === 'create' ? 'create-sheet' : 'menu-sheet'}`} role="dialog" aria-modal="true" aria-label={open === 'profile' ? 'Profil & Einstellungen' : 'Neu erstellen'} onClick={(e) => e.stopPropagation()}>
            <span className="sheet-grabber" aria-hidden="true" />
            {open === 'profile' ? (
                <>
                  <div className="sheet-head"><strong>Profil & Einstellungen</strong><button className="icon-btn" onClick={close} aria-label="Schließen"><X size={18} /></button></div>
                  <div className="sheet-body"><ProfilePanel onClose={close} /></div>
                </>
              ) : <CreateSheet pathname={pathname} onClose={close} guard={guard} />}
          </div>
        </div>
      ) : null}
    </>
  );
}

type Action = { key: string; label: string; hint: string; icon: LucideIcon; tone: string; run: () => void };

function CreateSheet({ pathname, onClose, guard }: { pathname: string; onClose: () => void; guard: (href: string) => (e: React.MouseEvent) => void }) {
  const { createDoc } = useStore();
  const router = useRouter();

  const doc = async (kind: 'invoice' | 'offer') => {
    onClose();
    const d = await createDoc(kind);
    if (d) router.push(`/app/${kind === 'invoice' ? 'rechnungen' : 'angebote'}/bearbeiten?id=${d.id}`);
  };
  const open = (path: string, value = '1') => {
    onClose();
    if (pathname === path) window.dispatchEvent(new CustomEvent(CREATE_EVENT, { detail: value }));
    else router.push(`${path}?neu=${value}`);
  };

  const actions: Action[] = [
    { key: 'invoice', label: 'Rechnung', hint: 'Schreiben & senden', icon: ReceiptText, tone: 'blue', run: () => doc('invoice') },
    { key: 'offer', label: 'Angebot', hint: 'Kostenvoranschlag', icon: FileText, tone: 'cyan', run: () => doc('offer') },
    { key: 'customer', label: 'Kunde', hint: 'Kontakt anlegen', icon: UserPlus, tone: 'violet', run: () => open('/app/kunden') },
    { key: 'expense', label: 'Ausgabe', hint: 'Beleg erfassen', icon: ArrowUpRight, tone: 'orange', run: () => open('/app/ausgaben', 'ausgabe') },
    { key: 'income', label: 'Einnahme', hint: 'Barverkauf & Co.', icon: ArrowDownLeft, tone: 'green', run: () => open('/app/ausgaben', 'einnahme') },
    { key: 'material', label: 'Artikel', hint: 'Material anlegen', icon: Boxes, tone: 'slate', run: () => open('/app/material') },
  ];

  return (
    <>
      <div className="sheet-head">
        <strong>Neu erstellen</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
      </div>
      <div className="create-grid">
        {actions.map((a) => (
          <button key={a.key} className="create-tile" onClick={a.run}>
            <span className={`create-icon tone-${a.tone}`}><a.icon size={20} strokeWidth={1.9} /></span>
            <strong>{a.label}</strong>
            <small>{a.hint}</small>
          </button>
        ))}
      </div>
      <Link href="/app/scan" className="create-scan" onClick={(e) => { guard('/app/scan')(e); if (!e.defaultPrevented) onClose(); }}>
        <ScanLine size={18} /><span><strong>Lager buchen</strong><small>QR-Code am Regal scannen und ein- oder auslagern</small></span><ChevronRight size={16} />
      </Link>
    </>
  );
}
