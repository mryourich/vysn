'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check } from 'lucide-react';

/** Preise zentral hier pflegen (Limits der App: lib/plans.ts). Monatspreise netto; bei jährlicher Zahlung gilt der Jahrespreis pro Monat. */
export const PLANS = [
  {
    name: 'Start',
    monthly: 0,
    yearly: 0,
    text: 'Für Gründer und Nebengewerbe, die sauber starten wollen.',
    features: ['Bis zu 10 Rechnungen pro Monat', 'Unbegrenzt Angebote', 'Rechnungen & Angebote als PDF', 'Kunden- und Materialverwaltung', 'Mehrere Firmen unter einem Login'],
    cta: 'Kostenlos starten',
  },
  {
    name: 'Business',
    monthly: 24,
    yearly: 19,
    text: 'Für Betriebe, die ihre Zahlen im Griff haben wollen.',
    features: ['Unbegrenzt Rechnungen & Angebote', 'Eigenes Rechnungsdesign mit Logo', 'Material & Lagerbestand', 'Ausgaben, GuV & Umsatzsteuer', 'CSV- und PDF-Exporte', 'E-Mail-Support'],
    cta: '30 Tage kostenlos testen',
    featured: true,
  },
  {
    name: 'Team',
    monthly: 49,
    yearly: 39,
    text: 'Für Teams mit Büro und mehreren Mitarbeitenden.',
    features: ['Alles aus Business', 'Bis zu 5 Benutzer je Firma', 'Rollen: Inhaber, Admin, Mitarbeiter', 'Persönliches Onboarding', 'Telefon-Support'],
    cta: '30 Tage kostenlos testen',
  },
];

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
