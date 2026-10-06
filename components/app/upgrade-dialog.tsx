'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { PLANS, PLAN_OFFERS, formatPlanPrice, invoiceQuota, nextPlanForInvoices, planOf } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { Modal } from './ui';

export function UpgradeDialog() {
  const { data, upgradeNotice, dismissUpgrade } = useStore();
  if (!upgradeNotice) return null;
  const q = invoiceQuota(data);
  const plan = planOf(data);
  const next = nextPlanForInvoices(plan);
  const nextOffer = PLAN_OFFERS.find((p) => p.id === next);
  return (
    <Modal title="Rechnungslimit erreicht" onClose={dismissUpgrade}
      footer={<>
        <button className="btn btn-quiet" onClick={dismissUpgrade}>Später</button>
        <Link className="btn btn-primary" href="/app/tarif" onClick={dismissUpgrade}><Sparkles size={16} /> Tarif upgraden</Link>
      </>}>
      <div className="upgrade-hero"><Sparkles size={22} /></div>
      <p>Im Tarif <strong>{PLANS[plan].label}</strong> sind <strong>{q.limit} Rechnungen pro Monat</strong> enthalten. Für {q.monthLabel} haben Sie bereits {q.used} Rechnungen erstellt.</p>
      <p className="muted">
        {next === 'solo' && nextOffer
          ? <>Mit <strong>Solo</strong> ab {formatPlanPrice(nextOffer.yearly)} € im Monat schreiben Sie bis zu {PLANS.solo.invoicesPerMonth} Rechnungen, mit <strong>Business</strong> unbegrenzt.</>
          : <>Mit <strong>Business</strong> schreiben Sie unbegrenzt Rechnungen.</>}
        {' '}Angebote, Kunden, Material und Ausgaben können Sie weiterhin uneingeschränkt nutzen.
      </p>
    </Modal>
  );
}
