'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowDownLeft, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { MONTHS_LONG, currencySymbol, expenseGross, formatDate, money, round2, today } from '../../../lib/calc';
import { formatRate, taxProfile } from '../../../lib/tax';
import { useStore } from '../../../lib/store';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../lib/types';
import type { Expense } from '../../../lib/types';
import { Empty, Field, Modal, NumberInput, PageHeader, Segmented, StatCard, VatSelect, useCreateAction } from '../../../components/app/ui';
import { QuotaBar } from '../../../components/app/quota';

const blank = (vat: number, kind: Expense['kind'] = 'expense'): Expense => ({
  id: '', kind, date: today(), supplier: '', description: '', category: kind === 'income' ? 'Barverkauf' : 'Material & Waren', net: 0, vat, receiptNo: '',
});

type Filter = 'all' | 'expense' | 'income';

export default function ExpensesPage() {
  return <Suspense fallback={null}><Expenses /></Suspense>;
}

function Expenses() {
  const { data } = useStore();
  const [editing, setEditing] = useState<Expense | null>(null);
  const years = useMemo(() => {
    const s = new Set(data.expenses.map((e) => e.date.slice(0, 4)));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [data.expenses]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  // Menü „Buchführung“: ?art=einnahmen bzw. ?art=ausgaben
  const art = useSearchParams()?.get('art');
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => { setFilter(art === 'einnahmen' ? 'income' : art === 'ausgaben' ? 'expense' : 'all'); setCategory(''); }, [art]);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const small = !!data.company?.smallBusiness;
  const tax = taxProfile(data.company);
  const defaultVat = small ? tax.defaultRate : data.company?.defaultVat ?? tax.defaultRate;
  useCreateAction((v) => setEditing(blank(defaultVat, v === 'einnahme' ? 'income' : 'expense')));
  const amountOf = (e: Expense) => (small ? expenseGross(e) : e.net);
  const signed = (e: Expense) => (e.kind === 'income' ? amountOf(e) : -amountOf(e));

  const list = data.expenses
    .filter((e) => e.date.startsWith(year))
    .filter((e) => filter === 'all' || e.kind === filter)
    .filter((e) => !category || e.category === category)
    .filter((e) => !q || `${e.supplier} ${e.description} ${e.receiptNo}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const groups = new Map<string, Expense[]>();
  for (const e of list) {
    const key = e.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  const yearAll = data.expenses.filter((e) => e.date.startsWith(year));
  const sumOf = (kind: Expense['kind']) => yearAll.filter((e) => e.kind === kind).reduce((s, e) => s + amountOf(e), 0);
  const categories = filter === 'income' ? INCOME_CATEGORIES : filter === 'expense' ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  return (
    <div className="page">
      <PageHeader title="Einnahmen & Ausgaben" description="Belege, Kosten und Einnahmen ohne Rechnung erfassen – alles fließt automatisch in GuV, Steuer und DATEV-Export."
        actions={<>
          <button className="btn" onClick={() => setEditing(blank(defaultVat, 'income'))}><ArrowDownLeft size={16} /> Einnahme</button>
          <button className="btn btn-primary" onClick={() => setEditing(blank(defaultVat))}><Plus size={16} /> Ausgabe erfassen</button>
        </>} />
      <QuotaBar kind="booking" />

      <div className="stats stats-3">
        <StatCard label={`Ausgaben ${year}`} value={money(sumOf('expense'))} sub={small ? 'brutto' : 'netto'} />
        <StatCard label={`Einnahmen ohne Rechnung ${year}`} value={money(sumOf('income'))} tone={sumOf('income') ? 'success' : undefined} sub="z. B. Barverkauf, Zinsen, Zuschüsse" />
        <StatCard label="Laufender Monat" value={money(data.expenses.filter((e) => e.date.startsWith(today().slice(0, 7))).reduce((s, e) => s + signed(e), 0))}
          sub={`Saldo ${MONTHS_LONG[new Date().getMonth()]} (Einnahmen – Ausgaben)`} />
      </div>

      <section className="card">
        {data.expenses.length ? (
          <>
            <div className="toolbar">
              <Segmented value={filter} options={[['all', 'Alle'], ['expense', 'Ausgaben'], ['income', 'Einnahmen']]} onChange={(f) => { setFilter(f); setCategory(''); window.history.replaceState(window.history.state, '', f === 'all' ? '/app/ausgaben' : `/app/ausgaben?art=${f === 'income' ? 'einnahmen' : 'ausgaben'}`); }} />
              <Segmented value={year} options={years.slice(0, 4).map((y) => [y, y] as [string, string])} onChange={setYear} />
              <select className="select-inline" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Alle Kategorien</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lieferant, Beschreibung…" /></label>
            </div>
            {[...groups.entries()].map(([month, items]) => {
              const saldo = items.reduce((s, e) => s + signed(e), 0);
              return (
                <div key={month} className="group">
                  <div className="group-head"><span>{MONTHS_LONG[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span><span className={saldo >= 0 ? 'text-success' : ''}>{saldo >= 0 ? '+ ' : '– '}{money(Math.abs(saldo))}</span></div>
                  <div className="table">
                    {items.map((e) => (
                      <div key={e.id} className="tr tr-exp" role="button" tabIndex={0} onClick={() => setEditing(e)} onKeyDown={(ev) => ev.key === 'Enter' && setEditing(e)}>
                        <span className="td-main">
                          <span className={`avatar avatar-sq${e.kind === 'income' ? ' avatar-income' : ''}`}>{e.kind === 'income' ? <ArrowDownLeft size={15} /> : <Wallet size={15} />}</span>
                          <span><strong>{e.supplier || e.description || (e.kind === 'income' ? 'Einnahme' : 'Ausgabe')}</strong><small>{[e.description !== e.supplier ? e.description : '', formatDate(e.date)].filter(Boolean).join(' · ')}</small></span>
                        </span>
                        <span className="td-muted hide-sm">{e.category}</span>
                        <span className={`td-num${e.kind === 'income' ? ' text-success' : ''}`}>{e.kind === 'income' ? '+ ' : ''}{money(amountOf(e))}<small className="td-sub">{small ? 'brutto' : `${e.kind === 'income' ? 'zzgl.' : '+'} ${formatRate(e.vat)} ${tax.label}`}</small></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!list.length ? <p className="muted pad">Keine Einträge für diese Auswahl.</p> : null}
          </>
        ) : (
          <Empty icon={<Wallet />} title="Noch keine Einträge" text="Erfassen Sie Einkäufe, Miete, Fahrzeugkosten und andere Belege – und Einnahmen ohne Rechnung wie Barverkäufe. So entsteht Ihre GuV ganz nebenbei."
            action={<button className="btn btn-primary" onClick={() => setEditing(blank(defaultVat))}><Plus size={16} /> Erste Ausgabe erfassen</button>} />
        )}
      </section>
      {editing ? <ExpenseModal expense={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { saveExpense, deleteExpense, data } = useStore();
  const company = data.company;
  const tax = taxProfile(company);
  const [e, setE] = useState(expense);
  const [mode, setMode] = useState<'gross' | 'net'>('gross');
  const [amount, setAmount] = useState(expense.id ? expenseGross(expense) : 0);
  const net = mode === 'gross' ? round2(amount / (1 + e.vat / 100)) : amount;
  const income = e.kind === 'income';
  const noun = income ? 'Einnahme' : 'Ausgabe';
  const valid = amount > 0 && (e.supplier.trim() || e.description.trim());
  const submit = () => {
    if (!valid) return;
    saveExpense({ ...e, net });
    onClose();
  };
  return (
    <Modal title={expense.id ? `${noun} bearbeiten` : `${noun} erfassen`} onClose={onClose}
      footer={<>
        {expense.id ? <button className="btn btn-quiet danger mr-auto" onClick={() => { if (confirm(`${noun} löschen?`)) { deleteExpense(expense.id); onClose(); } }}><Trash2 size={16} /> Löschen</button> : null}
        <button className="btn btn-quiet" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" disabled={!valid} onClick={submit}>Speichern</button>
      </>}>
      <Segmented value={e.kind} options={[['expense', 'Ausgabe'], ['income', 'Einnahme']]}
        onChange={(kind) => setE({ ...e, kind, category: kind === 'income' ? INCOME_CATEGORIES[1] : EXPENSE_CATEGORIES[0] })} />
      <form className="form-grid" onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
        <Field label={income ? 'Zahler / Herkunft' : 'Lieferant / Empfänger'} span={2}><input value={e.supplier} onChange={(ev) => setE({ ...e, supplier: ev.target.value })} autoFocus /></Field>
        <Field label="Datum"><input type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} /></Field>
        <Field label="Beschreibung" span={2}><input value={e.description} onChange={(ev) => setE({ ...e, description: ev.target.value })} /></Field>
        <Field label="Belegnummer"><input value={e.receiptNo} onChange={(ev) => setE({ ...e, receiptNo: ev.target.value })} placeholder="optional" /></Field>
        <Field label="Kategorie" span={3}>
          <select value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>{(income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Betrag"><NumberInput value={amount} onChange={setAmount} suffix={currencySymbol()} min={0} /></Field>
        <Field label="Betrag ist"><Segmented value={mode} options={[['gross', 'Brutto'], ['net', 'Netto']]} onChange={setMode} /></Field>
        <Field label={tax.longLabel}>
          <VatSelect value={e.vat} onChange={(v) => setE({ ...e, vat: v })} company={company} />
        </Field>
        <div className="calc-line span-3">
          <span>Netto <b>{money(net)}</b></span><span>{tax.label} <b>{money(round2((net * e.vat) / 100))}</b></span><span>Brutto <b>{money(round2(net * (1 + e.vat / 100)))}</b></span>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
