'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowRight, Info, UserPlus } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { ROLE_HINT, ROLE_LABEL, acceptInvite, inviteInfo, setPendingInvite } from '../../../lib/team';
import type { InviteInfo } from '../../../lib/team';
import { Brand } from '../../../components/app/brand';
import { Login } from '../../../components/app/login';

export default function InvitePage() {
  return <Suspense fallback={<div className="app-loading"><span className="spinner" /></div>}><Invite /></Suspense>;
}

function Invite() {
  const { ready, authenticated, auth, switchCompany } = useStore();
  const router = useRouter();
  const token = useSearchParams()?.get('token') || '';
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || auth.mode !== 'supabase') { setInfo(null); return; }
    // Merken, damit die Einladung auch nach Registrierung/E-Mail-Bestätigung angenommen werden kann
    setPendingInvite(token);
    inviteInfo(token).then(setInfo).catch(() => setInfo(null));
  }, [token, auth.mode]);

  const leave = (to = '/app') => { setPendingInvite(''); router.replace(to); };

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const companyId = await acceptInvite(token);
      setPendingInvite('');
      await switchCompany(companyId);
      router.replace('/app');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!ready || info === undefined) return <div className="app-loading"><span className="spinner" /></div>;

  const invalid = !info || info.accepted || info.expired;
  if (!authenticated && !invalid) return <Login invite={{ companyName: info.companyName, email: info.email }} />;

  const wrongUser = !!info && !!auth.email && auth.email.toLowerCase() !== info.email;

  return (
    <div className="onboarding">
      <aside className="onboarding-side">
        <Brand />
        <div>
          <h1>Gemeinsam an Angeboten, Rechnungen und Zahlen arbeiten.</h1>
          <p>Alle im Team sehen denselben Stand – im Büro, unterwegs und auf der Baustelle.</p>
        </div>
        <span />
      </aside>
      <main className="onboarding-main">
        <div className="onboarding-card invite-card">
          {invalid ? (
            <>
              <h2>Einladung nicht mehr gültig</h2>
              <p className="muted">
                {!info ? 'Dieser Einladungslink ist ungültig oder wurde zurückgezogen.'
                  : info.accepted ? 'Diese Einladung wurde bereits angenommen.'
                    : `Die Einladung zu „${info.companyName}“ ist abgelaufen. Bitten Sie um eine neue Einladung.`}
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => leave()}>Zur App <ArrowRight size={16} /></button>
            </>
          ) : (
            <>
              <div className="empty-icon"><UserPlus size={22} /></div>
              <h2>Einladung zu {info.companyName}</h2>
              <p className="muted">Sie wurden als <strong>{ROLE_LABEL[info.role]}</strong> eingeladen: {ROLE_HINT[info.role]}.</p>
              {wrongUser ? (
                <div className="notice notice-warn"><Info size={16} /><span>Die Einladung gilt für <strong>{info.email}</strong>, Sie sind als {auth.email} angemeldet. Bitte melden Sie sich mit der eingeladenen Adresse an.</span></div>
              ) : null}
              {error ? <p className="field-error">{error}</p> : null}
              <div className="invite-actions">
                {wrongUser ? <button className="btn btn-primary btn-lg" onClick={() => auth.signOut()}>Abmelden und neu anmelden</button> : (
                  <button className="btn btn-primary btn-lg" disabled={busy} onClick={accept}>{busy ? 'Bitte warten …' : <>Einladung annehmen <ArrowRight size={16} /></>}</button>
                )}
                <button className="btn btn-quiet" onClick={() => leave()}>Ablehnen</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
