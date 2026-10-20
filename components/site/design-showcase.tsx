'use client';

import { useState } from 'react';
import { defaultDesign, emptyCompany } from '../../lib/defaults';
import type { InvoiceDesign, SalesDoc } from '../../lib/types';
import { A4Preview } from '../app/a4-preview';
import { DocumentTemplate } from '../pdf/document-template';

const company = {
  ...emptyCompany(),
  name: 'Elektro Berger GmbH', owner: 'Jonas Berger', street: 'Linzer Straße 12', zip: '4600', city: 'Wels',
  phone: '+43 7242 123 456', email: 'office@elektro-berger.at', website: 'www.elektro-berger.at',
  taxNumber: '54 123/4567', vatId: 'ATU12345678', registerCourt: 'Landesgericht Wels', registerNumber: 'FN 123456 a',
  bankName: 'Raiffeisenbank Wels', iban: 'AT12 3400 0000 0123 4567', bic: 'RZOOAT2L',
};

const doc: SalesDoc = {
  id: 'demo', kind: 'invoice', number: 'RE-2026-0042', status: 'sent', customerId: '',
  recipient: { name: 'Familie Leitner', contactPerson: 'Markus Leitner', street: 'Am Anger 4', zip: '4614', city: 'Marchtrenk', country: 'Österreich', vatId: '' },
  subject: 'Elektroinstallation Zubau, Baustelle Marchtrenk', date: '2026-09-18', dueDate: '2026-10-02', serviceDate: '01.–15.09.2026', intro: '', outro: '',
  items: [
    { id: '1', description: 'Regiestunden Elektrotechniker', details: 'Leitungen verlegt, Dosen gesetzt, Verteiler bestückt', quantity: 24, unit: 'Std.', unitPrice: 68, vat: 20, discount: 0 },
    { id: '2', description: 'Mantelleitung NYM-J 3x1,5 mm²', details: '', quantity: 180, unit: 'm', unitPrice: 1.2, vat: 20, discount: 0 },
    { id: '3', description: 'FI-Schutzschalter 40 A / 30 mA', details: '', quantity: 1, unit: 'Stück', unitPrice: 89, vat: 20, discount: 0 },
    { id: '4', description: 'Anfahrt und Entsorgung', details: '', quantity: 1, unit: 'Pauschal', unitPrice: 85, vat: 20, discount: 0 },
  ],
  paidDate: '', sourceId: '', stockBooked: false, createdAt: '', sentAt: '', sentTo: '',
};

const COLORS = ['#1f3a5f', '#0f5e56', '#7a2e2e', '#2d2d2d'];

export function DesignShowcase() {
  const [design, setDesign] = useState<InvoiceDesign>({ ...defaultDesign(), showPageNumbers: false });
  return (
    <div className="showcase">
      <div className="showcase-controls">
        <div>
          <span className="control-label">Layout</span>
          <div className="pill-group">
            {([['classic', 'Klassisch'], ['modern', 'Modern'], ['minimal', 'Minimal']] as const).map(([v, l]) => (
              <button key={v} className={design.layout === v ? 'active' : ''} onClick={() => setDesign({ ...design, layout: v })}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="control-label">Farbe</span>
          <div className="pill-group">
            {COLORS.map((c) => (
              <button key={c} className={`dot${design.accent === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setDesign({ ...design, accent: c })} aria-label={`Farbe ${c}`} />
            ))}
          </div>
        </div>
        <div>
          <span className="control-label">Schrift</span>
          <div className="pill-group">
            {([['Helvetica', 'Sans'], ['Times-Roman', 'Serif']] as const).map(([v, l]) => (
              <button key={v} className={design.font === v ? 'active' : ''} onClick={() => setDesign({ ...design, font: v })}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="control-label">Tabelle</span>
          <div className="pill-group">
            {([['lines', 'Linien'], ['striped', 'Zebra'], ['boxed', 'Rahmen']] as const).map(([v, l]) => (
              <button key={v} className={design.tableStyle === v ? 'active' : ''} onClick={() => setDesign({ ...design, tableStyle: v })}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="showcase-paper">
        <A4Preview><DocumentTemplate company={company} doc={doc} design={design} customerNumber="KD-0002" /></A4Preview>
      </div>
    </div>
  );
}
