'use client';

import { DOC_KINDS, docTexts } from '../../lib/docs';
import { useStore } from '../../lib/store';
import type { DocKind, InvoiceDesign } from '../../lib/types';
import { DOC_KIND_LIST } from '../../lib/types';
import { Field } from './ui';

/** Auswahl der Belegart (Vorschau, Standardtexte, E-Mail-Vorlagen). */
export function DocKindSelect({ value, onChange }: { value: DocKind; onChange: (k: DocKind) => void }) {
  return (
    <select className="kind-select" value={value} onChange={(e) => onChange(e.target.value as DocKind)} aria-label="Belegart">
      {DOC_KIND_LIST.map((k) => <option key={k} value={k}>{DOC_KINDS[k].one}</option>)}
    </select>
  );
}

/** Einleitung und Schlusstext einer Belegart bearbeiten. */
export function DocTextsFields({ kind }: { kind: DocKind }) {
  const { data, saveDesign } = useStore();
  const d = data.design;
  const texts = docTexts(d, kind);
  const set = (patch: { intro?: string; outro?: string }) => {
    let next: InvoiceDesign;
    if (kind === 'invoice') next = { ...d, invoiceIntro: patch.intro ?? d.invoiceIntro, invoiceOutro: patch.outro ?? d.invoiceOutro };
    else if (kind === 'offer') next = { ...d, offerIntro: patch.intro ?? d.offerIntro, offerOutro: patch.outro ?? d.offerOutro };
    else next = { ...d, texts: { ...d.texts, [kind]: { ...texts, ...patch } } };
    saveDesign(next);
  };
  return (
    <div className="form-grid">
      <Field label={`${DOC_KINDS[kind].one} – Einleitung`} span={3}><textarea rows={2} value={texts.intro} onChange={(e) => set({ intro: e.target.value })} /></Field>
      <Field label={`${DOC_KINDS[kind].one} – Schlusstext`} span={3}><textarea rows={3} value={texts.outro} onChange={(e) => set({ outro: e.target.value })} /></Field>
    </div>
  );
}
