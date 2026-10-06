'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Boxes, ChevronDown, ChevronRight, FileText, LayoutDashboard, Lock, Menu, Plus, ReceiptText, ScanLine, UserPlus, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PLANS } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ROLE_LABEL } from '../../lib/team';
import { featureForPath } from '../../lib/plans';
import { CompanyAvatar, CompanyList, LogoutButton } from './company-switcher';
import { CREATE_EVENT } from './ui';

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { group: string; items: NavItem[] };

const isActive = (pathname: string, href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

type Sheet = 'menu' | 'create' | null;

/** Handy-Navigation: Tab-Leiste mit „+“ (Schnellaktionen) und gruppiertem Menü. */
export function MobileNav({ nav, open, onOpen }: { nav: NavGroup[]; open: Sheet; onOpen: (s: Sheet) => void }) {
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
        <button className={open === 'menu' ? 'active' : ''} onClick={() => onOpen(open === 'menu' ? null : 'menu')} aria-expanded={open === 'menu'}>
          <Menu size={21} strokeWidth={1.8} /><span>Menü</span>
        </button>
      </nav>
      {open ? (
        <div className="sheet-backdrop" onClick={close}>
          <div className={`sheet ${open === 'menu' ? 'menu-sheet' : 'create-sheet'}`} role="dialog" aria-modal="true" aria-label={open === 'menu' ? 'Menü' : 'Neu erstellen'} onClick={(e) => e.stopPropagation()}>
            <span className="sheet-grabber" aria-hidden="true" />
            {open === 'menu' ? <MenuSheet nav={nav} pathname={pathname} onClose={close} guard={guard} /> : <CreateSheet pathname={pathname} onClose={close} guard={guard} />}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MenuSheet({ nav, pathname, onClose, guard }: { nav: NavGroup[]; pathname: string; onClose: () => void; guard: (href: string) => (e: React.MouseEvent) => void }) {
  const { data, auth, role, companies, can } = useStore();
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const company = data.company!;
  const groups = nav.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== '/app') })).filter((g) => g.items.length);
  const multi = companies.length > 1;

  return (
    <>
      <div className="sheet-head">
        <strong>Menü</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
      </div>
      <div className="sheet-body">
        <div className="menu-card">
          <button className="menu-company" onClick={() => setCompaniesOpen(!companiesOpen)} aria-expanded={companiesOpen}>
            <CompanyAvatar name={company.name} logo={company.logo} size={40} />
            <span>
              <strong>{company.name}</strong>
              <small>Tarif {PLANS[company.plan]?.label ?? company.plan}{role !== 'owner' ? ` · ${ROLE_LABEL[role]}` : ''}</small>
            </span>
            <em>{multi ? 'Wechseln' : 'Firmen'}<ChevronDown size={15} className={companiesOpen ? 'flip' : ''} /></em>
          </button>
          {companiesOpen ? <div className="menu-companies"><CompanyList onDone={onClose} /></div> : null}
        </div>

        {groups.map((g) => (
          <section key={g.group} className="menu-group">
            <span className="menu-group-label">{g.group}</span>
            <div className="menu-card">
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} onClick={(e) => { guard(item.href)(e); if (!e.defaultPrevented) onClose(); }} className={`menu-row${isActive(pathname, item.href) ? ' active' : ''}`}>
                  <span className="menu-icon"><item.icon size={17} strokeWidth={1.9} /></span>
                  <span className="menu-label">{item.label}</span>
                  {(() => { const f = featureForPath(item.href); return f && !can(f) ? <Lock size={14} className="menu-chevron" /> : <ChevronRight size={16} className="menu-chevron" />; })()}
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="menu-foot">
          <span>{auth.email || <Link href="/" onClick={onClose}>Zur Startseite</Link>}</span>
          <LogoutButton className="btn btn-small" onDone={onClose} />
        </div>
      </div>
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
