'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { PLANS, PLAN_OFFERS, formatPlanPrice, nextPlanForLimits, planOf, usageLabel, usageQuota } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { Modal } from './ui';

export function UpgradeDialog() {
  const { data, upgradeNotice, dismissUpgrade } = useStore();
  if (!upgradeNotice) return null;
  const q = usageQuota(data, upgradeNotice);
  const label = usageLabel(upgradeNotice);
  const plan = planOf(data);
  const next = nextPlanForLimits(plan);
  const nextOffer = PLAN_OFFERS.find((p) => p.id === next);
  return (
    <Modal title="Monatslimit erreicht" onClose={dismissUpgrade}
      footer={<>
        <button className="btn btn-quiet" onClick={dismissUpgrade}>Später</button>
        <Link className="btn btn-primary" href="/app/tarif" onClick={dismissUpgrade}><Sparkles size={16} /> Tarif upgraden</Link>
      </>}>
      <div className="upgrade-hero"><Sparkles size={22} /></div>
      <p>Im Tarif <strong>{PLANS[plan].label}</strong> sind <strong>{q.limit} {label.many} pro Monat</strong> enthalten. Im {q.monthLabel} haben Sie bereits {q.used} angelegt – auch gelöschte zählen mit.</p>
      <p className="muted">
        {next === 'solo' && nextOffer
          ? <>Mit <strong>Solo</strong> ab {formatPlanPrice(nextOffer.yearly)} € im Monat sind es je {PLANS.solo.monthlyLimit} pro Monat, mit <strong>Business</strong> unbegrenzt.</>
          : <>Mit <strong>Business</strong> legen Sie unbegrenzt Rechnungen, Angebote, Kunden, Artikel und Buchungen an.</>}
        {' '}Ihre bestehenden Daten können Sie weiterhin bearbeiten. Ab dem 1. des nächsten Monats beginnt das Kontingent neu.
      </p>
    </Modal>
  );
}
