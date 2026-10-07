'use client';

import Link from 'next/link';
import { Check, Lock, Sparkles } from 'lucide-react';
import { FEATURES, PLANS, PLAN_OFFERS, TRIAL_DAYS, formatPlanPrice, isFeature, nextPlanForLimits, planOf, usageLabel, usageQuota } from '../../lib/plans';
import type { Feature } from '../../lib/plans';
import type { UsageKind } from '../../lib/types';
import { useStore } from '../../lib/store';
import { Modal } from './ui';

/** Popup „Jetzt upgraden“ – fehlende Funktion oder erreichtes Monatslimit. */
export function UpgradeDialog() {
  const { upgradeNotice, dismissUpgrade } = useStore();
  if (!upgradeNotice) return null;
  return isFeature(upgradeNotice) ? <FeatureUpgrade feature={upgradeNotice} onClose={dismissUpgrade} /> : <LimitUpgrade kind={upgradeNotice} onClose={dismissUpgrade} />;
}

function Footer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button className="btn btn-quiet" onClick={onClose}>Später</button>
      <Link className="btn btn-primary" href="/app/tarif" onClick={onClose}><Sparkles size={16} /> Jetzt upgraden</Link>
    </>
  );
}

function FeatureUpgrade({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  const { data } = useStore();
  const f = FEATURES[feature];
  const offer = PLAN_OFFERS.find((p) => p.id === f.plan)!;
  return (
    <Modal title="Jetzt upgraden" onClose={onClose} footer={<Footer onClose={onClose} />}>
      <div className="upgrade-feature">
        <div className="upgrade-hero"><Lock size={22} /></div>
        <div>
          <h3>{f.label}</h3>
          <p>{f.text}</p>
        </div>
      </div>
      <p>Diese Funktion ist ab dem Tarif <strong>{offer.name}</strong> enthalten – ab <strong>{formatPlanPrice(offer.yearly)} €</strong> im Monat zzgl. USt., {TRIAL_DAYS} Tage kostenlos testen.
        {' '}Ihr aktueller Tarif: {PLANS[planOf(data)].label}.</p>
      <ul className="upgrade-list">
        {offer.features.slice(0, 5).map((x) => <li key={x}><Check size={15} />{x}</li>)}
      </ul>
    </Modal>
  );
}

function LimitUpgrade({ kind, onClose }: { kind: UsageKind; onClose: () => void }) {
  const { data } = useStore();
  const q = usageQuota(data, kind);
  const label = usageLabel(kind);
  const plan = planOf(data);
  const next = nextPlanForLimits(plan);
  const nextOffer = PLAN_OFFERS.find((p) => p.id === next);
  return (
    <Modal title="Monatslimit erreicht" onClose={onClose} footer={<Footer onClose={onClose} />}>
      <div className="upgrade-hero"><Sparkles size={22} /></div>
      <p>Im Tarif <strong>{PLANS[plan].label}</strong> sind <strong>{q.limit} {label.many} pro Monat</strong> enthalten. Im {q.monthLabel} haben Sie bereits {q.used} angelegt – auch gelöschte zählen mit.</p>
      <p className="muted">
        {next === 'solo' && nextOffer
          ? <>Mit <strong>Solo</strong> ab {formatPlanPrice(nextOffer.yearly)} € im Monat sind es je {PLANS.solo.monthlyLimit} pro Monat, mit <strong>Business</strong> unbegrenzt.</>
          : <>Mit <strong>Business</strong> legen Sie unbegrenzt Belege, Kunden, Artikel und Buchungen an.</>}
        {' '}Ihre bestehenden Daten können Sie weiterhin bearbeiten. Ab dem 1. des nächsten Monats beginnt das Kontingent neu.
      </p>
    </Modal>
  );
}
