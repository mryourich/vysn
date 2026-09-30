'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Wallet } from 'lucide-react';
import { MONTHS_LONG, currencySymbol, expenseGross, formatDate, money, round2, today } from '../../../lib/calc';
import { formatRate, taxProfile } from '../../../lib/tax';
import { useStore } from '../../../lib/store';
import { EXPENSE_CATEGORIES } from '../../../lib/types';
import type { Expense } from '../../../lib/types';
import { Empty, Field, Modal, NumberInput, PageHeader, Segmented, StatCard, VatSelect } from '../../../components/app/ui';

const blank = (vat: number): Expense => ({ id: '', date: today(), supplier: '', description: '', category: 'Material & Waren', net: 0, vat, receiptNo: '' });

export default function ExpensesPage() {
  const { data } = useStore();
  const [editing, setEditing] = useState<Expense | null>(null);
  const years = useMemo(() => {
    const s = new Set(data.expenses.map((e) => e.date.slice(0, 4)));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [data.expenses]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const small = !!data.company?.smallBusiness;
  const defaultVat = small ? taxProfile(data.company).defaultRate : data.company?.defaultVat ?? taxProfile(data.company).defaultRate;

  const list = data.expenses
    .filter((e) => e.date.startsWith(year))
    .filter((e) => !category || e.category === category)
    .filter((e) => !q || `${e.supplier} ${e.description} ${e.receiptNo}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const groups = new Map<string, Expense[]>();
  for (const e of list) {
    const key = e.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  const yearAll = data.expenses.filter((e) => e.date.startsWith(year));
  const thisMonth = today().slice(0, 7);
  const byCat = new Map<string, number>();
  for (const e of yearAll) byCat.set(e.category, (byCat.get(e.category) || 0) + (small ? expenseGross(e) : e.net));
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="page">
      <PageHeader title="Ausgaben" description="Belege und Kosten erfassen – sie fließen automatisch in GuV und Steuerauswertung ein."
        actions={<button className="btn btn-primary" onClick={() => setEditing(blank(defaultVat))}><Plus size={16} /> Ausgabe erfassen</button>} />

      <div className="stats stats-3">
        <StatCard label={`Ausgaben ${year}`} value={money(yearAll.reduce((s, e) => s + (small ? expenseGross(e) : e.net), 0))} sub={small ? 'brutto' : 'netto'} />
        <StatCard label="Laufender Monat" value={money(data.expenses.filter((e) => e.date.startsWith(thisMonth)).reduce((s, e) => s + (small ? expenseGross(e) : e.net), 0))} sub={MONTHS_LONG[new Date().getMonth()]} />
        <StatCard label="Größter Posten" value={topCat ? money(topCat[1]) : '–'} sub={topCat ? topCat[0] : 'Noch keine Ausgaben'} />
      </div>

      <section className="card">
        {data.expenses.length ? (
          <>
            <div className="toolbar">
              <Segmented value={year} options={years.slice(0, 4).map((y) => [y, y] as [string, string])} onChange={setYear} />
              <select className="select-inline" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Alle Kategorien</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lieferant, Beschreibung…" /></label>
            </div>
            {[...groups.entries()].map(([month, items]) => (
              <div key={month} className="group">
                <div className="group-head"><span>{MONTHS_LONG[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span><span>{money(items.reduce((s, e) => s + (small ? expenseGross(e) : e.net), 0))}</span></div>
                <div className="table">
                  {items.map((e) => (
                    <div key={e.id} className="tr tr-exp" role="button" tabIndex={0} onClick={() => setEditing(e)} onKeyDown={(ev) => ev.key === 'Enter' && setEditing(e)}>
                      <span className="td-main"><span className="avatar avatar-sq"><Wallet size={15} /></span><span><strong>{e.supplier || e.description || 'Ausgabe'}</strong><small>{[e.description !== e.supplier ? e.description : '', formatDate(e.date)].filter(Boolean).join(' · ')}</small></span></span>
                      <span className="td-muted hide-sm">{e.category}</span>
                      <span className="td-num">{money(small ? expenseGross(e) : e.net)}<small className="td-sub">{small ? 'brutto' : `+ ${formatRate(e.vat)} ${taxProfile(data.company).label}`}</small></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!list.length ? <p className="muted pad">Keine Ausgaben für diese Auswahl.</p> : null}
          </>
        ) : (
          <Empty icon={<Wallet />} title="Noch keine Ausgaben" text="Erfassen Sie Einkäufe, Miete, Fahrzeugkosten und andere Belege. So entsteht Ihre GuV ganz nebenbei."
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
  const valid = amount > 0 && (e.supplier.trim() || e.description.trim());
  const submit = () => {
    if (!valid) return;
    saveExpense({ ...e, net });
    onClose();
  };
  return (
    <Modal title={expense.id ? 'Ausgabe bearbeiten' : 'Ausgabe erfassen'} onClose={onClose}
      footer={<>
        {expense.id ? <button className="btn btn-quiet danger mr-auto" onClick={() => { if (confirm('Ausgabe löschen?')) { deleteExpense(expense.id); onClose(); } }}><Trash2 size={16} /> Löschen</button> : null}
        <button className="btn btn-quiet" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" disabled={!valid} onClick={submit}>Speichern</button>
      </>}>
      <form className="form-grid" onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
        <Field label="Lieferant / Empfänger" span={2}><input value={e.supplier} onChange={(ev) => setE({ ...e, supplier: ev.target.value })} autoFocus /></Field>
        <Field label="Datum"><input type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} /></Field>
        <Field label="Beschreibung" span={2}><input value={e.description} onChange={(ev) => setE({ ...e, description: ev.target.value })} /></Field>
        <Field label="Belegnummer"><input value={e.receiptNo} onChange={(ev) => setE({ ...e, receiptNo: ev.target.value })} placeholder="optional" /></Field>
        <Field label="Kategorie" span={3}>
          <select value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
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
