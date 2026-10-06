'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Ban, Mail, MailCheck, Boxes, CheckCircle2, Copy, Download, Eye, FileOutput, Lock, Pencil, Plus, Search, Send, Trash2, UserPlus, XCircle,
} from 'lucide-react';
import { displayStatus, docTotals, formatDate, lineNet, money, qty, today } from '../../lib/calc';
import { UNITS, emptyItem } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { LineItem, Material, SalesDoc } from '../../lib/types';
import { DocumentTemplate } from '../pdf/document-template';
import { downloadPdf } from '../pdf/export';
import { A4Preview } from './a4-preview';
import { CustomerModal } from './customer-form';
import { currencySymbol } from '../../lib/calc';
import { formatRate, taxProfile } from '../../lib/tax';
import { fillMail, mailStatus } from '../../lib/mail';
import { SendDialog, useSendDocument } from './send-dialog';
import { Badge, Field, Modal, NumberInput, VatSelect } from './ui';

export function DocEditor() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const { data } = useStore();
  const doc = data.documents.find((d) => d.id === id);
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Beleg nicht gefunden.</p>
        <Link className="btn" href="/app">Zum Dashboard</Link>
      </div>
    );
  }
  return <Editor key={doc.id} doc={doc} />;
}

function Editor({ doc }: { doc: SalesDoc }) {
  const store = useStore();
  const { data, saveDoc, setDocStatus, deleteDoc, offerToInvoice, duplicateDoc } = store;
  const router = useRouter();
  const company = data.company!;
  const isInvoice = doc.kind === 'invoice';
  const base = isInvoice ? '/app/rechnungen' : '/app/angebote';
  const locked = isInvoice && doc.status !== 'draft';
  const totals = docTotals(doc.items, company.smallBusiness);
  const status = displayStatus(doc);
  const customer = data.customers.find((c) => c.id === doc.customerId);
  const tax = taxProfile(company);

  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [picker, setPicker] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payDate, setPayDate] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState('');

  const update = (patch: Partial<SalesDoc>) => {
    if (locked) return;
    saveDoc({ ...doc, ...patch });
  };
  const updateItem = (itemId: string, patch: Partial<LineItem>) => update({ items: doc.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });
  const moveItem = (index: number, dir: -1 | 1) => {
    const items = [...doc.items];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    update({ items });
  };
  const addMaterial = (m: Material) => {
    update({ items: [...doc.items, { ...emptyItem(m.vat), materialId: m.id, description: m.name, details: m.description, unit: m.unit, unitPrice: m.salePrice }] });
    setPicker(false);
  };
  const selectCustomer = (customerId: string) => {
    const c = data.customers.find((x) => x.id === customerId);
    update({
      customerId,
      recipient: c
        ? { name: c.name, contactPerson: c.contactPerson, street: c.street, zip: c.zip, city: c.city, country: c.country, vatId: c.vatId }
        : { name: '', contactPerson: '', street: '', zip: '', city: '', country: 'Deutschland', vatId: '' },
    });
  };

  const pdf = async () => {
    setBusy(true);
    try {
      await downloadPdf(<DocumentTemplate company={company} doc={doc} design={data.design} customerNumber={customer?.number} />, `${doc.number}${doc.recipient.name ? ' ' + doc.recipient.name : ''}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Das PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut.');
    } finally {
      setBusy(false);
    }
  };

  const canSend = doc.items.length > 0 && doc.recipient.name.trim();
  const sendDocument = useSendDocument();

  /** Mit „automatisch versenden“ geht die Rechnung ohne Dialog direkt an die Kunden-E-Mail. */
  const finalizeAndSend = async () => {
    const email = customer?.email || '';
    const auto = data.settings.email.autoSendInvoices && email && (await mailStatus()).enabled;
    if (!auto) return setSendOpen(true);
    if (!confirm(`Rechnung festschreiben und automatisch an ${email} senden?`)) return;
    setSending(true);
    try {
      const tpl = data.settings.email;
      await sendDocument(doc, { to: email, subject: fillMail(tpl.invoiceSubject, doc, company), text: fillMail(tpl.invoiceBody, doc, company) });
      setFlash(`Rechnung wurde an ${email} gesendet.`);
    } catch (e) {
      alert(`Automatischer Versand fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const actions = (
    <>
      {isInvoice && doc.status === 'draft' ? (
        <button className="btn btn-primary" disabled={!canSend || sending} title={canSend ? '' : 'Empfänger und mindestens eine Position erforderlich'} onClick={finalizeAndSend}>
          <Send size={16} /> {sending ? 'Sende …' : 'Festschreiben & versenden'}
        </button>
      ) : null}
      {isInvoice && doc.status !== 'draft' && doc.status !== 'cancelled' ? <button className="btn" onClick={() => setSendOpen(true)}><Mail size={16} /> {doc.sentAt ? 'Erneut senden' : 'Per E-Mail senden'}</button> : null}
      {!isInvoice ? <button className="btn" disabled={!canSend} onClick={() => setSendOpen(true)}><Mail size={16} /> Per E-Mail senden</button> : null}
      {isInvoice && doc.status === 'sent' ? <button className="btn btn-primary" onClick={() => setPayDate(today())}><CheckCircle2 size={16} /> Zahlung erfassen</button> : null}
      {!isInvoice && doc.status === 'draft' ? <button className="btn" disabled={!canSend} onClick={() => setDocStatus(doc.id, 'sent')}><Send size={16} /> Als versendet markieren</button> : null}
      {!isInvoice && doc.status !== 'declined' ? (
        <button className="btn btn-primary" disabled={!doc.items.length} onClick={async () => {
          const inv = await offerToInvoice(doc.id);
          if (inv) router.push(`/app/rechnungen/bearbeiten?id=${inv.id}`);
        }}><FileOutput size={16} /> In Rechnung umwandeln</button>
      ) : null}
      <button className="btn" onClick={pdf} disabled={busy}><Download size={16} /> {busy ? 'Erstelle PDF…' : 'PDF'}</button>
    </>
  );

  return (
    <div className="page page-wide">
      <div className="editor-head">
        <Link href={base} className="back"><ArrowLeft size={16} /> {isInvoice ? 'Rechnungen' : 'Angebote'}</Link>
        <div className="editor-title">
          <h1>{isInvoice ? 'Rechnung' : 'Angebot'} {doc.number}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
          {doc.sentAt ? <span className="sent-line"><MailCheck size={14} /> gesendet {formatDate(doc.sentAt.slice(0, 10))}{doc.sentTo ? ` an ${doc.sentTo}` : ''}</span> : null}
        </div>
        {flash ? <div className="notice notice-ok" role="status"><MailCheck size={16} /><span>{flash}</span></div> : null}
        <div className="page-actions">{actions}</div>
      </div>

      {locked ? (
        <div className="notice">
          <Lock size={16} />
          <span>
            {doc.status === 'paid' ? `Bezahlt am ${formatDate(doc.paidDate)}. ` : doc.status === 'cancelled' ? 'Diese Rechnung wurde storniert. ' : 'Diese Rechnung ist festgeschrieben. '}
            Festgeschriebene Rechnungen können nicht mehr geändert werden. Für Korrekturen stornieren und eine Kopie anlegen.
          </span>
        </div>
      ) : null}

      <div className="mobile-tabs">
        <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}><Pencil size={15} /> Bearbeiten</button>
        <button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}><Eye size={15} /> Vorschau</button>
      </div>

      <div className={`editor view-${view}`}>
        <div className="editor-form">
          <fieldset disabled={locked} className="card">
            <div className="card-head"><div><h2>Empfänger</h2></div></div>
            <div className="form-grid">
              <Field label="Kunde" span={2}>
                <div className="input-row">
                  <select value={doc.customerId} onChange={(e) => selectCustomer(e.target.value)}>
                    <option value="">– Kunde wählen –</option>
                    {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ''}</option>)}
                  </select>
                  <button type="button" className="btn" onClick={() => setNewCustomer(true)} title="Neuen Kunden anlegen"><UserPlus size={16} /><span className="hide-sm">Neu</span></button>
                </div>
              </Field>
              <Field label="Betreff / Projekt"><input value={doc.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="z. B. Umbau Büro 2. OG" /></Field>
            </div>
            {doc.recipient.name ? (
              <div className="address-preview">
                <span>{[doc.recipient.name, doc.recipient.contactPerson, doc.recipient.street, [doc.recipient.zip, doc.recipient.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
                <button type="button" className="link" onClick={() => setShowAddress(!showAddress)}>{showAddress ? 'Fertig' : 'Anschrift anpassen'}</button>
              </div>
            ) : (
              <button type="button" className="link" onClick={() => setShowAddress(!showAddress)}>Anschrift manuell eingeben</button>
            )}
            {showAddress ? (
              <div className="form-grid mt">
                {([['name', 'Name / Firma', 2], ['contactPerson', 'Ansprechpartner', 1], ['street', 'Straße', 3], ['zip', 'PLZ', 1], ['city', 'Ort', 1], ['country', 'Land', 1]] as const).map(([k, label, span]) => (
                  <Field key={k} label={label} span={span}><input value={doc.recipient[k]} onChange={(e) => update({ recipient: { ...doc.recipient, [k]: e.target.value } })} /></Field>
                ))}
              </div>
            ) : null}
          </fieldset>

          <fieldset disabled={locked} className="card">
            <div className="card-head"><div><h2>Daten</h2></div></div>
            <div className="form-grid">
              <Field label={isInvoice ? 'Rechnungsdatum' : 'Angebotsdatum'}><input type="date" value={doc.date} onChange={(e) => update({ date: e.target.value })} /></Field>
              <Field label={isInvoice ? 'Zahlbar bis' : 'Gültig bis'}><input type="date" value={doc.dueDate} onChange={(e) => update({ dueDate: e.target.value })} /></Field>
              {isInvoice ? <Field label="Leistungsdatum / -zeitraum"><input value={doc.serviceDate} onChange={(e) => update({ serviceDate: e.target.value })} placeholder="z. B. 01.–15.09.2026" /></Field> : null}
            </div>
          </fieldset>

          <fieldset disabled={locked} className="card">
            <div className="card-head">
              <div><h2>Positionen</h2><p>{doc.items.length} {doc.items.length === 1 ? 'Position' : 'Positionen'}</p></div>
            </div>
            <div className="items">
              {doc.items.map((item, index) => (
                <div key={item.id} className="item">
                  <div className="item-top">
                    <span className="item-pos">{index + 1}</span>
                    <div className="item-desc">
                      <input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Bezeichnung der Leistung oder des Artikels" aria-label="Bezeichnung" />
                      <textarea value={item.details} onChange={(e) => updateItem(item.id, { details: e.target.value })} placeholder="Beschreibung (optional)" rows={item.details ? 2 : 1} aria-label="Beschreibung" />
                      {item.materialId ? <span className="item-tag"><Boxes size={12} /> aus Materialstamm</span> : null}
                    </div>
                    <div className="item-tools">
                      <button type="button" className="icon-btn" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Nach oben"><ArrowUp size={15} /></button>
                      <button type="button" className="icon-btn" onClick={() => moveItem(index, 1)} disabled={index === doc.items.length - 1} aria-label="Nach unten"><ArrowDown size={15} /></button>
                      <button type="button" className="icon-btn danger" onClick={() => update({ items: doc.items.filter((i) => i.id !== item.id) })} aria-label="Position löschen"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="item-nums">
                    <Field label="Menge"><NumberInput value={item.quantity} onChange={(v) => updateItem(item.id, { quantity: v })} /></Field>
                    <Field label="Einheit">
                      <select value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })}>
                        {[...new Set([item.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </Field>
                    <Field label="Einzelpreis"><NumberInput value={item.unitPrice} onChange={(v) => updateItem(item.id, { unitPrice: v })} suffix={currencySymbol()} /></Field>
                    <Field label="Rabatt"><NumberInput value={item.discount} onChange={(v) => updateItem(item.id, { discount: Math.min(100, v) })} suffix="%" min={0} /></Field>
                    {!company.smallBusiness ? (
                      <Field label={tax.label}>
                        <VatSelect value={item.vat} onChange={(v) => updateItem(item.id, { vat: v })} company={company} />
                      </Field>
                    ) : null}
                    <div className="item-total"><span>Gesamt netto</span><strong>{money(lineNet(item))}</strong></div>
                  </div>
                </div>
              ))}
              {!doc.items.length ? <p className="muted pad-s">Fügen Sie eine freie Position hinzu oder übernehmen Sie Artikel aus dem Materialstamm.</p> : null}
            </div>
            <div className="item-add">
              <button type="button" className="btn" onClick={() => update({ items: [...doc.items, emptyItem(company.smallBusiness ? 0 : company.defaultVat)] })}><Plus size={16} /> Freie Position</button>
              <button type="button" className="btn" onClick={() => setPicker(true)}><Boxes size={16} /> Aus Material & Leistungen</button>
            </div>
            <div className="sum">
              {!company.smallBusiness ? <div><span>Netto</span><span>{money(totals.net)}</span></div> : null}
              {!company.smallBusiness ? totals.vatGroups.map((g) => <div key={g.rate}><span>zzgl. {formatRate(g.rate)} {tax.label}</span><span>{money(g.vat)}</span></div>) : null}
              <div className="sum-total"><span>{isInvoice ? 'Rechnungsbetrag' : 'Angebotssumme'}</span><span>{money(totals.gross)}</span></div>
              {company.smallBusiness ? <small className="muted">{tax.smallBusinessNote}</small> : null}
            </div>
          </fieldset>

          <fieldset disabled={locked} className="card">
            <div className="card-head"><div><h2>Texte</h2><p>Leer lassen für die Standardtexte aus dem Rechnungsdesign. Platzhalter: {'{nummer} {faellig} {gueltig} {kunde} {betrag}'}</p></div></div>
            <div className="form-grid">
              <Field label="Einleitung" span={3}><textarea rows={2} value={doc.intro} onChange={(e) => update({ intro: e.target.value })} placeholder={isInvoice ? data.design.invoiceIntro : data.design.offerIntro} /></Field>
              <Field label="Schlusstext" span={3}><textarea rows={3} value={doc.outro} onChange={(e) => update({ outro: e.target.value })} placeholder={isInvoice ? data.design.invoiceOutro : data.design.offerOutro} /></Field>
            </div>
          </fieldset>

          <div className="card card-plain">
            <div className="secondary-actions">
              {isInvoice && doc.status === 'draft' ? (
                <button className="btn btn-quiet" disabled={!canSend} onClick={() => confirm('Rechnung ohne E-Mail-Versand festschreiben? Danach ist sie nicht mehr änderbar und verbrauchtes Material wird vom Lager abgebucht.') && setDocStatus(doc.id, 'sent')}>
                  <Lock size={16} /> Nur festschreiben
                </button>
              ) : null}
              {!isInvoice && doc.status === 'sent' ? <button className="btn" onClick={() => setDocStatus(doc.id, 'accepted')}><CheckCircle2 size={16} /> Angenommen</button> : null}
              {!isInvoice && (doc.status === 'sent' || doc.status === 'draft') ? <button className="btn" onClick={() => setDocStatus(doc.id, 'declined')}><XCircle size={16} /> Abgelehnt</button> : null}
              {!isInvoice && doc.status !== 'draft' ? <button className="btn btn-quiet" onClick={() => setDocStatus(doc.id, 'draft')}>Zurück auf Entwurf</button> : null}
              {isInvoice && doc.status === 'paid' ? <button className="btn btn-quiet" onClick={() => setDocStatus(doc.id, 'sent')}>Zahlung zurücknehmen</button> : null}
              {isInvoice && (doc.status === 'sent' || doc.status === 'paid') ? (
                <button className="btn btn-quiet" onClick={() => confirm('Rechnung stornieren? Das Material wird dem Lager wieder gutgeschrieben.') && setDocStatus(doc.id, 'cancelled')}><Ban size={16} /> Stornieren</button>
              ) : null}
              <button className="btn btn-quiet" onClick={async () => {
                const copy = await duplicateDoc(doc.id);
                if (copy) router.push(`${base}/bearbeiten?id=${copy.id}`);
              }}><Copy size={16} /> Duplizieren</button>
              {!locked ? (
                <button className="btn btn-quiet danger" onClick={() => {
                  if (!confirm(`${isInvoice ? 'Rechnung' : 'Angebot'} ${doc.number} endgültig löschen?`)) return;
                  deleteDoc(doc.id);
                  router.push(base);
                }}><Trash2 size={16} /> Löschen</button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="editor-preview">
          <div className="preview-head">
            <span>Vorschau</span>
            <Link href="/app/design" className="link">Design anpassen</Link>
          </div>
          <A4Preview><DocumentTemplate company={company} doc={doc} design={data.design} customerNumber={customer?.number} /></A4Preview>
        </div>
      </div>

      {picker ? <MaterialPicker onClose={() => setPicker(false)} onPick={addMaterial} /> : null}
      {newCustomer ? <CustomerModal onClose={() => setNewCustomer(false)} onSaved={(c) => update({ customerId: c.id, recipient: { name: c.name, contactPerson: c.contactPerson, street: c.street, zip: c.zip, city: c.city, country: c.country, vatId: c.vatId } })} /> : null}
      {sendOpen ? <SendDialog doc={doc} onClose={() => setSendOpen(false)} onSent={(to) => setFlash(`${isInvoice ? 'Rechnung' : 'Angebot'} wurde an ${to} gesendet.`)} /> : null}
      {payDate !== null ? (
        <Modal title="Zahlungseingang erfassen" onClose={() => setPayDate(null)}
          footer={<><button className="btn btn-quiet" onClick={() => setPayDate(null)}>Abbrechen</button><button className="btn btn-primary" onClick={() => { setDocStatus(doc.id, 'paid', payDate || today()); setPayDate(null); }}>Als bezahlt markieren</button></>}>
          <p className="muted">Rechnung {doc.number} über <strong>{money(totals.gross)}</strong> an {doc.recipient.name}.</p>
          <Field label="Zahlungsdatum"><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
        </Modal>
      ) : null}
    </div>
  );
}

function MaterialPicker({ onClose, onPick }: { onClose: () => void; onPick: (m: Material) => void }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return data.materials.filter((m) => !s || `${m.number} ${m.name} ${m.category}`.toLowerCase().includes(s));
  }, [data.materials, q]);
  useEffect(() => {
    const first = document.querySelector<HTMLInputElement>('.picker-search input');
    first?.focus();
  }, []);
  return (
    <Modal title="Material & Leistungen" onClose={onClose} wide>
      <label className="search picker-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen nach Name, Nummer, Kategorie…" /></label>
      {list.length ? (
        <div className="picker-list">
          {list.map((m) => (
            <button key={m.id} className="picker-row" onClick={() => onPick(m)}>
              <span><strong>{m.name}</strong><small>{m.number}{m.category ? ` · ${m.category}` : ''}</small></span>
              <span className={`td-muted${m.minStock > 0 && m.stock <= m.minStock ? ' text-warning' : ''}`}>{qty(m.stock)} {m.unit}</span>
              <span className="td-num">{money(m.salePrice)}<small> / {m.unit}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted pad">{data.materials.length ? 'Keine Treffer.' : 'Noch kein Material angelegt.'} <Link href="/app/material" className="link">Material verwalten</Link></p>
      )}
    </Modal>
  );
}
