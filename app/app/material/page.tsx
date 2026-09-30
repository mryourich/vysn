'use client';

import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { formatDate, money, qty, round2, today, uid } from '../../../lib/calc';
import { UNITS, emptyMaterial } from '../../../lib/defaults';
import { useStore } from '../../../lib/store';
import type { Material } from '../../../lib/types';
import { currencySymbol } from '../../../lib/calc';
import { taxProfile } from '../../../lib/tax';
import { Badge, Empty, Field, Modal, NumberInput, PageHeader, Segmented, StatCard, VatSelect } from '../../../components/app/ui';

export default function MaterialPage() {
  const { data, deleteMaterial } = useStore();
  const [editing, setEditing] = useState<Material | null>(null);
  const [booking, setBooking] = useState<Material | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>('all');

  const low = (m: Material) => m.minStock > 0 && m.stock <= m.minStock;
  const list = data.materials
    .filter((m) => filter === 'all' || low(m))
    .filter((m) => !q || `${m.name} ${m.number} ${m.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const stockValue = data.materials.reduce((s, m) => s + Math.max(0, m.stock) * m.purchasePrice, 0);
  const vat = data.company?.smallBusiness ? 0 : data.company?.defaultVat ?? 19;

  return (
    <div className="page">
      <PageHeader title="Material & Lager" description="Artikel, Leistungen, Preise und Lagerbestände. Rechnungen buchen verbrauchtes Material automatisch ab."
        actions={<button className="btn btn-primary" onClick={() => setEditing(emptyMaterial(vat))}><Plus size={16} /> Neuer Artikel</button>} />

      <div className="stats stats-3">
        <StatCard label="Artikel" value={String(data.materials.length)} sub={`${new Set(data.materials.map((m) => m.category).filter(Boolean)).size} Kategorien`} />
        <StatCard label="Lagerwert (EK)" value={money(stockValue)} sub="zu Einkaufspreisen" />
        <StatCard label="Nachbestellen" value={String(data.materials.filter(low).length)} tone={data.materials.some(low) ? 'warning' : undefined} sub="unter Mindestbestand" />
      </div>

      <section className="card">
        {data.materials.length ? (
          <>
            <div className="toolbar">
              <Segmented value={filter} options={[['all', 'Alle'], ['low', 'Nachbestellen']]} onChange={setFilter} />
              <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artikel suchen…" /></label>
            </div>
            <div className="table">
              <div className="tr th tr-mat"><span>Artikel</span><span className="td-num">Bestand</span><span className="td-num hide-sm">EK</span><span className="td-num hide-sm">VK</span><span className="td-num hide-sm">Aufschlag</span><span /></div>
              {list.map((m) => (
                <div key={m.id} className="tr tr-mat" onClick={() => setEditing(m)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEditing(m)}>
                  <span className="td-main"><span className="avatar avatar-sq"><Boxes size={15} /></span><span><strong>{m.name}</strong><small>{m.number}{m.category ? ` · ${m.category}` : ''}</small></span></span>
                  <span className="td-num">
                    {qty(m.stock)} {m.unit}
                    {low(m) ? <><br /><Badge tone="warning">Min. {qty(m.minStock)}</Badge></> : null}
                  </span>
                  <span className="td-num td-muted hide-sm">{money(m.purchasePrice)}</span>
                  <span className="td-num hide-sm">{money(m.salePrice)}</span>
                  <span className="td-num td-muted hide-sm">{m.purchasePrice ? `${Math.round(((m.salePrice - m.purchasePrice) / m.purchasePrice) * 100)} %` : '–'}</span>
                  <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-small" onClick={() => setBooking(m)}>Buchen</button>
                    <button className="icon-btn hide-sm" title="Bearbeiten" onClick={() => setEditing(m)}><Pencil size={16} /></button>
                    <button className="icon-btn danger hide-sm" title="Löschen" onClick={() => confirm(`${m.name} löschen?`) && deleteMaterial(m.id)}><Trash2 size={16} /></button>
                  </span>
                </div>
              ))}
              {!list.length ? <p className="muted pad">Keine Treffer.</p> : null}
            </div>
          </>
        ) : (
          <Empty icon={<Boxes />} title="Noch kein Material" text="Legen Sie Artikel und Leistungen mit Einkaufs- und Verkaufspreis an. Sie stehen dann in Angeboten und Rechnungen zur Auswahl."
            action={<button className="btn btn-primary" onClick={() => setEditing(emptyMaterial(vat))}><Plus size={16} /> Artikel anlegen</button>} />
        )}
      </section>

      {editing ? <MaterialModal material={editing} onClose={() => setEditing(null)} /> : null}
      {booking ? <BookingModal material={booking} onClose={() => setBooking(null)} /> : null}
    </div>
  );
}

function MaterialModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { saveMaterial, data } = useStore();
  const [m, setM] = useState(material);
  const [markup, setMarkup] = useState(material.purchasePrice ? Math.round(((material.salePrice - material.purchasePrice) / material.purchasePrice) * 100) : 0);
  const isNew = !material.id;
  const categories = [...new Set(data.materials.map((x) => x.category).filter(Boolean))];
  const submit = async () => {
    if (!m.name.trim()) return;
    try {
      await saveMaterial({ ...m, name: m.name.trim() });
      onClose();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <Modal title={isNew ? 'Neuer Artikel' : m.name} onClose={onClose} wide
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button><button className="btn btn-primary" disabled={!m.name.trim()} onClick={submit}>Speichern</button></>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Bezeichnung *" span={2}><input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} autoFocus /></Field>
        <Field label="Artikelnummer" hint={isNew ? 'Leer = automatisch' : undefined}><input value={m.number} onChange={(e) => setM({ ...m, number: e.target.value })} /></Field>
        <Field label="Kategorie">
          <input list="mat-categories" value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })} />
          <datalist id="mat-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Einheit">
          <select value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })}>{[...new Set([m.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
        <Field label={taxProfile(data.company).label}>
          <VatSelect value={m.vat} onChange={(v) => setM({ ...m, vat: v })} company={data.company} />
        </Field>
        <Field label="Einkaufspreis (netto)"><NumberInput value={m.purchasePrice} suffix={currencySymbol()} onChange={(v) => setM({ ...m, purchasePrice: v, salePrice: markup ? round2(v * (1 + markup / 100)) : m.salePrice })} /></Field>
        <Field label="Aufschlag"><NumberInput value={markup} suffix="%" onChange={(v) => { setMarkup(v); setM({ ...m, salePrice: round2(m.purchasePrice * (1 + v / 100)) }); }} /></Field>
        <Field label="Verkaufspreis (netto)"><NumberInput value={m.salePrice} suffix={currencySymbol()} onChange={(v) => { setM({ ...m, salePrice: v }); setMarkup(m.purchasePrice ? Math.round(((v - m.purchasePrice) / m.purchasePrice) * 100) : 0); }} /></Field>
        {isNew ? <Field label="Anfangsbestand"><NumberInput value={m.stock} onChange={(v) => setM({ ...m, stock: v })} /></Field> : null}
        <Field label="Mindestbestand" hint="0 = keine Warnung"><NumberInput value={m.minStock} onChange={(v) => setM({ ...m, minStock: v })} min={0} /></Field>
        <Field label="Beschreibung (erscheint auf Belegen)" span={3}><textarea rows={2} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} /></Field>
        <button type="submit" hidden />
      </form>
      {!isNew ? (
        <div className="movements">
          <h3>Lagerbewegungen · Bestand {qty(material.stock)} {material.unit}</h3>
          {material.movements.length ? (
            <ul>
              {material.movements.slice(0, 30).map((mv) => (
                <li key={mv.id}><span>{formatDate(mv.date)}</span><span>{mv.note}</span><b className={mv.quantity < 0 ? 'text-danger' : 'text-success'}>{mv.quantity > 0 ? '+' : ''}{qty(mv.quantity)}</b></li>
              ))}
            </ul>
          ) : <p className="muted small">Noch keine Bewegungen.</p>}
        </div>
      ) : null}
    </Modal>
  );
}

function BookingModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { bookStock, saveExpense, data } = useStore();
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [asExpense, setAsExpense] = useState(true);
  const [price, setPrice] = useState(material.purchasePrice);
  const [supplier, setSupplier] = useState('');
  const submit = () => {
    if (!amount) return;
    const signed = dir === 'in' ? amount : -amount;
    bookStock(material.id, signed, note || (dir === 'in' ? 'Wareneingang' : 'Entnahme'), date);
    if (dir === 'in' && asExpense && price > 0) {
      saveExpense({ id: uid(), date, supplier, description: `${qty(amount)} ${material.unit} ${material.name}`, category: 'Material & Waren', net: round2(amount * price), vat: data.company?.smallBusiness ? taxProfile(data.company).defaultRate : material.vat, receiptNo: '' });
    }
    onClose();
  };
  return (
    <Modal title={`Bestand buchen · ${material.name}`} onClose={onClose}
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button><button className="btn btn-primary" disabled={!amount} onClick={submit}>Buchen</button></>}>
      <Segmented value={dir} options={[['in', 'Zugang'], ['out', 'Abgang']]} onChange={setDir} />
      <form className="form-grid mt" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={`Menge (${material.unit})`}><NumberInput value={amount} onChange={setAmount} min={0} /></Field>
        <Field label="Datum"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Notiz"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={dir === 'in' ? 'Wareneingang' : 'z. B. Eigenverbrauch'} /></Field>
        {dir === 'in' ? (
          <>
            <label className="check span-3"><input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} /><span>Einkauf zusätzlich als Ausgabe erfassen (erscheint in der GuV)</span></label>
            {asExpense ? (
              <>
                <Field label="Einkaufspreis je Einheit (netto)"><NumberInput value={price} onChange={setPrice} suffix={currencySymbol()} /></Field>
                <Field label="Lieferant"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
                <div className="field"><span className="field-label">Summe netto</span><strong className="field-value">{money(amount * price)}</strong></div>
              </>
            ) : null}
          </>
        ) : null}
        <button type="submit" hidden />
      </form>
      <p className="muted small">{ArrowIcon(dir)} Neuer Bestand: <strong>{qty(material.stock + (dir === 'in' ? amount : -amount))} {material.unit}</strong></p>
    </Modal>
  );
}

const ArrowIcon = (dir: 'in' | 'out') => (dir === 'in' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />);
