'use client';

import { useRouter } from 'next/navigation';
import { Check, Lock, LogOut, Plus } from 'lucide-react';
import { PLANS } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { ROLE_LABEL } from '../../lib/team';
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
  const { companies, activeCompanyId, switchCompany, startNewCompany, canAddCompany } = useStore();
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
        <span><strong>Neue Firma anlegen</strong><small>{canAddCompany ? 'Eigene Kunden, Nummern & Design' : 'Ab Tarif Business'}</small></span>
        {canAddCompany ? null : <Lock size={14} className="company-lock" />}
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
