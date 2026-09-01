'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BarChart3, BriefcaseBusiness, FileText, Users, WalletCards, Workflow } from 'lucide-react';

const modules = [
  { id: 'auftraege', label: 'Aufträge', eyebrow: 'Operations', description: 'Projekte, Fristen und Verantwortliche gemeinsam steuern.', metric: '18 aktive Aufträge', href: '/produkt#auftraege', icon: BriefcaseBusiness },
  { id: 'kunden', label: 'Kunden', eyebrow: 'CRM', description: 'Kontakte, Historie und nächste Schritte an einem Ort.', metric: '360° Kundenbild', href: '/produkt#kunden', icon: Users },
  { id: 'finanzen', label: 'Finanzen', eyebrow: 'Controlling', description: 'Einnahmen, Ausgaben und offene Posten jederzeit überblicken.', metric: '42.850 € Monatsumsatz', href: '/produkt#finanzen', icon: WalletCards },
  { id: 'dokumente', label: 'Dokumente', eyebrow: 'Verwaltung', description: 'Angebote und Rechnungen direkt aus dem Prozess erstellen.', metric: '9 offene Rechnungen', href: '/produkt#dokumente', icon: FileText },
  { id: 'team', label: 'Team', eyebrow: 'Zusammenarbeit', description: 'Rollen, Aufgaben und Freigaben klar organisieren.', metric: 'Eine gemeinsame Sicht', href: '/loesungen#teams', icon: Workflow },
  { id: 'insights', label: 'Insights', eyebrow: 'Berichte', description: 'Kennzahlen verstehen und Entscheidungen schneller treffen.', metric: '+12 % Auftragsvolumen', href: '/produkt#insights', icon: BarChart3 },
];

export function ProductMap() {
  const [activeId, setActiveId] = useState('auftraege');
  const active = modules.find((module) => module.id === activeId) ?? modules[0];
  const ActiveIcon = active.icon;

  return (
    <div className="map-shell">
      <div className="map-canvas" aria-label="Interaktive Übersicht der VYSN Module">
        <div className="map-lines" aria-hidden="true" />
        <div className="map-hub"><span className="map-hub-mark">V</span><strong>VYSN</strong><small>Ein System</small></div>
        {modules.map((module, index) => {
          const Icon = module.icon;
          return (
            <button
              className={`map-node node-${index + 1}${activeId === module.id ? ' active' : ''}`}
              type="button"
              key={module.id}
              onClick={() => setActiveId(module.id)}
              aria-pressed={activeId === module.id}
            >
              <span><Icon size={18} /></span>{module.label}
            </button>
          );
        })}
      </div>
      <aside className="map-detail" aria-live="polite">
        <div className="map-detail-icon"><ActiveIcon /></div>
        <span className="section-kicker">{active.eyebrow}</span>
        <h3>{active.label}</h3>
        <p>{active.description}</p>
        <div className="map-metric"><small>Live im Dashboard</small><strong>{active.metric}</strong></div>
        <Link className="map-link" href={active.href}>Bereich entdecken <ArrowRight size={16} /></Link>
      </aside>
    </div>
  );
}
