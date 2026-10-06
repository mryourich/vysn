'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronsUpDown, CreditCard, LogOut, Plus, UserPlus } from 'lucide-react';
import { PLANS } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ROLE_LABEL, isAdminRole } from '../../lib/team';
import type { Role } from '../../lib/team';
import type { CompanySummary } from '../../lib/types';

export function CompanyAvatar({ name, logo, size = 32 }: { name: string; logo: string; size?: number }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="company-avatar" src={logo} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="company-avatar company-initial" style={{ width: size, height: size }}>{name.slice(0, 1).toUpperCase() || '?'}</span>
  );
}

/** Liste aller Firmen mit „Neue Firma“ – genutzt im Desktop-Menü und im mobilen Menü. */
export function CompanyList({ onDone }: { onDone?: () => void }) {
  const { companies, activeCompanyId, switchCompany, startNewCompany } = useStore();
  const router = useRouter();
  const open = async (c: CompanySummary) => {
    onDone?.();
    if (c.id !== activeCompanyId) {
      await switchCompany(c.id);
      router.push('/app');
    }
  };
  return (
    <div className="company-list">
      {companies.map((c) => (
        <button key={c.id} className={`company-row${c.id === activeCompanyId ? ' active' : ''}`} onClick={() => open(c)}>
          <CompanyAvatar name={c.name} logo={c.logo} size={28} />
          <span><strong>{c.name}</strong><small>Tarif {PLANS[c.plan]?.label ?? c.plan}{c.role && c.role !== 'owner' ? ` · ${ROLE_LABEL[c.role as Role] ?? c.role}` : ''}</small></span>
          {c.id === activeCompanyId ? <Check size={16} /> : null}
        </button>
      ))}
      <button className="company-row company-new" onClick={async () => { onDone?.(); await startNewCompany(); }}>
        <span className="company-avatar company-plus"><Plus size={16} /></span>
        <span><strong>Neue Firma anlegen</strong><small>Eigene Kunden, Nummern & Design</small></span>
      </button>
    </div>
  );
}

/** Abmelden (Supabase) bzw. App verlassen (lokaler Modus ohne Konto). */
export function LogoutButton({ className = 'btn btn-quiet', onDone }: { className?: string; onDone?: () => void }) {
  const { auth } = useStore();
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        onDone?.();
        if (auth.mode === 'supabase') await auth.signOut();
        router.push(auth.mode === 'supabase' ? '/app' : '/');
      }}
      title={auth.mode === 'supabase' ? `Abmelden (${auth.email})` : 'Ohne Konto gibt es keine Anmeldung – zurück zur Startseite'}
    >
      <LogOut size={16} /> {auth.mode === 'supabase' ? 'Abmelden' : 'App verlassen'}
    </button>
  );
}

/** Firmenkarte unten in der Seitenleiste mit Menü zum Wechseln. */
export function CompanySwitcher() {
  const { data, auth, role } = useStore();
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
      {open ? (
        <div className="switcher-menu" role="menu">
          <span className="switcher-label">Firmen</span>
          <CompanyList onDone={() => setOpen(false)} />
          <div className="switcher-foot">
            {isAdminRole(role) ? <Link href="/app/firma" className="switcher-item" onClick={() => setOpen(false)}><Building2 size={16} /> Firmendaten</Link> : null}
            <Link href="/app/team" className="switcher-item" onClick={() => setOpen(false)}><UserPlus size={16} /> Team & Rechte</Link>
            {isAdminRole(role) ? <Link href="/app/tarif" className="switcher-item" onClick={() => setOpen(false)}><CreditCard size={16} /> Tarif & Abrechnung</Link> : null}
            {auth.email ? <span className="switcher-email">{auth.email}</span> : null}
          </div>
        </div>
      ) : null}
      <button className="company-card" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <CompanyAvatar name={company.name} logo={company.logo} size={36} />
        <span><strong>{company.name}</strong><small>Tarif {PLANS[company.plan]?.label ?? company.plan}</small></span>
        <ChevronsUpDown size={16} className="switcher-chevron" />
      </button>
    </div>
  );
}
