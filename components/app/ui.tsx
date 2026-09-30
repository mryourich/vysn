'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { parseNumber, qty } from '../../lib/calc';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Field({ label, hint, children, span }: { label: string; hint?: string; children: ReactNode; span?: 1 | 2 | 3 }) {
  return (
    <label className={`field${span ? ` span-${span}` : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

const formatNumber = (v: number) => (v === 0 ? '' : qty(v));

/** Number input that accepts German formatting ("1.234,5") and keeps the raw text while typing. */
export function NumberInput({ value, onChange, suffix, min, className, ...rest }: {
  value: number; onChange: (v: number) => void; suffix?: string; min?: number; className?: string; placeholder?: string; 'aria-label'?: string;
}) {
  const [text, setText] = useState(formatNumber(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(formatNumber(value));
  }, [value, focused]);
  return (
    <span className={`num-input${className ? ` ${className}` : ''}`}>
      <input
        {...rest}
        inputMode="decimal"
        value={text}
        placeholder={rest.placeholder ?? '0'}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(formatNumber(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          let v = parseNumber(e.target.value);
          if (min !== undefined && v < min) v = min;
          onChange(v);
        }}
      />
      {suffix ? <span className="num-suffix">{suffix}</span> : null}
    </span>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: 'danger' | 'success' | 'warning' }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub ? <span className="stat-sub">{sub}</span> : null}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'active' : ''} onClick={() => onChange(v)} type="button">{label}</button>
      ))}
    </div>
  );
}

export function useConfirm() {
  return (message: string) => typeof window !== 'undefined' && window.confirm(message);
}
