'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, CreditCard, LifeBuoy, Lock, Receipt, Settings2, UserCog, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PLANS, featureForPath } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ROLE_LABEL, isAdminRole } from '../../lib/team';
import { CompanyAvatar, CompanyList, LogoutButton } from './company-switcher';

export type AccountRow = { href: string; label: string; hint: string; icon: LucideIcon; admin?: boolean; external?: boolean };

/** Konto-Menü: dieselben Einträge oben rechts (Computer) und im Profil (Handy). */
export const ACCOUNT_ROWS: AccountRow[] = [
  { href: '/app/konto', label: 'Account', hint: 'E-Mail-Adresse und Passwort', icon: UserCog },
  { href: '/app/einstellungen', label: 'Einstellungen', hint: 'Firma, Steuern, Nummern, Layout, Texte, Versand', icon: Settings2, admin: true },
  { href: '/app/team', label: 'Team & Rechte', hint: 'Mitarbeitende einladen, Rollen', icon: UserPlus },
  { href: '/app/tarif', label: 'Abonnement', hint: 'Tarif wechseln, Kontingente', icon: CreditCard, admin: true },
  { href: '/app/tarif#zahlungen', label: 'Zahlungen', hint: 'Zahlungsart und Rechnungen von VYSN', icon: Receipt, admin: true },
  { href: 'mailto:hallo@vysn.de?subject=Support%20VYSN%20One', label: 'Support', hint: 'hallo@vysn.de', icon: LifeBuoy, external: true },
];

/** Klappmenü: schließt bei Klick daneben und mit Escape. */
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Einträge des Konto-Menüs mit Rechte- und Tarifprüfung. */
export function AccountRows({ onClose, className = 'menu-row' }: { onClose: () => void; className?: string }) {
  const { role, can, requireFeature } = useStore();
  return (
    <>
      {ACCOUNT_ROWS.filter((r) => !r.admin || isAdminRole(role)).map((r) => {
        const feature = r.external ? null : featureForPath(r.href.split('#')[0]);
        const locked = feature && !can(feature) ? feature : null;
        const inner = (
          <>
            <span className="menu-icon"><r.icon size={17} strokeWidth={1.9} /></span>
            <span className="menu-text"><strong>{r.label}</strong><small>{r.hint}</small></span>
            {locked ? <Lock size={14} className="menu-lock" /> : null}
          </>
        );
        return r.external
          ? <a key={r.href} href={r.href} className={className} onClick={onClose}>{inner}</a>
          : (
            <Link key={r.href} href={r.href} className={className}
              onClick={(e) => { onClose(); if (locked) { e.preventDefault(); requireFeature(locked); } }}>
              {inner}
            </Link>
          );
      })}
    </>
  );
}

function CompanyMenu() {
  const { data, role } = useStore();
  const { open, setOpen, ref } = useDropdown();
  const company = data.company!;
  return (
    <div className="dd" ref={ref}>
      <button className="dd-trigger dd-company" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <CompanyAvatar name={company.name} logo={company.logo} size={28} />
        <span><strong>{company.name}</strong><small>Tarif {PLANS[company.plan]?.label ?? company.plan}{role !== 'owner' ? ` · ${ROLE_LABEL[role]}` : ''}</small></span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="dd-menu dd-menu-company" role="menu">
          <span className="dd-label">Firma wechseln</span>
          <CompanyList onDone={() => setOpen(false)} />
          {isAdminRole(role) ? (
            <Link href="/app/einstellungen?bereich=firma" className="menu-row menu-row-foot" onClick={() => setOpen(false)}>
              <span className="menu-icon"><Building2 size={17} strokeWidth={1.9} /></span>
              <span className="menu-text"><strong>Unternehmensdaten</strong><small>Adresse, Bank, Logo</small></span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AccountMenu() {
  const { auth } = useStore();
  const { open, setOpen, ref } = useDropdown();
  const email = auth.email || 'Lokaler Modus';
  const initial = (auth.email || 'V').slice(0, 1).toUpperCase();
  return (
    <div className="dd" ref={ref}>
      <button className="dd-trigger dd-account" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Konto-Menü" title={email}>
        <span className="account-avatar">{initial}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="dd-menu dd-menu-account" role="menu">
          <div className="dd-head"><span className="account-avatar">{initial}</span><span><strong>Angemeldet als</strong><small>{email}</small></span></div>
          <AccountRows onClose={() => setOpen(false)} />
          <div className="dd-foot"><LogoutButton className="btn btn-small" onDone={() => setOpen(false)} /></div>
        </div>
      ) : null}
    </div>
  );
}

/** Kopfleiste oben rechts (Computer): Firmenwechsel und Konto-Menü. */
export function DeskBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="deskbar">
      <div className="deskbar-left">{children}</div>
      <CompanyMenu />
      <AccountMenu />
    </div>
  );
}
