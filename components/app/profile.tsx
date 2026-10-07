'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { PLANS } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ROLE_LABEL } from '../../lib/team';
import { AccountRows } from './account-menu';
import { CompanyAvatar, CompanyList, LogoutButton } from './company-switcher';

/** Profil (Handy): Konto-Menü, Firmenwechsel und Abmelden – wie oben rechts am Computer. */
export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { data, auth, role } = useStore();
  const company = data.company!;

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

      <span className="profile-label">Konto & Einstellungen</span>
      <div className="profile-card">
        <AccountRows onClose={onClose} className="profile-row" />
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
