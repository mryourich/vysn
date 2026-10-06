'use client';

import Link from 'next/link';
import { PLANS, PLAN_OFFERS, formatPlanPrice, planOf, usageLabel, usageQuota } from '../../lib/plans';
import { useStore } from '../../lib/store';
import type { UsageKind } from '../../lib/types';

const pct = (used: number, limit: number) => `${Math.min(100, (used / limit) * 100)}%`;

/** Kontingent-Leiste einer Art („3 von 10 Rechnungen im Oktober“) – nur in begrenzten Tarifen. */
export function QuotaBar({ kind }: { kind: UsageKind }) {
  const { data } = useStore();
  const q = usageQuota(data, kind);
  if (q.limit === null) return null;
  const plan = planOf(data);
  const solo = PLAN_OFFERS.find((p) => p.id === 'solo')!;
  return (
    <div className={`quota${q.reached ? ' quota-full' : ''}`}>
      <span>Tarif {PLANS[plan].label}: <strong>{q.used} von {q.limit}</strong> {usageLabel(kind).many} im {q.monthLabel}</span>
      <div className="quota-bar"><i style={{ width: pct(q.used, q.limit) }} className={q.reached ? 'full' : ''} /></div>
      <Link href="/app/tarif" className="link">{plan === 'start' ? `Mehr ab ${formatPlanPrice(solo.yearly)} €` : 'Unbegrenzt mit Business'}</Link>
    </div>
  );
}

/** Übersicht aller Kontingente (Tarif-Seite). */
export function QuotaList() {
  const { data } = useStore();
  const limit = PLANS[planOf(data)].monthlyLimit;
  if (limit === null) return <small>Unbegrenzt Rechnungen, Angebote, Kunden, Artikel und Buchungen</small>;
  return (
    <div className="quota-list">
      {(['invoice', 'offer', 'customer', 'material', 'booking'] as UsageKind[]).map((kind) => {
        const q = usageQuota(data, kind);
        return (
          <div key={kind} className={`quota-row${q.reached ? ' full' : ''}`}>
            <span>{usageLabel(kind).many}</span>
            <div className="quota-bar"><i style={{ width: pct(q.used, q.limit!) }} className={q.reached ? 'full' : ''} /></div>
            <small>{q.used} / {q.limit}</small>
          </div>
        );
      })}
      <small>Im {usageQuota(data, 'invoice').monthLabel} angelegt – gelöschte Einträge zählen mit. Das Kontingent beginnt jeden Monat neu.</small>
    </div>
  );
}
