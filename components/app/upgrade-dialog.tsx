'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { invoiceQuota } from '../../lib/plans';
import { useStore } from '../../lib/store';
import { Modal } from './ui';

export function UpgradeDialog() {
  const { data, upgradeNotice, dismissUpgrade, auth } = useStore();
  if (!upgradeNotice) return null;
  const q = invoiceQuota(data);
  return (
    <Modal title="Rechnungslimit erreicht" onClose={dismissUpgrade}
      footer={<>
        <button className="btn btn-quiet" onClick={dismissUpgrade}>Später</button>
        {auth.mode === 'local'
          ? <Link className="btn btn-primary" href="/app/firma#tarif" onClick={dismissUpgrade}><Sparkles size={16} /> Tarif wechseln</Link>
          : <Link className="btn btn-primary" href="/#preise" onClick={dismissUpgrade}><Sparkles size={16} /> Auf Business upgraden</Link>}
      </>}>
      <div className="upgrade-hero"><Sparkles size={22} /></div>
      <p>Im Tarif <strong>Start</strong> sind <strong>{q.limit} Rechnungen pro Monat</strong> enthalten. Für {q.monthLabel} haben Sie bereits {q.used} Rechnungen erstellt.</p>
      <p className="muted">Mit <strong>Business</strong> schreiben Sie unbegrenzt Rechnungen. Angebote, Kunden, Material und Ausgaben können Sie weiterhin uneingeschränkt nutzen.</p>
    </Modal>
  );
}
