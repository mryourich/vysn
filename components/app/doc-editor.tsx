'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, Check, ArrowUp, Ban, CloudOff, PackageCheck, Undo2, Mail, MailCheck, Boxes, CheckCircle2, Copy, Download, Eye, FileOutput, Lock, Pencil, Plus, Search, Send, Trash2, UserPlus, XCircle,
} from 'lucide-react';
import { displayStatus, docTotals, formatDate, lineNet, money, positionLabels, qty, today } from '../../lib/calc';
import { UNITS, emptyItem } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { LineItem, Material, SalesDoc } from '../../lib/types';
import { DocumentTemplate } from '../pdf/document-template';
import { downloadPdf } from '../pdf/export';
import { isProvisional } from '../../lib/db/ops';
import { DOC_KINDS, NEXT_KINDS, docEditPath, docMail, docTexts } from '../../lib/docs';
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
  const { data, saveDoc, setDocStatus, deleteDoc, convertDoc, duplicateDoc } = store;
  const router = useRouter();
  const company = data.company!;
  const cfg = DOC_KINDS[doc.kind];
  const isInvoice = doc.kind === 'invoice';
  const isOrder = doc.kind === 'order';
  const isOffer = doc.kind === 'offer';
  const base = cfg.path;
  // Festgeschriebene Rechnungen und eingebuchte Bestellungen sind nicht mehr änderbar
  const locked = (isInvoice && doc.status !== 'draft') || (isOrder && doc.status === 'accepted');
  const texts = docTexts(store.design, doc.kind);
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
  // Positionen als Blöcke: Hauptposition samt ihrer Alternativen (1, 1.1, 1.2 …)
  const blocks = () => {
    const out: LineItem[][] = [];
    for (const item of doc.items) {
      if (item.parentId && out.some((b) => b[0].id === item.parentId)) out.find((b) => b[0].id === item.parentId)!.push(item);
      else out.push([item]);
    }
    return out;
  };
  const moveItem = (itemId: string, dir: -1 | 1) => {
    const list = blocks();
    const index = list.findIndex((b) => b[0].id === itemId);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    update({ items: list.flat() });
  };
  const removeItem = (itemId: string) => update({ items: doc.items.filter((i) => i.id !== itemId && i.parentId !== itemId) });
  const addAlternative = (parent: LineItem) => {
    const list = blocks();
    const block = list.find((b) => b[0].id === parent.id);
    if (!block) return;
    block.push({ ...emptyItem(parent.vat), unit: parent.unit, quantity: parent.quantity, variant: 'alternative', parentId: parent.id });
    update({ items: list.flat() });
  };
  const labels = positionLabels(doc.items);
  const mainIds = blocks().map((b) => b[0].id);
  const addMaterial = (m: Material) => {
    update({ items: [...doc.items, { ...emptyItem(m.vat), materialId: m.id, description: m.name, details: m.description, unit: m.unit, unitPrice: isOrder ? m.purchasePrice : m.salePrice }] });
    setPicker(false);
  };
  const selectCustomer = (customerId: string) => {
    const c = data.customers.find((x) => x.id === customerId);
    update({
      customerId,
      recipient: c
        ? { name: c.name, contactPerson: c.contactPerson, street: c.street, zip: c.zip, city: c.city, country: c.country, vatId: c.vatId }
        : { name: '', contactPerson: '', street: '', zip: '', city: '', country: company.country || 'Deutschland', vatId: '' },
    });
  };

  const pdf = async () => {
    setBusy(true);
    try {
      await downloadPdf(<DocumentTemplate company={company} doc={doc} design={store.design} customerNumber={customer?.number} />, `${doc.number}${doc.recipient.name ? ' ' + doc.recipient.name : ''}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Das PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut.');
    } finally {
      setBusy(false);
    }
  };

  const provisional = isProvisional(doc.number);
  const canSend = doc.items.length > 0 && doc.recipient.name.trim() && !provisional;
  const sendDocument = useSendDocument();

  /** Mit „automatisch versenden“ geht die Rechnung ohne Dialog direkt an die Kunden-E-Mail. */
  const mailLock = !store.can('email');
  const openSend = () => { if (store.requireFeature('email')) setSendOpen(true); };
  /** Festschreiben bzw. als versendet markieren – E-Mail-Versand optional (Häkchen im Dialog) */
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const finalize = async (mail: { to: string } | null) => {
    if (!mail) { setDocStatus(doc.id, 'sent'); setFinalizeOpen(false); return; }
    const status = await mailStatus();
    if (!status.enabled) {
      // Kein Mailserver: festschreiben und den Senden-Dialog (Teilen/E-Mail-Programm) öffnen
      setDocStatus(doc.id, 'sent');
      setFinalizeOpen(false);
      setSendOpen(true);
      return;
    }
    setSending(true);
    try {
      const tpl = docMail(data.settings.email, doc.kind);
      await sendDocument(doc, { to: mail.to, subject: fillMail(tpl.subject, doc, company), text: fillMail(tpl.body, doc, company) });
      if (doc.status === 'draft') setDocStatus(doc.id, 'sent');
      setFlash(`${cfg.one} wurde an ${mail.to} gesendet.`);
      setFinalizeOpen(false);
    } catch (e) {
      alert(`Versand fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const actions = (
    <>
      {doc.status === 'draft' ? (
        <button className="btn btn-primary" disabled={!canSend || sending} title={canSend ? '' : 'Empfänger und mindestens eine Position erforderlich'} onClick={() => setFinalizeOpen(true)}>
          {isInvoice ? <Lock size={16} /> : <Send size={16} />} {isInvoice ? 'Festschreiben' : `Als ${cfg.status.sent!.label.toLowerCase()} markieren`}
        </button>
      ) : null}
      {isInvoice && doc.status !== 'draft' && doc.status !== 'cancelled' ? <button className="btn" onClick={openSend}>{mailLock ? <Lock size={14} className="btn-lock" /> : <Mail size={16} />} {doc.sentAt ? 'Erneut senden' : 'Per E-Mail senden'}</button> : null}
      {!isInvoice && doc.status !== 'cancelled' && doc.status !== 'draft' ? <button className="btn" disabled={!canSend && !mailLock} onClick={openSend}>{mailLock ? <Lock size={14} className="btn-lock" /> : <Mail size={16} />} Per E-Mail senden</button> : null}
      {isInvoice && doc.status === 'sent' ? <button className="btn btn-primary" onClick={() => setPayDate(today())}><CheckCircle2 size={16} /> Zahlung erfassen</button> : null}
      {isOrder && doc.status === 'sent' ? (
        <button className="btn btn-primary" disabled={!doc.items.length} onClick={() => confirm('Wareneingang buchen? Die bestellten Artikel aus dem Materialstamm werden dem Lager gutgeschrieben.') && setDocStatus(doc.id, 'accepted')}>
          <PackageCheck size={16} /> Wareneingang buchen
        </button>
      ) : null}
      {doc.status !== 'declined' && doc.status !== 'cancelled' ? NEXT_KINDS[doc.kind].map((kind, i) => (
        <button key={kind} className={`btn${i === 0 && !isInvoice ? ' btn-primary' : ''}`} disabled={!doc.items.length} onClick={async () => {
          const next = await convertDoc(doc.id, kind);
          if (next) router.push(docEditPath(next));
        }}><FileOutput size={16} /> {kind === 'invoice' ? 'In Rechnung umwandeln' : `${DOC_KINDS[kind].one} erstellen`}</button>
      )) : null}
      <button className="btn" onClick={pdf} disabled={busy}><Download size={16} /> {busy ? 'Erstelle PDF…' : 'PDF'}</button>
    </>
  );

  return (
    <div className="page page-wide">
      <div className="editor-head">
        <Link href={base} className="back"><ArrowLeft size={16} /> {cfg.many}</Link>
        <div className="editor-title">
          <h1>{cfg.one} {doc.number}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
          {doc.sentAt ? <span className="sent-line"><MailCheck size={14} /> gesendet {formatDate(doc.sentAt.slice(0, 10))}{doc.sentTo ? ` an ${doc.sentTo}` : ''}</span> : null}
        </div>
        {flash ? <div className="notice notice-ok" role="status"><MailCheck size={16} /><span>{flash}</span></div> : null}
        {provisional ? <div className="notice" role="status"><CloudOff size={16} /><span><strong>Offline erstellt – vorläufige Nummer.</strong> Die endgültige Nummer wird beim nächsten Abgleich automatisch vergeben. Festschreiben und Versand sind danach möglich.</span></div> : null}
        <div className="page-actions">{actions}</div>
      </div>

      {isOrder && doc.status === 'accepted' ? (
        <div className="notice notice-ok"><PackageCheck size={16} /><span>Wareneingang gebucht – die Artikel wurden dem Lager gutgeschrieben. Zum Ändern den Wareneingang zurücknehmen.</span></div>
      ) : null}
      {locked && isInvoice ? (
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
              <Field label={cfg.partner} span={2}>
                <div className="input-row">
                  <select value={doc.customerId} onChange={(e) => selectCustomer(e.target.value)}>
                    <option value="">– {cfg.partner} wählen –</option>
                    {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ''}</option>)}
                  </select>
                  <button type="button" className="btn" onClick={() => setNewCustomer(true)} title="Neuen Kontakt anlegen"><UserPlus size={16} /><span className="hide-sm">Neu</span></button>
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
              <Field label={cfg.dateLabel}><input type="date" value={doc.date} onChange={(e) => update({ date: e.target.value })} /></Field>
              <Field label={cfg.dueLabel}><input type="date" value={doc.dueDate} onChange={(e) => update({ dueDate: e.target.value })} /></Field>
              {isInvoice ? <Field label="Leistungsdatum / -zeitraum"><input value={doc.serviceDate} onChange={(e) => update({ serviceDate: e.target.value })} placeholder="z. B. 01.–15.09.2026" /></Field> : null}
            </div>
          </fieldset>

          <fieldset disabled={locked} className="card">
            <div className="card-head">
              <div><h2>Positionen</h2><p>{doc.items.length} {doc.items.length === 1 ? 'Position' : 'Positionen'}</p></div>
            </div>
            <div className="items">
              {doc.items.map((item, index) => (
                <div key={item.id} className={`item${item.parentId ? ' item-alt' : ''}`}>
                  <div className="item-top">
                    <span className="item-pos">{labels[index]}</span>
                    <div className="item-desc">
                      <input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Bezeichnung der Leistung oder des Artikels" aria-label="Bezeichnung" />
                      <textarea value={item.details} onChange={(e) => updateItem(item.id, { details: e.target.value })} placeholder="Beschreibung (optional)" rows={item.details ? 2 : 1} aria-label="Beschreibung" />
                      {item.materialId ? <span className="item-tag"><Boxes size={12} /> aus Materialstamm</span> : null}
                      {item.variant ? (
                        <div className="item-variant">
                          <span className={`item-tag tag-${item.variant}`}>{item.variant === 'optional' ? 'Optional' : item.parentId ? `Alternative zu Pos. ${labels[doc.items.findIndex((x) => x.id === item.parentId)]}` : 'Alternative'} · nicht in der Summe</span>
                          <label className="check"><input type="checkbox" checked={!!item.chosen} onChange={(e) => updateItem(item.id, { chosen: e.target.checked })} /><span>{item.parentId ? 'Vom Kunden gewählt – ersetzt beim Umwandeln die Hauptposition' : 'Vom Kunden gewählt – wird beim Umwandeln übernommen'}</span></label>
                        </div>
                      ) : null}
                    </div>
                    <div className="item-tools">
                      {!item.parentId ? <>
                        <button type="button" className="icon-btn" onClick={() => moveItem(item.id, -1)} disabled={mainIds[0] === item.id} aria-label="Nach oben"><ArrowUp size={15} /></button>
                        <button type="button" className="icon-btn" onClick={() => moveItem(item.id, 1)} disabled={mainIds[mainIds.length - 1] === item.id} aria-label="Nach unten"><ArrowDown size={15} /></button>
                      </> : null}
                      <button type="button" className="icon-btn danger" onClick={() => removeItem(item.id)} aria-label="Position löschen"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="item-nums">
                    <Field label="Menge"><NumberInput value={item.quantity} onChange={(v) => updateItem(item.id, { quantity: v })} /></Field>
                    <Field label="Einheit">
                      <select value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })}>
                        {[...new Set([item.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </Field>
                    {cfg.prices ? <Field label={isOrder ? 'Einkaufspreis' : 'Einzelpreis'}><NumberInput value={item.unitPrice} onChange={(v) => updateItem(item.id, { unitPrice: v })} suffix={currencySymbol()} /></Field> : null}
                    {cfg.prices ? <Field label="Rabatt"><NumberInput value={item.discount} onChange={(v) => updateItem(item.id, { discount: Math.min(100, v) })} suffix="%" min={0} /></Field> : null}
                    {cfg.prices && !company.smallBusiness ? (
                      <Field label={tax.label}>
                        <VatSelect value={item.vat} onChange={(v) => updateItem(item.id, { vat: v })} company={company} />
                      </Field>
                    ) : null}
                    {isOffer && !item.parentId ? (
                      <Field label="Art">
                        <select value={item.variant || ''} onChange={(e) => updateItem(item.id, { variant: (e.target.value || undefined) as LineItem['variant'], chosen: false })}>
                          <option value="">Normal</option>
                          <option value="optional">Optional</option>
                          <option value="alternative">Alternative</option>
                        </select>
                      </Field>
                    ) : null}
                    {cfg.prices ? <div className={`item-total${item.variant ? ' item-total-muted' : ''}`}><span>{item.variant ? 'nicht in Summe' : 'Gesamt netto'}</span><strong>{money(lineNet(item))}</strong></div> : null}
                  </div>
                  {isOffer && !item.parentId && !item.variant ? (
                    <button type="button" className="link item-alt-add" onClick={() => addAlternative(item)}><Plus size={14} /> Alternative zu Pos. {labels[index]} hinzufügen</button>
                  ) : null}
                </div>
              ))}
              {!doc.items.length ? <p className="muted pad-s">Fügen Sie eine freie Position hinzu oder übernehmen Sie Artikel aus dem Materialstamm.</p> : null}
            </div>
            <div className="item-add">
              <button type="button" className="btn" onClick={() => update({ items: [...doc.items, emptyItem(company.smallBusiness ? 0 : company.defaultVat)] })}><Plus size={16} /> Freie Position</button>
              <button type="button" className="btn" onClick={() => setPicker(true)}><Boxes size={16} /> Aus Material & Leistungen</button>
            </div>
            {cfg.prices ? <div className="sum">
              {!company.smallBusiness ? <div><span>Netto</span><span>{money(totals.net)}</span></div> : null}
              {!company.smallBusiness ? totals.vatGroups.map((g) => <div key={g.rate}><span>zzgl. {formatRate(g.rate)} {tax.label}</span><span>{money(g.vat)}</span></div>) : null}
              <div className="sum-total"><span>{cfg.totalLabel}</span><span>{money(totals.gross)}</span></div>
              {company.smallBusiness ? <small className="muted">{tax.smallBusinessNote}</small> : null}
            </div> : null}
          </fieldset>

          <fieldset disabled={locked} className="card">
            <div className="card-head"><div><h2>Texte</h2><p>Leer lassen für die Standardtexte. Platzhalter: {'{nummer} {faellig} {gueltig} {kunde} {betrag}'}</p></div></div>
            <div className="form-grid">
              <Field label="Einleitung" span={3}><textarea rows={2} value={doc.intro} onChange={(e) => update({ intro: e.target.value })} placeholder={texts.intro} /></Field>
              <Field label="Schlusstext" span={3}><textarea rows={3} value={doc.outro} onChange={(e) => update({ outro: e.target.value })} placeholder={texts.outro} /></Field>
            </div>
          </fieldset>

          <div className="card card-plain">
            <div className="secondary-actions">
              {doc.kind === 'offer' && doc.status === 'sent' ? <button className="btn" onClick={() => setDocStatus(doc.id, 'accepted')}><CheckCircle2 size={16} /> Angenommen</button> : null}
              {doc.kind === 'offer' && (doc.status === 'sent' || doc.status === 'draft') ? <button className="btn" onClick={() => setDocStatus(doc.id, 'declined')}><XCircle size={16} /> Abgelehnt</button> : null}
              {doc.kind === 'confirmation' && doc.status === 'sent' ? <button className="btn" onClick={() => setDocStatus(doc.id, 'accepted')}><CheckCircle2 size={16} /> Als erledigt markieren</button> : null}
              {isOrder && doc.status === 'accepted' ? <button className="btn btn-quiet" onClick={() => confirm('Wareneingang zurücknehmen? Die Artikel werden wieder vom Lager abgebucht.') && setDocStatus(doc.id, 'sent')}><Undo2 size={16} /> Wareneingang zurücknehmen</button> : null}
              {!isInvoice && doc.kind !== 'offer' && (doc.status === 'draft' || doc.status === 'sent') ? <button className="btn btn-quiet" onClick={() => confirm(`${cfg.one} ${doc.number} stornieren?`) && setDocStatus(doc.id, 'cancelled')}><Ban size={16} /> Stornieren</button> : null}
              {!isInvoice && doc.status !== 'draft' && !(isOrder && doc.status === 'accepted') ? <button className="btn btn-quiet" onClick={() => setDocStatus(doc.id, 'draft')}>Zurück auf Entwurf</button> : null}
              {isInvoice && doc.status === 'paid' ? <button className="btn btn-quiet" onClick={() => setDocStatus(doc.id, 'sent')}>Zahlung zurücknehmen</button> : null}
              {isInvoice && (doc.status === 'sent' || doc.status === 'paid') ? (
                <button className="btn btn-quiet" onClick={() => confirm('Rechnung stornieren? Das Material wird dem Lager wieder gutgeschrieben.') && setDocStatus(doc.id, 'cancelled')}><Ban size={16} /> Stornieren</button>
              ) : null}
              <button className="btn btn-quiet" onClick={async () => {
                const copy = await duplicateDoc(doc.id);
                if (copy) router.push(docEditPath(copy));
              }}><Copy size={16} /> Duplizieren</button>
              {!locked ? (
                <button className="btn btn-quiet danger" onClick={() => {
                  if (!confirm(`${cfg.one} ${doc.number} endgültig löschen?`)) return;
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
            <Link href="/app/einstellungen?bereich=layout" className="link">Design anpassen</Link>
          </div>
          <A4Preview><DocumentTemplate company={company} doc={doc} design={store.design} customerNumber={customer?.number} /></A4Preview>
        </div>
      </div>

      {picker ? <MaterialPicker purchase={isOrder} onClose={() => setPicker(false)} onPick={addMaterial} /> : null}
      {newCustomer ? <CustomerModal onClose={() => setNewCustomer(false)} onSaved={(c) => update({ customerId: c.id, recipient: { name: c.name, contactPerson: c.contactPerson, street: c.street, zip: c.zip, city: c.city, country: c.country, vatId: c.vatId } })} /> : null}
      {finalizeOpen ? (
        <FinalizeDialog title={isInvoice ? `Rechnung ${doc.number} festschreiben` : `${cfg.one} ${doc.number} als ${cfg.status.sent!.label.toLowerCase()} markieren`}
          note={isInvoice ? 'Festgeschriebene Rechnungen sind nicht mehr änderbar; verbrauchtes Material wird vom Lager abgebucht.' : ''}
          email={customer?.email || ''} mailLock={mailLock} preselect={data.settings.email.autoSendInvoices}
          busy={sending} onClose={() => setFinalizeOpen(false)} onConfirm={finalize} onUpgrade={() => store.requireFeature('email')} />
      ) : null}
      {sendOpen ? <SendDialog doc={doc} onClose={() => setSendOpen(false)} onSent={(to) => setFlash(`${cfg.one} wurde an ${to} gesendet.`)} /> : null}
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

function MaterialPicker({ onClose, onPick, purchase }: { onClose: () => void; onPick: (m: Material) => void; purchase?: boolean }) {
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
              <span className="td-num">{money(purchase ? m.purchasePrice : m.salePrice)}<small> / {m.unit}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted pad">{data.materials.length ? 'Keine Treffer.' : 'Noch kein Material angelegt.'} <Link href="/app/material" className="link">Material verwalten</Link></p>
      )}
    </Modal>
  );
}

function FinalizeDialog({ title, note, email, mailLock, preselect, busy, onClose, onConfirm, onUpgrade }: {
  title: string; note: string; email: string; mailLock: boolean; preselect: boolean; busy: boolean;
  onClose: () => void; onConfirm: (mail: { to: string } | null) => void; onUpgrade: () => void;
}) {
  const [send, setSend] = useState(!mailLock && preselect && !!email);
  const [to, setTo] = useState(email);
  const valid = !send || /\S+@\S+\.\S+/.test(to);
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onConfirm(send ? { to: to.trim() } : null)}>
          {busy ? 'Sende …' : send ? <><Send size={16} /> Bestätigen & senden</> : <><Check size={16} /> Bestätigen</>}
        </button></>}>
      {note ? <p className="muted">{note}</p> : null}
      <label className="check mt">
        <input type="checkbox" checked={send} onChange={(e) => { if (mailLock) { onUpgrade(); return; } setSend(e.target.checked); }} />
        <span><strong>Per E-Mail senden</strong>{mailLock ? <> <Lock size={12} /> ab Business</> : null}<br />Mit PDF im Anhang an den Kunden – optional.</span>
      </label>
      {send ? <Field label="An"><input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@beispiel.de" autoFocus={!to} /></Field> : null}
    </Modal>
  );
}
