'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CalendarClock, Check, CreditCard, ExternalLink, Info, Sparkles, Undo2 } from 'lucide-react';
import { formatDate } from '../../../lib/calc';
import { billingInfo, changePlan, openPortal, startCheckout, syncBilling } from '../../../lib/billing';
import type { ChangeResult } from '../../../lib/billing';
import type { BillingInfo } from '../../../lib/billing';
import { PLAN_OFFERS, PLANS, TRIAL_DAYS, formatPlanPrice, isUpgrade } from '../../../lib/plans';
import type { PaidPlan, PlanId } from '../../../lib/types';
import { useStore } from '../../../lib/store';
import { QuotaList } from '../../../components/app/quota';
import { isAdminRole } from '../../../lib/team';
import { Badge, PageHeader } from '../../../components/app/ui';

export default function PlanPage() {
  return <Suspense fallback={null}><Plan /></Suspense>;
}

const STATUS: Record<string, [string, 'success' | 'info' | 'warning' | 'danger' | 'neutral']> = {
  trialing: ['Testphase', 'info'],
  active: ['Aktiv', 'success'],
  past_due: ['Zahlung offen', 'warning'],
  unpaid: ['Unbezahlt', 'danger'],
  canceled: ['Gekündigt', 'neutral'],
  incomplete: ['Zahlung unvollständig', 'warning'],
};

type Interval = 'monthly' | 'yearly';
const NOTICE_KEY = 'vysn-plan-notice';

function Plan() {
  const { data, auth, role, activeCompanyId, switchCompany } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const company = data.company!;
  const billing = company.billing;
  const canManage = isAdminRole(role);
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [yearly, setYearly] = useState(billing?.interval !== 'monthly');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Hinweis nach einem Tarifwechsel übersteht das Neuladen der Firma
  const [notice, setNoticeState] = useState(() => { try { const n = sessionStorage.getItem(NOTICE_KEY) || ''; sessionStorage.removeItem(NOTICE_KEY); return n; } catch { return ''; } });
  const setNotice = (text: string, keep = false) => {
    setNoticeState(text);
    try { if (keep) sessionStorage.setItem(NOTICE_KEY, text); } catch { /* privates Fenster */ }
  };

  useEffect(() => { billingInfo().then(setInfo); }, []);

  // Rückkehr aus Stripe: Status direkt abgleichen und Firma neu laden
  const checkout = params.get('checkout');
  useEffect(() => {
    if (!activeCompanyId || auth.mode !== 'supabase') return;
    if (checkout === 'success') {
      setNotice('Vielen Dank! Ihr Tarif wird freigeschaltet …');
      syncBilling(activeCompanyId)
        .then((r) => setNotice(r.plan && r.plan !== 'start' ? `Tarif ${PLANS[r.plan as PaidPlan].label} ist aktiv. Viel Erfolg!` : 'Die Zahlung wird noch bestätigt – das kann einen Moment dauern.'))
        .catch(() => setNotice('Die Zahlung wird noch bestätigt – das kann einen Moment dauern.'))
        .finally(() => { router.replace('/app/tarif'); switchCompany(activeCompanyId); });
    } else if (checkout === 'cancel') {
      setNotice('Die Buchung wurde abgebrochen. Es wurde nichts berechnet.');
      router.replace('/app/tarif');
    }
  }, [checkout, activeCompanyId, auth.mode, router, switchCompany]);

  const go = async (key: string, fn: () => Promise<Record<string, string>>) => {
    setBusy(key);
    setError('');
    try {
      const r = await fn();
      if (r.url) window.location.href = r.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy('');
    }
  };

  if (auth.mode !== 'supabase') {
    return (
      <div className="page">
        <PageHeader title="Tarif & Abrechnung" />
        <div className="notice notice-warn"><Info size={16} /><span>Tarife lassen sich nur mit einem Konto buchen. Diese Installation läuft im lokalen Modus ohne Anmeldung.</span></div>
      </div>
    );
  }

  const status = billing && billing.status !== 'none' ? STATUS[billing.status] : null;
  // Laufendes Abo: Wechsel direkt (teurer sofort, günstiger zum Laufzeitende)
  const subscribed = !!billing && ['active', 'trialing', 'past_due'].includes(billing.status) && company.plan !== 'start';
  const trialing = billing?.status === 'trialing';
  const curInterval: Interval = billing?.interval || 'yearly';
  const selInterval: Interval = yearly ? 'yearly' : 'monthly';
  const endDate = billing?.periodEnd ? formatDate(billing.periodEnd.slice(0, 10)) : 'Ende der Laufzeit';
  const rhythm = (i: string | null) => (i === 'monthly' ? 'monatlich' : 'jährlich');
  const pendingAt = billing?.pendingAt ? formatDate(billing.pendingAt.slice(0, 10)) : endDate;

  const change = async (plan: PlanId, interval: Interval, question: string) => {
    if (question && !confirm(question)) return;
    setBusy(`change-${plan}`);
    setError('');
    setNotice('');
    try {
      const r: ChangeResult = await changePlan(activeCompanyId!, plan, interval);
      const at = r.at ? formatDate(r.at.slice(0, 10)) : endDate;
      setNotice(
        r.mode === 'now' ? `Tarif ${PLANS[plan].label} (${rhythm(interval)}) ist ab sofort aktiv.${trialing ? ' Ihre kostenlose Testphase läuft weiter.' : ' Für die restliche Laufzeit wird nur die Differenz anteilig berechnet.'}`
          : r.mode === 'unchanged' ? 'Die Vormerkung wurde zurückgenommen. Ihr Tarif läuft unverändert weiter.'
          : plan === 'start' ? `Gekündigt zum ${at}. Bis dahin bleibt ${PLANS[company.plan].label} vollständig nutzbar.`
          : `Wechsel zu ${PLANS[plan].label} (${rhythm(interval)}) zum ${at} vorgemerkt. Bis dahin bleibt ${PLANS[company.plan].label} aktiv – es wird nichts zurückgebucht oder doppelt berechnet.`,
        true,
      );
      await switchCompany(activeCompanyId!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  /** Knopf je Tarifkarte bei laufendem Abo */
  const changeButton = (id: PlanId, name: string, featured?: boolean) => {
    const disabled = !canManage || !!busy || !info?.enabled;
    if (id === 'start') {
      if (billing?.pendingPlan === 'start') return <button className="btn" disabled><CalendarClock size={16} /> Gekündigt zum {pendingAt}</button>;
      return <><button className="btn" disabled={disabled} onClick={() => change('start', curInterval, `Abo zum ${endDate} kündigen? Bis dahin bleibt ${PLANS[company.plan].label} vollständig nutzbar, danach gilt der kostenlose Tarif Start.`)}>Zum Laufzeitende kündigen</button><small className="plan-change-hint">Wirksam zum {endDate}</small></>;
    }
    if (id === company.plan && selInterval === curInterval) {
      return <button className="btn" disabled={!canManage || !!busy || !billing?.hasCustomer} onClick={() => go('portal', () => openPortal(activeCompanyId!))}>Zahlung & Rechnungen</button>;
    }
    if (billing?.pendingPlan === id && billing.pendingInterval === selInterval) {
      return <button className="btn" disabled><CalendarClock size={16} /> Vorgemerkt zum {pendingAt}</button>;
    }
    const up = isUpgrade({ plan: company.plan, interval: curInterval }, { plan: id, interval: selInterval });
    const now = trialing || up;
    const label = id === company.plan ? `Auf ${rhythm(selInterval)} umstellen` : up ? `Jetzt auf ${name} upgraden` : `Zu ${name} wechseln`;
    const question = now
      ? `${id === company.plan ? `Auf ${rhythm(selInterval)}e Zahlung umstellen` : up ? `Auf ${name} (${rhythm(selInterval)}) upgraden` : `Zu ${name} (${rhythm(selInterval)}) wechseln`}? Der Wechsel gilt sofort.${trialing ? ' Ihre kostenlose Testphase läuft weiter.' : ' Für die restliche Laufzeit wird nur die Differenz anteilig berechnet.'}`
      : `${id === company.plan ? `Auf ${rhythm(selInterval)}e Zahlung umstellen` : `Zu ${name} (${rhythm(selInterval)}) wechseln`}? Der Wechsel erfolgt zum ${endDate}. Bis dahin bleibt ${PLANS[company.plan].label} aktiv.`;
    return (
      <>
        <button className={`btn ${up && (featured || id !== company.plan) ? 'btn-primary' : ''}`} disabled={disabled} onClick={() => change(id, selInterval, question)}>
          {up ? <Sparkles size={16} /> : now ? null : <CalendarClock size={16} />} {busy === `change-${id}` ? 'Wird umgestellt …' : label}
        </button>
        <small className="plan-change-hint">{now ? (trialing ? 'Sofort aktiv – in der Testphase kostenlos' : 'Sofort aktiv – Differenz anteilig') : `Wirksam zum ${endDate}`}</small>
      </>
    );
  };
  const trialAvailable = !billing?.trialUsed;

  return (
    <div className="page">
      <PageHeader title="Tarif & Abrechnung" description={`Der Tarif gilt für die Firma „${company.name}“. Jede Firma kann einen eigenen Tarif haben.`}
        actions={billing?.hasCustomer && canManage ? <button className="btn" disabled={!!busy || !info?.enabled} onClick={() => go('portal', () => openPortal(activeCompanyId!))}><CreditCard size={16} /> {busy === 'portal' ? 'Öffne …' : 'Zahlung & Rechnungen verwalten'}</button> : null} />

      {notice ? <div className="notice notice-ok" role="status"><Check size={16} /><span>{notice}</span></div> : null}
      {error ? <div className="notice notice-warn" role="alert"><Info size={16} /><span>{error}</span></div> : null}

      <section className="card">
        <div className="plan-box">
          <div>
            <span className="plan-name">{PLANS[company.plan].label} {status ? <Badge tone={status[1]}>{status[0]}</Badge> : null}</span>
            {billing?.status === 'trialing' && billing.trialEndsAt ? <small>Kostenlose Testphase bis {formatDate(billing.trialEndsAt.slice(0, 10))} – danach beginnt die Abrechnung, jederzeit kündbar.</small> : null}
            {billing?.status === 'active' && billing.periodEnd && !billing.pendingPlan ? <small>{billing.interval ? `${billing.interval === 'yearly' ? 'Jährliche' : 'Monatliche'} Zahlung · ` : ''}Nächste Verlängerung am {formatDate(billing.periodEnd.slice(0, 10))}.</small> : null}
            {subscribed && billing?.pendingPlan ? (
              <div className="plan-pending">
                <CalendarClock size={16} />
                <span>{billing.pendingPlan === 'start'
                  ? <>Gekündigt zum <strong>{pendingAt}</strong> – danach gilt der kostenlose Tarif Start.</>
                  : <>Wechsel zu <strong>{PLANS[billing.pendingPlan].label} ({rhythm(billing.pendingInterval)})</strong> zum <strong>{pendingAt}</strong> vorgemerkt.</>}</span>
                {canManage ? <button className="btn btn-small" disabled={!!busy} onClick={() => change(company.plan, curInterval, '')}><Undo2 size={14} /> Zurücknehmen</button> : null}
              </div>
            ) : null}
            {billing?.status === 'past_due' ? <small className="text-danger">Die letzte Zahlung ist fehlgeschlagen. Bitte Zahlungsmethode aktualisieren.</small> : null}
            <QuotaList />
          </div>
        </div>
        {!canManage ? <p className="muted small mt">Den Tarif können nur Inhaber oder Admins dieser Firma ändern.</p> : null}
        {info && !info.enabled ? <p className="muted small mt"><Info size={13} className="inline-icon" /> Die Online-Buchung wird gerade eingerichtet. Bei Fragen zum Tarif schreiben Sie uns an hallo@vysn.de.</p> : null}
      </section>

      <div className="billing-switch">
        <div className="segmented" role="tablist">
          <button className={!yearly ? 'active' : ''} onClick={() => setYearly(false)}>Monatlich</button>
          <button className={yearly ? 'active' : ''} onClick={() => setYearly(true)}>Jährlich <span className="text-success">–20 %</span></button>
        </div>
        {trialAvailable && !subscribed ? <span className="muted small">{TRIAL_DAYS} Tage kostenlos testen – erst danach wird abgebucht.</span> : null}
      </div>

      <div className="plan-grid">
        {PLAN_OFFERS.map((p) => {
          const current = company.plan === p.id && (!subscribed || selInterval === curInterval);
          const price = yearly ? p.yearly : p.monthly;
          const bookable = p.id !== 'start' && info?.enabled && info.prices[p.id]?.[yearly ? 'yearly' : 'monthly'];
          return (
            <article key={p.id} className={`plan-card${p.featured ? ' featured' : ''}${current ? ' current' : ''}`}>
              {current ? <span className="plan-flag-app">Aktueller Tarif</span> : p.featured ? <span className="plan-flag-app">Empfohlen</span> : null}
              <h3>{p.name}</h3>
              <p className="muted small">{p.text}</p>
              <div className="plan-price-app"><strong>{formatPlanPrice(price)} €</strong><span>{price ? <>/ Monat zzgl. USt.<br />{yearly ? 'jährliche Zahlung' : 'monatlich kündbar'}</> : 'dauerhaft kostenlos'}</span></div>
              <ul>{p.features.map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
              {subscribed ? changeButton(p.id, p.name, p.featured) : p.id === 'start' ? (
                current ? <button className="btn" disabled>Aktiv</button>
                  : billing?.hasCustomer ? <button className="btn" disabled={!canManage || !!busy} onClick={() => go('portal', () => openPortal(activeCompanyId!))}>Im Kundenportal kündigen</button> : null
              ) : current ? (
                <button className="btn" disabled={!canManage || !!busy || !billing?.hasCustomer} onClick={() => go('portal', () => openPortal(activeCompanyId!))}>Abo verwalten</button>
              ) : (
                <button className={`btn ${p.featured ? 'btn-primary' : ''}`} disabled={!canManage || !bookable || !!busy}
                  onClick={() => go(p.id, () => startCheckout(activeCompanyId!, p.id as PaidPlan, yearly ? 'yearly' : 'monthly'))}>
                  <Sparkles size={16} /> {busy === p.id ? 'Weiterleitung …' : company.plan !== 'start' ? `Zu ${p.name} wechseln` : trialAvailable ? `${TRIAL_DAYS} Tage testen` : `${p.name} buchen`}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="muted small"><ExternalLink size={13} className="inline-icon" /> Die Zahlung läuft sicher über Stripe (SEPA-Lastschrift, Karte, Apple/Google Pay). Rechnungen erhalten Sie automatisch per E-Mail.</p>
    </div>
  );
}
