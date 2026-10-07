'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Check, CreditCard, Mic, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import { formatDate } from '../../lib/calc';
import { aiBilling, aiWithdraw, aiWithdrawalInfo } from '../../lib/billing';
import { AI_ADDON, aiAddonActive, formatPlanPrice } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { isAdminRole } from '../../lib/team';
import { ASSISTANT_EVENT } from './voice-assistant';
import { Badge, Field, Modal } from './ui';

const NOTICE_KEY = 'vysn-ai-notice';

/** Erweiterung „KI-Sprachassistent“: Zusatzbuchung mit eigenem Abo – buchen, nutzen, verwalten, kündigen, widerrufen. */
export function AiAddonCard() {
  return <Suspense fallback={null}><Card /></Suspense>;
}

function Card() {
  const { data, auth, role, activeCompanyId, switchCompany } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const ai = data.company?.billing?.ai;
  const booked = auth.mode !== 'supabase' || aiAddonActive(ai);
  const canManage = isAdminRole(role);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNoticeState] = useState(() => { try { const n = sessionStorage.getItem(NOTICE_KEY) || ''; sessionStorage.removeItem(NOTICE_KEY); return n; } catch { return ''; } });
  const setNotice = (text: string, keep = false) => {
    setNoticeState(text);
    try { if (keep) sessionStorage.setItem(NOTICE_KEY, text); } catch { /* privates Fenster */ }
  };

  // Widerrufsrecht: 14 Tage ab Buchung
  const [withdrawal, setWithdrawal] = useState<{ eligible: boolean; until?: string } | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawName, setWithdrawName] = useState('');
  useEffect(() => {
    if (!activeCompanyId || auth.mode !== 'supabase' || !canManage || !aiAddonActive(ai)) { setWithdrawal(null); return; }
    aiWithdrawalInfo(activeCompanyId).then(setWithdrawal);
  }, [activeCompanyId, auth.mode, canManage, ai]);

  // Rückkehr aus Stripe
  const ki = params.get('ki');
  useEffect(() => {
    if (!activeCompanyId || auth.mode !== 'supabase' || !ki || ki === '1') return;
    const done = () => { router.replace('/app/erweiterungen'); switchCompany(activeCompanyId); };
    if (ki === 'gebucht') {
      setNotice('Vielen Dank! Der KI-Sprachassistent wird freigeschaltet …');
      aiBilling(activeCompanyId, 'sync')
        .then((r) => setNotice(r.active ? 'Der KI-Sprachassistent ist gebucht – tippen Sie unten rechts auf „KI“.' : 'Die Zahlung wird noch bestätigt – das kann einen Moment dauern.', true))
        .catch(() => setNotice('Die Zahlung wird noch bestätigt – das kann einen Moment dauern.', true))
        .finally(done);
    } else if (ki === 'gekuendigt') {
      aiBilling(activeCompanyId, 'sync').catch(() => null).finally(() => { setNotice('Ihre Kündigung wurde bei Stripe bestätigt. Der Assistent bleibt bis zum Laufzeitende nutzbar.', true); done(); });
    } else if (ki === 'abgebrochen') {
      setNotice('Die Buchung wurde abgebrochen. Es wurde nichts berechnet.');
      router.replace('/app/erweiterungen');
    }
  }, [ki, activeCompanyId, auth.mode, router, switchCompany]);

  const go = async (key: string, fn: () => Promise<Record<string, string>>, after?: () => void) => {
    setBusy(key);
    setError('');
    try {
      const r = await fn();
      if (r.url) { window.location.href = r.url; return; }
      after?.();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy('');
  };

  const confirmWithdrawal = async () => {
    setBusy('withdraw');
    setError('');
    try {
      const r = await aiWithdraw(activeCompanyId!, withdrawName.trim());
      const amount = r.refunded ? (r.refunded / 100).toLocaleString('de-DE', { style: 'currency', currency: r.currency || 'EUR' }) : '';
      setNotice(`Ihr Widerruf ist eingegangen und das KI-Abo beendet. ${amount ? `${amount} werden vollständig auf Ihre Zahlungsart erstattet. ` : ''}${r.mailed ? 'Die Bestätigung haben wir Ihnen per E-Mail gesendet.' : ''}`, true);
      setWithdrawOpen(false);
      await switchCompany(activeCompanyId!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const price = `${formatPlanPrice(AI_ADDON.monthly)} €`;
  const ending = aiAddonActive(ai) && ai?.cancelAtPeriodEnd;

  return (
    <article className="ext-card ext-card-ai" id="ki">
      <div className="ext-top">
        <span className="ext-logo" style={{ background: '#13873e' }}><Mic size={22} /></span>
        <div><strong>KI-Sprachassistent</strong><small>Zusatzbuchung · {price} / Monat</small></div>
        {booked ? <Badge tone={ending ? 'warning' : 'success'}>{ending ? 'Gekündigt' : 'Gebucht'}</Badge> : <Badge tone="info">{price} / Monat</Badge>}
      </div>
      <p>Belege per Sprachmemo erstellen, Fragen zu Umsatz und offenen Rechnungen stellen und Tipps erhalten – mit Rückfragen bei Unklarheiten.</p>
      {!booked ? (
        <ul className="ext-points">
          <li><Check size={14} /> In jedem Tarif buchbar, auch in Start</li>
          <li><Check size={14} /> {price} im Monat zzgl. USt., monatlich kündbar</li>
          <li><Check size={14} /> 14 Tage Widerrufsrecht mit voller Erstattung</li>
        </ul>
      ) : null}
      {booked && ai?.periodEnd ? (
        <p className="muted small">{ending ? `Gekündigt – nutzbar bis ${formatDate(ai.periodEnd.slice(0, 10))}.` : `Verlängert sich am ${formatDate(ai.periodEnd.slice(0, 10))} um einen Monat.`}</p>
      ) : null}
      {notice ? <div className="notice"><span>{notice}</span></div> : null}
      {error ? <div className="notice notice-warn" role="alert"><span>{error}</span></div> : null}
      <div className="ext-actions">
        {booked ? (
          <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event(ASSISTANT_EVENT))}><Sparkles size={15} /> Öffnen</button>
        ) : canManage ? (
          <button className="btn btn-primary" disabled={!!busy} onClick={() => go('checkout', () => aiBilling(activeCompanyId!, 'checkout'))}>
            <Sparkles size={15} /> {busy === 'checkout' ? 'Öffne Stripe …' : `Für ${price} / Monat buchen`}
          </button>
        ) : <span className="muted small">Buchen können Inhaber und Admins.</span>}
        {booked && canManage && auth.mode === 'supabase' ? (
          <>
            <button className="btn" disabled={!!busy} onClick={() => go('portal', () => aiBilling(activeCompanyId!, 'portal'))}><CreditCard size={15} /> Zahlung & Rechnungen</button>
            {ending
              ? <button className="btn" disabled={!!busy} onClick={() => go('resume', () => aiBilling(activeCompanyId!, 'resume'), () => { setNotice('Die Kündigung ist zurückgenommen.', true); switchCompany(activeCompanyId!); })}><RotateCcw size={15} /> Kündigung zurücknehmen</button>
              : <button className="btn btn-quiet" disabled={!!busy} onClick={() => go('cancel', () => aiBilling(activeCompanyId!, 'cancel'))}>Kündigen</button>}
          </>
        ) : null}
      </div>
      {withdrawal?.eligible ? (
        <p className="muted small ext-withdraw">
          Widerruf noch bis {withdrawal.until ? formatDate(withdrawal.until.slice(0, 10)) : '–'} möglich – volle Erstattung.{' '}
          <button className="link-btn" onClick={() => setWithdrawOpen(true)}><Undo2 size={13} /> Vertrag widerrufen</button>
        </p>
      ) : null}
      {withdrawOpen ? (
        <Modal title="Widerruf bestätigen" onClose={() => setWithdrawOpen(false)}
          footer={<><button className="btn btn-quiet" onClick={() => setWithdrawOpen(false)}>Abbrechen</button>
            <button className="btn btn-primary" disabled={busy === 'withdraw'} onClick={confirmWithdrawal}>{busy === 'withdraw' ? 'Wird verarbeitet …' : 'Widerruf bestätigen'}</button></>}>
          <p>Hiermit widerrufe ich den Vertrag über den <strong>KI-Sprachassistenten</strong> für „{data.company?.name}“. Das KI-Abo endet sofort, der bezahlte Betrag wird vollständig erstattet. Ihr Tarif bleibt unverändert.</p>
          <Field label="Ihr Name"><input value={withdrawName} onChange={(e) => setWithdrawName(e.target.value)} placeholder="Vor- und Nachname" autoFocus /></Field>
          {error ? <div className="notice notice-warn" role="alert"><span>{error}</span></div> : null}
        </Modal>
      ) : null}
    </article>
  );
}
