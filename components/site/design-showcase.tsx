'use client';

import { useState } from 'react';
import { defaultDesign, emptyCompany } from '../../lib/defaults';
import type { InvoiceDesign, SalesDoc } from '../../lib/types';
import { A4Preview } from '../app/a4-preview';
import { DocumentTemplate } from '../pdf/document-template';

const company = {
  ...emptyCompany(),
  name: 'Berger Innenausbau GmbH', owner: 'Jonas Berger', street: 'Werkstraße 12', zip: '80339', city: 'München',
  phone: '+49 89 123 456 0', email: 'info@berger-innenausbau.de', website: 'www.berger-innenausbau.de',
  taxNumber: '143/123/45678', vatId: 'DE123456789', bankName: 'Stadtsparkasse München', iban: 'DE89 7015 0000 0012 3456 78', bic: 'SSKMDEMMXXX',
};

const doc: SalesDoc = {
  id: 'demo', kind: 'invoice', number: 'RE-2026-0042', status: 'sent', customerId: '',
  recipient: { name: 'Architekturbüro Weiß & Partner', contactPerson: 'Thomas Weiß', street: 'Sendlinger Str. 21', zip: '80331', city: 'München', country: 'Deutschland', vatId: '' },
  subject: 'Trockenbau Büroräume 2. OG', date: '2026-09-18', dueDate: '2026-10-02', serviceDate: '01.–15.09.2026', intro: '', outro: '',
  items: [
    { id: '1', description: 'Montagearbeiten Facharbeiter', details: 'Ständerwerk, Beplankung und Spachtelung Q3', quantity: 32, unit: 'Std.', unitPrice: 58, vat: 19, discount: 0 },
    { id: '2', description: 'Gipskartonplatte 12,5 mm', details: '', quantity: 48, unit: 'Platte', unitPrice: 13.5, vat: 19, discount: 0 },
    { id: '3', description: 'CW-Profil 50 mm, 3 m', details: '', quantity: 36, unit: 'Stück', unitPrice: 5.9, vat: 19, discount: 0 },
    { id: '4', description: 'Anfahrt und Entsorgung', details: '', quantity: 1, unit: 'Pauschal', unitPrice: 120, vat: 19, discount: 0 },
  ],
  paidDate: '', sourceId: '', stockBooked: false, createdAt: '',
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
