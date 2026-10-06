'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Lock, Trash2, Wand2 } from 'lucide-react';
import { LogoBackgroundDialog } from './logo-bg-dialog';
import { readLogo } from '../../lib/image';
import type { Company } from '../../lib/types';
import { COUNTRY_OPTIONS, countryCode, taxProfile } from '../../lib/tax';
import { Field, NumberInput, VatSelect } from './ui';

export type CompanySection = 'basics' | 'contact' | 'tax' | 'bank' | 'logo' | 'numbers';

export function CompanyForm({ value, onChange, sections }: { value: Company; onChange: (c: Company) => void; sections: CompanySection[] }) {
  const set = <K extends keyof Company>(key: K, v: Company[K]) => onChange({ ...value, [key]: v });
  const text = (key: keyof Company) => ({
    value: String(value[key] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value as never),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const tax = taxProfile(value);
  const knownCountry = countryCode(value.country) !== null && COUNTRY_OPTIONS.some(([name]) => name === value.country);
  const [otherCountry, setOtherCountry] = useState(!knownCountry);
  const [logoError, setLogoError] = useState('');
  const [bgOpen, setBgOpen] = useState(false);
  const [bgLocked, setBgLocked] = useState(false);
  const paid = value.plan === 'business' || value.plan === 'team';

  return (
    <div className="form-stack">
      {sections.includes('logo') && (
        <section className="form-section">
          <h3>Logo</h3>
          <div className="logo-upload">
            <div className="logo-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {value.logo ? <img src={value.logo} alt="Firmenlogo" /> : <span>Kein Logo</span>}
            </div>
            <div className="logo-actions">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const { dataUrl, ratio } = await readLogo(file);
                  setLogoError('');
                  onChange({ ...value, logo: dataUrl, logoRatio: ratio });
                } catch (err) {
                  setLogoError((err as Error).message);
                }
              }} />
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}><ImagePlus size={16} /> {value.logo ? 'Logo ersetzen' : 'Logo hochladen'}</button>
              {value.logo ? (
                <button type="button" className="btn" onClick={() => (paid ? setBgOpen(true) : setBgLocked(true))}>
                  {paid ? <Wand2 size={16} /> : <Lock size={16} />} Hintergrund entfernen{paid ? null : <span className="plan-chip">Business</span>}
                </button>
              ) : null}
              {value.logo ? <button type="button" className="btn btn-quiet" onClick={() => onChange({ ...value, logo: '', logoRatio: 1 })}><Trash2 size={16} /> Entfernen</button> : null}
              {bgLocked && !paid ? <p className="field-hint upsell">Das Entfernen des Logo-Hintergrunds ist in den Tarifen Business und Team enthalten. <Link className="link" href="/app/firma#tarif">Tarif ansehen</Link></p> : null}
              <p className="field-hint">PNG, JPG oder SVG. Idealerweise mit transparentem Hintergrund.</p>
              {logoError ? <p className="field-error">{logoError}</p> : null}
            </div>
          </div>
          {bgOpen && value.logo ? <LogoBackgroundDialog logo={value.logo} onClose={() => setBgOpen(false)} onApply={(logo) => onChange({ ...value, logo })} /> : null}
        </section>
      )}

      {sections.includes('basics') && (
        <section className="form-section">
          <h3>Unternehmen</h3>
          <div className="form-grid">
            <Field label="Firmenname inkl. Rechtsform *" span={2}><input {...text('name')} placeholder="z. B. Berger Innenausbau GmbH" autoFocus /></Field>
            <Field label="Inhaber / Geschäftsführung"><input {...text('owner')} placeholder="Vor- und Nachname" /></Field>
            <Field label="Straße und Hausnummer" span={2}><input {...text('street')} /></Field>
            <Field label="PLZ"><input {...text('zip')} inputMode="numeric" /></Field>
            <Field label="Ort" span={2}><input {...text('city')} /></Field>
            <Field label="Land" hint="Bestimmt Steuersätze, Rechnungshinweise und Währung">
              <select value={otherCountry ? 'other' : value.country} onChange={(e) => {
                if (e.target.value === 'other') { setOtherCountry(true); onChange({ ...value, country: '' }); return; }
                setOtherCountry(false);
                const next = { ...value, country: e.target.value };
                onChange({ ...next, defaultVat: taxProfile(next).defaultRate });
              }}>
                {COUNTRY_OPTIONS.map(([name]) => <option key={name} value={name}>{name}</option>)}
                <option value="other">Anderes Land …</option>
              </select>
            </Field>
            {otherCountry ? <Field label="Land (Name)" span={2}><input {...text('country')} placeholder="z. B. Liechtenstein" /></Field> : null}
          </div>
        </section>
      )}

      {sections.includes('contact') && (
        <section className="form-section">
          <h3>Kontakt</h3>
          <div className="form-grid">
            <Field label="E-Mail"><input {...text('email')} type="email" /></Field>
            <Field label="Telefon"><input {...text('phone')} type="tel" /></Field>
            <Field label="Website"><input {...text('website')} /></Field>
          </div>
        </section>
      )}

      {sections.includes('tax') && (
        <section className="form-section">
          <h3>Steuern & Register</h3>
          <p className="field-hint form-hint">{tax.legalHint}</p>
          <div className="form-grid">
            <Field label={tax.taxNumberLabel}><input {...text('taxNumber')} /></Field>
            <Field label={tax.idLabel}><input {...text('vatId')} placeholder={tax.idPlaceholder} /></Field>
            <Field label={`Standard-${tax.longLabel}`} hint="Voreinstellung für neue Positionen">
              <VatSelect value={value.defaultVat} onChange={(v) => set('defaultVat', v)} company={value} disabled={value.smallBusiness} />
            </Field>
            <Field label="Registergericht"><input {...text('registerCourt')} placeholder="optional" /></Field>
            <Field label="Registernummer"><input {...text('registerNumber')} placeholder="optional" /></Field>
            <label className="check span-3">
              <input type="checkbox" checked={value.smallBusiness} onChange={(e) => set('smallBusiness', e.target.checked)} />
              <span><strong>{tax.smallBusinessLabel}</strong><br />{tax.smallBusinessHint}</span>
            </label>
          </div>
        </section>
      )}

      {sections.includes('bank') && (
        <section className="form-section">
          <h3>Bankverbindung</h3>
          <div className="form-grid">
            <Field label="Bank"><input {...text('bankName')} /></Field>
            <Field label="IBAN"><input {...text('iban')} /></Field>
            <Field label="BIC"><input {...text('bic')} /></Field>
          </div>
        </section>
      )}

      {sections.includes('numbers') && (
        <section className="form-section">
          <h3>Nummernkreise & Fristen</h3>
          <div className="form-grid">
            <Field label="Präfix Rechnungen" hint={`Beispiel: ${value.invoicePrefix || 'RE'}-${new Date().getFullYear()}-0001`}><input {...text('invoicePrefix')} /></Field>
            <Field label="Präfix Angebote" hint={`Beispiel: ${value.offerPrefix || 'AN'}-${new Date().getFullYear()}-0001`}><input {...text('offerPrefix')} /></Field>
            <Field label="Zahlungsziel"><NumberInput value={value.paymentTermDays} onChange={(v) => set('paymentTermDays', Math.round(v))} suffix="Tage" min={0} /></Field>
            <Field label="Angebote gültig"><NumberInput value={value.offerValidityDays} onChange={(v) => set('offerValidityDays', Math.round(v))} suffix="Tage" min={0} /></Field>
          </div>
        </section>
      )}
    </div>
  );
}
