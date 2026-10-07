'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Boxes, Check, MapPin, Minus, Plus, ScanLine, Smartphone } from 'lucide-react';
import { formatDate, qty } from '../../../lib/calc';
import { parseScan } from '../../../lib/qr';
import { useStore } from '../../../lib/store';
import type { Material } from '../../../lib/types';
import { QrScanner } from '../../../components/app/scanner';
import { NumberInput } from '../../../components/app/ui';

export default function ScanPage() {
  return <Suspense fallback={null}><Scan /></Suspense>;
}

function Scan() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, activeCompanyId, companies, switchCompany } = useStore();
  const [manual, setManual] = useState('');
  const [notFound, setNotFound] = useState('');
  const locationId = params.get('l') || '';
  const materialId = params.get('m') || '';
  const companyParam = params.get('c') || '';

  // Etikett einer anderen eigenen Firma gescannt → automatisch dorthin wechseln
  useEffect(() => {
    if (companyParam && companyParam !== activeCompanyId && companies.some((c) => c.id === companyParam)) switchCompany(companyParam);
  }, [companyParam, activeCompanyId, companies, switchCompany]);

  const location = data.locations.find((l) => l.id === locationId);
  const material = data.materials.find((m) => m.id === materialId);

  const open = (text: string) => {
    setNotFound('');
    const r = parseScan(text);
    if (r.location || r.material) {
      const q = new URLSearchParams();
      if (r.location) q.set('l', r.location);
      if (r.material) q.set('m', r.material);
      if (r.company) q.set('c', r.company);
      router.replace(`/app/scan?${q.toString()}`);
      return;
    }
    const code = (r.code || '').toLowerCase();
    const loc = data.locations.find((l) => l.code.toLowerCase() === code);
    if (loc) return router.replace(`/app/scan?l=${loc.id}`);
    const mat = data.materials.find((m) => m.number.toLowerCase() === code);
    if (mat) return router.replace(`/app/scan?m=${mat.id}`);
    setNotFound(`Kein Lagerplatz oder Artikel mit „${r.code}“ gefunden.`);
  };

  const unknown = (locationId && !location) || (materialId && !material);

  return (
    <div className="page scan-page">
      <header className="scan-head">
        {locationId || materialId ? <Link href="/app/scan" className="back"><ArrowLeft size={16} /> Neuer Scan</Link> : <Link href="/app/material" className="back"><ArrowLeft size={16} /> Material & Lager</Link>}
        <h1><ScanLine size={22} /> Lager-Scanner</h1>
      </header>

      {material ? <MaterialBooking material={material} /> : location ? <LocationView id={location.id} /> : (
        <>
          {unknown ? <div className="notice notice-warn">Dieses Etikett gehört nicht zur geöffneten Firma oder wurde gelöscht.</div> : null}
          <QrScanner onResult={open} />
          <form className="scan-manual" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) open(manual); }}>
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Code eingeben, z. B. A-01 oder ART-0003" aria-label="Code" />
            <button className="btn" type="submit">Öffnen</button>
          </form>
          {notFound ? <p className="field-error">{notFound}</p> : null}
          <div className="scan-tip">
            <Smartphone size={18} />
            <p><strong>Tipp:</strong> Die Etiketten lassen sich auch direkt mit der normalen Kamera-App scannen – der Link öffnet sofort die Buchung. Über „Zum Home-Bildschirm hinzufügen“ im Browser-Menü wird VYSNER One wie eine App installiert.</p>
          </div>
        </>
      )}
    </div>
  );
}

function LocationView({ id }: { id: string }) {
  const { data, saveMaterial } = useStore();
  const location = data.locations.find((l) => l.id === id)!;
  const items = data.materials.filter((m) => m.locationId === id).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const others = useMemo(() => data.materials.filter((m) => m.locationId !== id), [data.materials, id]);
  const [assign, setAssign] = useState('');
  return (
    <div className="scan-stack">
      <section className="scan-card scan-hero">
        <span className="scan-kicker"><MapPin size={14} /> Lagerplatz</span>
        <h2>{location.code}</h2>
        <p>{[location.name, location.note].filter(Boolean).join(' · ')}</p>
      </section>
      <section className="scan-card">
        <h3>{items.length} Artikel an diesem Platz</h3>
        <div className="scan-list">
          {items.map((m) => (
            <Link key={m.id} href={`/app/scan?m=${m.id}`} className="scan-item">
              <Boxes size={18} />
              <span><strong>{m.name}</strong><small>{m.number}</small></span>
              <b className={m.minStock > 0 && m.stock <= m.minStock ? 'text-warning' : ''}>{qty(m.stock)} {m.unit}</b>
            </Link>
          ))}
          {!items.length ? <p className="muted small">Noch keine Artikel zugeordnet.</p> : null}
        </div>
        {others.length ? (
          <div className="scan-assign">
            <select value={assign} onChange={(e) => setAssign(e.target.value)} aria-label="Artikel zuordnen">
              <option value="">Artikel hierher legen …</option>
              {others.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.number})</option>)}
            </select>
            <button className="btn" disabled={!assign} onClick={async () => {
              const m = data.materials.find((x) => x.id === assign);
              if (m) await saveMaterial({ ...m, locationId: id });
              setAssign('');
            }}>Zuordnen</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MaterialBooking({ material }: { material: Material }) {
  const { data, bookStock, saveMaterial } = useStore();
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ dir: 'in' | 'out'; amount: number } | null>(null);
  const location = data.locations.find((l) => l.id === material.locationId);

  const book = (dir: 'in' | 'out') => {
    if (!amount) return;
    bookStock(material.id, dir === 'in' ? amount : -amount, note.trim() || (dir === 'in' ? 'Einlagerung (Scan)' : 'Entnahme (Scan)'));
    if ('vibrate' in navigator) navigator.vibrate(40);
    setDone({ dir, amount });
    setNote('');
  };

  return (
    <div className="scan-stack">
      <section className="scan-card scan-hero">
        <span className="scan-kicker"><Boxes size={14} /> {material.number}{location ? <> · <MapPin size={12} /> {location.code}</> : null}</span>
        <h2>{material.name}</h2>
        <div className="scan-stock"><strong>{qty(material.stock)}</strong><span>{material.unit} auf Lager</span></div>
        {material.minStock > 0 && material.stock <= material.minStock ? <p className="text-warning small">Unter Mindestbestand ({qty(material.minStock)} {material.unit})</p> : null}
      </section>

      {done ? (
        <section className="scan-card scan-done">
          <Check size={28} />
          <p><strong>{qty(done.amount)} {material.unit} {done.dir === 'in' ? 'eingelagert' : 'ausgelagert'}.</strong> Neuer Bestand: {qty(material.stock)} {material.unit}</p>
          <div className="scan-done-actions">
            <Link className="btn btn-primary" href="/app/scan"><ScanLine size={16} /> Nächster Scan</Link>
            <button className="btn" onClick={() => setDone(null)}>Weitere Buchung</button>
          </div>
        </section>
      ) : (
        <section className="scan-card">
          <h3>Menge</h3>
          <div className="stepper">
            <button type="button" onClick={() => setAmount(Math.max(0, amount - 1))} aria-label="Weniger"><Minus size={22} /></button>
            <NumberInput value={amount} onChange={setAmount} min={0} aria-label="Menge" />
            <button type="button" onClick={() => setAmount(amount + 1)} aria-label="Mehr"><Plus size={22} /></button>
          </div>
          <div className="quick-amounts">{[1, 5, 10, 25].map((n) => <button key={n} type="button" className={amount === n ? 'active' : ''} onClick={() => setAmount(n)}>{n}</button>)}</div>
          <input className="scan-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (optional), z. B. Baustelle Müller" />
          <div className="scan-actions">
            <button className="scan-btn scan-in" onClick={() => book('in')} disabled={!amount}><ArrowDownToLine size={22} /> Einlagern</button>
            <button className="scan-btn scan-out" onClick={() => book('out')} disabled={!amount}><ArrowUpFromLine size={22} /> Auslagern</button>
          </div>
          {data.locations.length ? (
            <label className="scan-move">
              <span>Lagerplatz</span>
              <select value={material.locationId} onChange={(e) => saveMaterial({ ...material, locationId: e.target.value })}>
                <option value="">– ohne –</option>
                {data.locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
              </select>
            </label>
          ) : null}
        </section>
      )}

      {material.movements.length ? (
        <section className="scan-card">
          <h3>Letzte Bewegungen</h3>
          <ul className="scan-moves">
            {material.movements.slice(0, 6).map((mv) => (
              <li key={mv.id}><span>{formatDate(mv.date)}</span><span>{mv.note}</span><b className={mv.quantity < 0 ? 'text-danger' : 'text-success'}>{mv.quantity > 0 ? '+' : ''}{qty(mv.quantity)}</b></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
