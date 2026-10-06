'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { PLAN_OFFERS } from '../../lib/plans';

export const PLANS = PLAN_OFFERS;

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <>
      <div className="billing-toggle" role="tablist">
        <button className={!yearly ? 'active' : ''} onClick={() => setYearly(false)} role="tab" aria-selected={!yearly}>Monatlich</button>
        <button className={yearly ? 'active' : ''} onClick={() => setYearly(true)} role="tab" aria-selected={yearly}>Jährlich <span>–20 %</span></button>
      </div>
      <div className="plans">
        {PLANS.map((p) => {
          const price = yearly ? p.yearly : p.monthly;
          return (
            <article key={p.name} className={`plan${p.featured ? ' plan-featured' : ''}`}>
              {p.featured ? <span className="plan-flag">Am häufigsten gewählt</span> : null}
              <h3>{p.name}</h3>
              <p className="plan-text">{p.text}</p>
              <div className="plan-price">
                <strong>{price} €</strong>
                <span>{price ? <>pro Monat zzgl. USt.<br />{yearly ? 'bei jährlicher Zahlung' : 'monatlich kündbar'}</> : <>dauerhaft kostenlos<br />keine Zahlungsdaten nötig</>}</span>
              </div>
              <Link href="/app" className={`btn btn-lg ${p.featured ? 'btn-primary' : ''}`}>{p.cta}</Link>
              <ul>
                {p.features.map((f) => <li key={f}><Check size={16} />{f}</li>)}
              </ul>
            </article>
          );
        })}
      </div>
    </>
  );
}
