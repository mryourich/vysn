'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { emptyCompany } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import { CompanyForm } from './company-form';
import type { CompanySection } from './company-form';
import { Brand } from './brand';

const STEPS: { title: string; text: string; sections: CompanySection[] }[] = [
  { title: 'Ihr Unternehmen', text: 'Diese Angaben erscheinen im Briefkopf Ihrer Angebote und Rechnungen.', sections: ['basics', 'contact'] },
  { title: 'Steuern & Bank', text: 'Pflichtangaben für ordnungsgemäße Rechnungen nach § 14 UStG.', sections: ['tax', 'bank'] },
  { title: 'Logo & Nummern', text: 'Ihr Logo und wie Belege nummeriert werden. Alles später änderbar.', sections: ['logo', 'numbers'] },
];

export function Onboarding() {
  const { saveCompany, loadDemo, auth, creatingCompany, cancelNewCompany, companies } = useStore();
  const canCancel = creatingCompany && companies.length > 0;
  const [company, setCompany] = useState(emptyCompany);
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const canContinue = step > 0 || company.name.trim().length > 1;

  return (
    <div className="onboarding">
      <aside className="onboarding-side">
        <Brand />
        <div>
          <h1>{canCancel ? 'Weitere Firma anlegen.' : 'Willkommen bei VYSN One.'}</h1>
          <p>{canCancel ? 'Jede Firma hat eigene Kunden, Nummernkreise, Material, Zahlen und ein eigenes Rechnungsdesign. Sie wechseln jederzeit unten in der Seitenleiste.' : 'In drei kurzen Schritten richten Sie Ihr Unternehmen ein. Danach erstellen Sie direkt Ihr erstes Angebot oder Ihre erste Rechnung.'}</p>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className={i === step ? 'active' : i < step ? 'done' : ''}>
                <span>{i < step ? <Check size={14} /> : i + 1}</span>{s.title}
              </li>
            ))}
          </ol>
        </div>
        <div className="onboarding-foot">
          <button className="demo-link" onClick={loadDemo}><Sparkles size={15} /> Stattdessen mit Beispieldaten ausprobieren</button>
          {auth.mode === 'supabase' ? <button className="demo-link" onClick={() => auth.signOut()}>Abmelden ({auth.email})</button> : null}
        </div>
      </aside>
      <main className="onboarding-main">
        <div className="onboarding-card">
          <span className="eyebrow-small">Schritt {step + 1} von {STEPS.length}</span>
          <h2>{current.title}</h2>
          <p className="muted">{current.text}</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!canContinue) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else saveCompany({ ...company, name: company.name.trim() });
          }}>
            <CompanyForm value={company} onChange={setCompany} sections={current.sections} />
            <div className="onboarding-actions">
              {step > 0 ? <button type="button" className="btn btn-quiet" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Zurück</button>
                : canCancel ? <button type="button" className="btn btn-quiet" onClick={() => cancelNewCompany()}><X size={16} /> Abbrechen</button> : <span />}
              <button type="submit" className="btn btn-primary" disabled={!canContinue}>
                {step < STEPS.length - 1 ? <>Weiter <ArrowRight size={16} /></> : <>Einrichtung abschließen <Check size={16} /></>}
              </button>
            </div>
          </form>
          <button className="demo-link mobile-only" onClick={loadDemo}><Sparkles size={15} /> Mit Beispieldaten ausprobieren</button>
        </div>
      </main>
    </div>
  );
}
