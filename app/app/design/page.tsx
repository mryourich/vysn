'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { addDays, today } from '../../../lib/calc';
import { defaultDesign } from '../../../lib/defaults';
import { useStore } from '../../../lib/store';
import type { InvoiceDesign, SalesDoc } from '../../../lib/types';
import { A4Preview } from '../../../components/app/a4-preview';
import { DocumentTemplate } from '../../../components/pdf/document-template';
import { downloadPdf } from '../../../components/pdf/export';
import { Field, PageHeader, Segmented } from '../../../components/app/ui';

const COLORS = ['#0057d8', '#1f3a5f', '#0f5e56', '#2d2d2d', '#7a2e2e', '#4b3f8f', '#8a5a14', '#2860a8'];

function sampleDoc(kind: 'invoice' | 'offer'): SalesDoc {
  const date = today();
  return {
    id: 'sample', kind, number: kind === 'invoice' ? 'RE-2026-0042' : 'AN-2026-0017', status: 'draft', customerId: '',
    recipient: { name: 'Musterkunde GmbH', contactPerson: 'Frau Erika Beispiel', street: 'Hauptstraße 5', zip: '10115', city: 'Berlin', country: 'Deutschland', vatId: '' },
    subject: 'Umbau Empfangsbereich', date, dueDate: addDays(date, 14), serviceDate: date.split('-').reverse().join('.'), intro: '', outro: '',
    items: [
      { id: '1', description: 'Montagearbeiten Facharbeiter', details: 'Trockenbau und Spachtelarbeiten Q3', quantity: 16, unit: 'Std.', unitPrice: 58, vat: 19, discount: 0 },
      { id: '2', description: 'Gipskartonplatte 12,5 mm', details: '', quantity: 24, unit: 'Platte', unitPrice: 13.5, vat: 19, discount: 0 },
      { id: '3', description: 'Anfahrt und Entsorgung', details: '', quantity: 1, unit: 'Pauschal', unitPrice: 85, vat: 19, discount: 0 },
    ],
    paidDate: '', sourceId: '', stockBooked: false, createdAt: '', sentAt: '', sentTo: '',
  };
}

export default function DesignPage() {
  const { data, saveDesign } = useStore();
  const company = data.company!;
  const d = data.design;
  const set = <K extends keyof InvoiceDesign>(key: K, value: InvoiceDesign[K]) => saveDesign({ ...d, [key]: value });
  const [kind, setKind] = useState<'invoice' | 'offer'>('invoice');
  const doc = useMemo(() => sampleDoc(kind), [kind]);
  const toggle = (key: 'showSenderLine' | 'showPositions' | 'showFooter' | 'showPageNumbers', label: string) => (
    <label className="check"><input type="checkbox" checked={d[key]} onChange={(e) => set(key, e.target.checked)} /><span>{label}</span></label>
  );

  return (
    <div className="page page-wide">
      <PageHeader title="Rechnungsdesign" description="Gestalten Sie Ihre Angebote und Rechnungen. Änderungen gelten sofort für alle PDFs."
        actions={<>
          <button className="btn btn-quiet" onClick={() => confirm('Design auf Standard zurücksetzen?') && saveDesign(defaultDesign())}><RotateCcw size={16} /> Zurücksetzen</button>
          <button className="btn" onClick={() => downloadPdf(<DocumentTemplate company={company} doc={doc} design={d} customerNumber="KD-0001" />, `Musterdokument.pdf`)}><Download size={16} /> Muster-PDF</button>
        </>} />

      <div className="editor design-editor">
        <div className="editor-form">
          <section className="card">
            <div className="card-head"><div><h2>Layout</h2></div></div>
            <div className="layout-options">
              {([['classic', 'Klassisch', 'DIN-Brief, zeitlos'], ['modern', 'Modern', 'Farbiger Kopfbereich'], ['minimal', 'Minimal', 'Viel Weißraum']] as const).map(([v, label, text]) => (
                <button key={v} className={`layout-option${d.layout === v ? ' active' : ''}`} onClick={() => set('layout', v)}>
                  <span className={`layout-thumb thumb-${v}`} style={{ ['--c' as string]: d.accent }}><i /><i /><i /><i /></span>
                  <strong>{label}</strong><small>{text}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Farbe & Schrift</h2></div></div>
            <Field label="Akzentfarbe">
              <div className="swatches">
                {COLORS.map((c) => <button key={c} className={`swatch${d.accent === c ? ' active' : ''}`} style={{ background: c }} onClick={() => set('accent', c)} aria-label={`Farbe ${c}`} />)}
                <label className="swatch swatch-custom" title="Eigene Farbe"><input type="color" value={d.accent} onChange={(e) => set('accent', e.target.value)} />+</label>
              </div>
            </Field>
            <Field label="Schrift">
              <Segmented value={d.font} onChange={(v) => set('font', v)} options={[['Helvetica', 'Sans (Helvetica)'], ['Times-Roman', 'Serif (Times)'], ['Courier', 'Mono']]} />
            </Field>
            <Field label="Tabelle">
              <Segmented value={d.tableStyle} onChange={(v) => set('tableStyle', v)} options={[['lines', 'Linien'], ['striped', 'Zebra'], ['boxed', 'Rahmen']]} />
            </Field>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Logo</h2><p>{company.logo ? 'Aus Ihren Firmendaten' : <>Noch kein Logo hinterlegt – <Link className="link" href="/app/firma">jetzt hochladen</Link></>}</p></div></div>
            <div className="form-grid">
              <Field label="Position"><Segmented value={d.logoPosition} onChange={(v) => set('logoPosition', v)} options={[['left', 'Links'], ['right', 'Rechts']]} /></Field>
              <Field label={`Größe (${d.logoSize} pt)`} span={2}><input type="range" min={24} max={90} value={d.logoSize} onChange={(e) => set('logoSize', Number(e.target.value))} /></Field>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Elemente</h2></div></div>
            <div className="checks">
              {toggle('showSenderLine', 'Absenderzeile über der Anschrift (Fensterumschlag)')}
              {toggle('showPositions', 'Positionsnummern')}
              {toggle('showFooter', 'Fußzeile mit Firmen-, Bank- und Steuerdaten')}
              {toggle('showPageNumbers', 'Seitenzahlen')}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Standardtexte</h2><p>Platzhalter: {'{nummer} {datum} {faellig} {gueltig} {kunde} {betrag}'}</p></div></div>
            <div className="form-grid">
              <Field label="Rechnung – Einleitung" span={3}><textarea rows={2} value={d.invoiceIntro} onChange={(e) => set('invoiceIntro', e.target.value)} /></Field>
              <Field label="Rechnung – Schlusstext" span={3}><textarea rows={3} value={d.invoiceOutro} onChange={(e) => set('invoiceOutro', e.target.value)} /></Field>
              <Field label="Angebot – Einleitung" span={3}><textarea rows={2} value={d.offerIntro} onChange={(e) => set('offerIntro', e.target.value)} /></Field>
              <Field label="Angebot – Schlusstext" span={3}><textarea rows={3} value={d.offerOutro} onChange={(e) => set('offerOutro', e.target.value)} /></Field>
            </div>
          </section>
        </div>

        <div className="editor-preview">
          <div className="preview-head">
            <span>Live-Vorschau</span>
            <Segmented value={kind} onChange={setKind} options={[['invoice', 'Rechnung'], ['offer', 'Angebot']]} />
          </div>
          <A4Preview><DocumentTemplate company={company} doc={doc} design={d} customerNumber="KD-0001" /></A4Preview>
        </div>
      </div>
    </div>
  );
}
