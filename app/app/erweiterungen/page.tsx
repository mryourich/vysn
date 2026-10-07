'use client';

import Link from 'next/link';
import { Code2, CreditCard, FileCode2, FileSpreadsheet, Lock, Mail, ScanLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Feature } from '../../../lib/plans';
import { useStore } from '../../../lib/store';
import { Badge, PageHeader } from '../../../components/app/ui';

type Extension = { name: string; by: string; text: string; icon: LucideIcon; color: string } & (
  | { status: 'ready'; href: string; feature?: Feature; action: string }
  | { status: 'planned' }
);

const EXTENSIONS: Extension[] = [
  { name: 'DATEV-Export', by: 'Buchhaltung', icon: FileSpreadsheet, color: '#2b8a3e', status: 'ready', href: '/app/export', feature: 'datev', action: 'Exportieren',
    text: 'Rechnungen, Einnahmen und Ausgaben als DATEV-Buchungsstapel (CSV) für Ihre Steuerberatung.' },
  { name: 'E-Mail-Versand', by: 'Versand', icon: Mail, color: '#0057d8', status: 'ready', href: '/app/einstellungen?bereich=email', feature: 'email', action: 'Einrichten',
    text: 'Belege direkt aus VYSN One mit PDF-Anhang versenden – über Ihren eigenen Mailserver (SMTP).' },
  { name: 'Lager-Scanner', by: 'Material & Lager', icon: ScanLine, color: '#7048e8', status: 'ready', href: '/app/scan', feature: 'scanner', action: 'Öffnen',
    text: 'QR-Etiketten für Regale drucken und mit der Handykamera ein- und auslagern.' },
  { name: 'E-Rechnung', by: 'XRechnung & ZUGFeRD', icon: FileCode2, color: '#1f3a5f', status: 'planned',
    text: 'Rechnungen zusätzlich als strukturierte E-Rechnung für Behörden und Geschäftskunden ausgeben.' },
  { name: 'Online-Zahlung', by: 'Zahlungslinks', icon: CreditCard, color: '#e8590c', status: 'planned',
    text: 'Bezahl-Link auf Rechnung und E-Mail – Kunden zahlen per Karte, PayPal oder Lastschrift, der Status aktualisiert sich selbst.' },
  { name: 'API & Webhooks', by: 'Für Entwickler', icon: Code2, color: '#495057', status: 'planned',
    text: 'Kunden, Artikel und Belege aus Ihrem Shop oder anderen Programmen automatisch übernehmen.' },
];

export default function ExtensionsPage() {
  const { can, requireFeature } = useStore();
  return (
    <div className="page">
      <PageHeader title="Erweiterungen" description="Verbinden Sie VYSN One mit Ihrer Buchhaltung und Ihren Abläufen." />
      <div className="ext-grid">
        {EXTENSIONS.map((x) => {
          const locked = x.status === 'ready' && x.feature && !can(x.feature) ? x.feature : null;
          return (
            <article key={x.name} className="ext-card">
              <div className="ext-top">
                <span className="ext-logo" style={{ background: x.color }}><x.icon size={22} /></span>
                <div><strong>{x.name}</strong><small>{x.by}</small></div>
                {x.status === 'ready' ? <Badge tone="success">Verfügbar</Badge> : <Badge>Geplant</Badge>}
              </div>
              <p>{x.text}</p>
              <div className="ext-actions">
                {x.status === 'ready' ? (
                  <Link className={`btn${locked ? '' : ' btn-primary'}`} href={x.href} onClick={(e) => { if (locked) { e.preventDefault(); requireFeature(locked); } }}>
                    {locked ? <Lock size={14} /> : null} {locked ? 'Ab Business' : x.action}
                  </Link>
                ) : (
                  <a className="btn" href={`mailto:hallo@vysn.de?subject=${encodeURIComponent(`Interesse: ${x.name}`)}`}>Interesse melden</a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
