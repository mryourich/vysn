'use client';

import { useState } from 'react';
import { emptyCustomer } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { Customer } from '../../lib/types';
import { Field, Modal } from './ui';

export function CustomerModal({ initial, onClose, onSaved }: { initial?: Customer; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const { saveCustomer } = useStore();
  const [c, setC] = useState<Customer>(initial || emptyCustomer());
  const text = (key: keyof Customer) => ({ value: String(c[key] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [key]: e.target.value }) });
  const valid = c.name.trim().length > 0;
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const saved = await saveCustomer({ ...c, name: c.name.trim() });
      if (!saved) { onClose(); return; }
      onSaved?.(saved);
      onClose();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={initial?.id ? 'Kunde bearbeiten' : 'Neuer Kunde'} onClose={onClose}
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button><button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>Speichern</button></>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Firma bzw. Name *" span={2}><input {...text('name')} autoFocus /></Field>
        <Field label="Kundennummer" hint={c.id ? undefined : 'Leer lassen für automatische Vergabe'}><input {...text('number')} /></Field>
        <Field label="Ansprechpartner" span={2}><input {...text('contactPerson')} /></Field>
        <Field label="USt-IdNr. / UID"><input {...text('vatId')} /></Field>
        <Field label="Straße und Hausnummer" span={3}><input {...text('street')} /></Field>
        <Field label="PLZ"><input {...text('zip')} /></Field>
        <Field label="Ort"><input {...text('city')} /></Field>
        <Field label="Land"><input {...text('country')} /></Field>
        <Field label="E-Mail"><input {...text('email')} type="email" /></Field>
        <Field label="Telefon"><input {...text('phone')} type="tel" /></Field>
        <span className="span-1 hide-sm" />
        <Field label="Notizen" span={3}><textarea {...text('notes')} rows={3} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
