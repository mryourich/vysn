'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronRight, ChevronsUpDown, CreditCard, Lock, Settings2, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PLANS, featureForPath } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ROLE_LABEL, isAdminRole } from '../../lib/team';
import { CompanyAvatar, CompanyList, LogoutButton } from './company-switcher';

type Row = { href: string; label: string; hint: string; icon: LucideIcon; admin?: boolean };

/** Einstellungen im Profil (statt eigener Gruppe in der Navigation). */
const SETTINGS: Row[] = [
  { href: '/app/firma', label: 'Unternehmen & Rechnungsdesign', hint: 'Stammdaten, Logo, Gestaltung', icon: Building2, admin: true },
  { href: '/app/einstellungen', label: 'E-Mail & Versand', hint: 'Absender, Vorlagen, automatischer Versand', icon: Settings2, admin: true },
  { href: '/app/team', label: 'Team & Rechte', hint: 'Mitarbeitende einladen, Rollen', icon: UserPlus },
  { href: '/app/tarif', label: 'Tarif & Abrechnung', hint: 'Tarif, Zahlung, Rechnungen', icon: CreditCard, admin: true },
];

/** Profil: Firma, Einstellungen, Firmenwechsel und Abmelden. */
export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { data, auth, role, can, requireFeature } = useStore();
  const company = data.company!;
  const rows = SETTINGS.filter((r) => !r.admin || isAdminRole(role));

  return (
    <div className="profile-panel">
      <div className="profile-head">
        <CompanyAvatar name={company.name} logo={company.logo} size={44} />
        <span>
          <strong>{company.name}</strong>
          <small>Tarif {PLANS[company.plan]?.label ?? company.plan}{role !== 'owner' ? ` · ${ROLE_LABEL[role]}` : ''}</small>
          {auth.email ? <small className="profile-email">{auth.email}</small> : null}
        </span>
      </div>

      <span className="profile-label">Einstellungen</span>
      <div className="profile-card">
        {rows.map((r) => {
          const feature = featureForPath(r.href);
          const locked = feature && !can(feature) ? feature : null;
          return (
            <Link key={r.href} href={r.href} className="profile-row"
              onClick={(e) => { if (locked) { e.preventDefault(); onClose(); requireFeature(locked); } else onClose(); }}>
              <span className="profile-icon"><r.icon size={17} strokeWidth={1.9} /></span>
              <span className="profile-text"><strong>{r.label}</strong><small>{r.hint}</small></span>
              {locked ? <Lock size={14} className="profile-chevron" /> : <ChevronRight size={16} className="profile-chevron" />}
            </Link>
          );
        })}
      </div>

      <span className="profile-label">Firma wechseln</span>
      <div className="profile-card profile-companies"><CompanyList onDone={onClose} /></div>

      <div className="profile-foot">
        <LogoutButton className="btn btn-small" onDone={onClose} />
      </div>
    </div>
  );
}

/** Firmenkarte unten in der Seitenleiste – öffnet das Profil mit den Einstellungen. */
export function ProfileButton({ onMobile }: { onMobile?: () => void } = {}) {
  const { data } = useStore();
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
  const company = data.company!;
  return (
    <div className="switcher" ref={ref}>
      {open ? <div className="switcher-menu profile-popover" role="dialog" aria-label="Profil & Einstellungen"><ProfilePanel onClose={() => setOpen(false)} /></div> : null}
      <button className="company-card" onClick={() => { if (onMobile && window.matchMedia('(max-width: 860px)').matches) onMobile(); else setOpen(!open); }} aria-expanded={open} aria-haspopup="dialog" title="Profil & Einstellungen">
        <CompanyAvatar name={company.name} logo={company.logo} size={36} />
        <span><strong>{company.name}</strong><small>Profil & Einstellungen</small></span>
        <ChevronsUpDown size={16} className="switcher-chevron" />
      </button>
    </div>
  );
}
