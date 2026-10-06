'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, Info, Sparkles } from 'lucide-react';
import { formatDate } from '../../../lib/calc';
import { billingInfo, openPortal, startCheckout, syncBilling } from '../../../lib/billing';
import type { BillingInfo } from '../../../lib/billing';
import { PLAN_OFFERS, PLANS, TRIAL_DAYS, invoiceQuota } from '../../../lib/plans';
import { useStore } from '../../../lib/store';
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

function Plan() {
  const { data, auth, companies, activeCompanyId, switchCompany } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const company = data.company!;
  const billing = company.billing;
  const role = companies.find((c) => c.id === activeCompanyId)?.role;
  const canManage = role === 'owner' || role === 'admin';
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const quota = invoiceQuota(data);

  useEffect(() => { billingInfo().then(setInfo); }, []);

  // Rückkehr aus Stripe: Status direkt abgleichen und Firma neu laden
  const checkout = params.get('checkout');
  useEffect(() => {
    if (!activeCompanyId || auth.mode !== 'supabase') return;
    if (checkout === 'success') {
      setNotice('Vielen Dank! Ihr Tarif wird freigeschaltet …');
      syncBilling(activeCompanyId)
        .then((r) => setNotice(r.plan && r.plan !== 'start' ? `Tarif ${PLANS[r.plan as 'business' | 'team'].label} ist aktiv. Viel Erfolg!` : 'Die Zahlung wird noch bestätigt – das kann einen Moment dauern.'))
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
            {billing?.status === 'active' && billing.periodEnd ? <small>{billing.cancelAtPeriodEnd ? `Gekündigt – läuft bis ${formatDate(billing.periodEnd.slice(0, 10))}, danach Start.` : `Nächste Verlängerung am ${formatDate(billing.periodEnd.slice(0, 10))}.`}</small> : null}
            {billing?.status === 'past_due' ? <small className="text-danger">Die letzte Zahlung ist fehlgeschlagen. Bitte Zahlungsmethode aktualisieren.</small> : null}
            {quota.limit !== null ? (
              <>
                <div className="quota-bar"><i style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} className={quota.reached ? 'full' : ''} /></div>
                <small>{quota.used} von {quota.limit} Rechnungen im {quota.monthLabel} genutzt</small>
              </>
            ) : <small>Unbegrenzte Rechnungen</small>}
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
        {trialAvailable ? <span className="muted small">{TRIAL_DAYS} Tage kostenlos testen – erst danach wird abgebucht.</span> : null}
      </div>

      <div className="plan-grid">
        {PLAN_OFFERS.map((p) => {
          const current = company.plan === p.id;
          const price = yearly ? p.yearly : p.monthly;
          const bookable = p.id !== 'start' && info?.enabled && info.prices[p.id][yearly ? 'yearly' : 'monthly'];
          return (
            <article key={p.id} className={`plan-card${p.featured ? ' featured' : ''}${current ? ' current' : ''}`}>
              {current ? <span className="plan-flag-app">Aktueller Tarif</span> : p.featured ? <span className="plan-flag-app">Empfohlen</span> : null}
              <h3>{p.name}</h3>
              <p className="muted small">{p.text}</p>
              <div className="plan-price-app"><strong>{price} €</strong><span>{price ? <>/ Monat zzgl. USt.<br />{yearly ? 'jährliche Zahlung' : 'monatlich kündbar'}</> : 'dauerhaft kostenlos'}</span></div>
              <ul>{p.features.map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
              {p.id === 'start' ? (
                current ? <button className="btn" disabled>Aktiv</button>
                  : billing?.hasCustomer ? <button className="btn" disabled={!canManage || !!busy} onClick={() => go('portal', () => openPortal(activeCompanyId!))}>Im Kundenportal kündigen</button> : null
              ) : current ? (
                <button className="btn" disabled={!canManage || !!busy || !billing?.hasCustomer} onClick={() => go('portal', () => openPortal(activeCompanyId!))}>Abo verwalten</button>
              ) : (
                <button className={`btn ${p.featured ? 'btn-primary' : ''}`} disabled={!canManage || !bookable || !!busy}
                  onClick={() => go(p.id, () => startCheckout(activeCompanyId!, p.id as 'business' | 'team', yearly ? 'yearly' : 'monthly'))}>
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
