'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Loader2, Lock, Mail, Mic, MicOff, Paperclip, RotateCcw, Send, Sparkles, Sun, UserPlus, Volume2, VolumeX, X } from 'lucide-react';
import { AgentError, agentRemaining, agentStatus, askAgent } from '../../lib/agent';
import type { AgentAction, AgentHistory, AgentProposal, CustomerProposal, EmailProposal, PaymentProposal } from '../../lib/agent';
import { docTotals, formatDate, money, qty, today, uid } from '../../lib/calc';
import { emptyCustomer } from '../../lib/defaults';
import { DOC_KINDS, docEditPath } from '../../lib/docs';
import { sendMail } from '../../lib/mail';
import { useStore } from '../../lib/store';
import type { LineItem } from '../../lib/types';
import { DocumentTemplate } from '../pdf/document-template';
import { renderPdf } from '../pdf/export';
import { docFileName } from './send-dialog';

/** Öffnet den Assistenten von überall (z. B. Seite „Erweiterungen“). */
export const ASSISTANT_EVENT = 'vysn:assistant';

type Bubble = { role: 'user' | 'assistant'; text: string; actions?: AgentAction[] };

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

function createRecognition(lang: string): Recognition | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = lang;
  r.continuous = true;
  r.interimResults = true;
  return r;
}

const speechLang = (country: string) => (/österreich|austria/i.test(country) ? 'de-AT' : /schweiz|switzerland/i.test(country) ? 'de-CH' : 'de-DE');

export function VoiceAssistant() {
  const { data, can, requireFeature, activeCompanyId, createDoc, saveDoc } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const company = data.company!;
  const allowed = can('ai');
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<AgentHistory>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ status: string; text: string }>({ status: '', text: '' });
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [monthly, setMonthly] = useState(300);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const listRef = useRef<HTMLDivElement>(null);
  const supported = typeof window !== 'undefined' && !!createRecognition('de-DE');

  // Ohne API-Schlüssel auf dem Server bleibt der Assistent unsichtbar (keine Kosten)
  useEffect(() => { agentStatus().then((s) => { setEnabled(s.enabled); if (s.monthlyLimit) setMonthly(s.monthlyLimit); }); }, []);
  useEffect(() => { if (open && allowed && activeCompanyId) agentRemaining(activeCompanyId).then((r) => { if (r !== null) setRemaining(r); }); }, [open, allowed, activeCompanyId]);
  const show = useCallback(() => { if (enabled && requireFeature('ai')) setOpen(true); }, [enabled, requireFeature]);
  useEffect(() => {
    const onOpen = () => show();
    window.addEventListener(ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_EVENT, onOpen);
  }, [show]);
  // /app?ki=1 öffnet den Assistenten direkt
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('ki') === '1') {
      url.searchParams.delete('ki');
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
      show();
    }
  }, [pathname, show]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [bubbles, busy, live]);
  useEffect(() => () => { recRef.current?.abort(); window.speechSynthesis?.cancel(); }, []);

  const say = (text: string) => {
    if (!speak || !text || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(company.country);
    window.speechSynthesis.speak(u);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || !activeCompanyId) return;
    setInput('');
    setBubbles((b) => [...b, { role: 'user', text }]);
    setBusy(true);
    try {
      setLive({ status: '', text: '' });
      const r = await askAgent(activeCompanyId, history, text, (e) => {
        if (e.type === 'status') setLive((l) => ({ ...l, status: e.text }));
        else if (e.type === 'delta') setLive((l) => ({ status: '', text: l.text + e.text }));
        else setLive((l) => ({ ...l, text: l.text ? `${l.text}\n` : '' }));
      });
      setHistory(r.messages);
      if (typeof r.remaining === 'number') setRemaining(r.remaining);
      const actions = r.actions ?? (r.proposal ? [{ type: 'document' as const, ...r.proposal }] : []);
      const reply = r.reply || (actions.length ? 'Hier ist mein Vorschlag. Passt das so?' : '');
      setBubbles((b) => [...b, { role: 'assistant', text: reply, actions }]);
      say(reply);
    } catch (e) {
      if (e instanceof AgentError && e.upgrade) { setOpen(false); requireFeature('ai'); return; }
      setBubbles((b) => [...b, { role: 'assistant', text: (e as Error).message }]);
    } finally {
      setBusy(false);
      setLive({ status: '', text: '' });
    }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    window.speechSynthesis?.cancel();
    const r = createRecognition(speechLang(company.country));
    if (!r) return;
    finalRef.current = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += `${res[0].transcript} `;
        else interim += res[0].transcript;
      }
      setInput((finalRef.current + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed') setBubbles((b) => [...b, { role: 'assistant', text: 'Bitte erlauben Sie den Zugriff auf das Mikrofon in Ihrem Browser.' }]);
    };
    r.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.trim();
      if (text) send(text);
    };
    recRef.current = r;
    setListening(true);
    r.start();
  };

  const reset = () => {
    recRef.current?.abort();
    window.speechSynthesis?.cancel();
    setBubbles([]);
    setHistory([]);
    setInput('');
  };

  /** Bestätigter Vorschlag → Beleg als Entwurf anlegen und öffnen */
  const acceptDocument = async (p: AgentProposal) => {
    const customer = data.customers.find((c) => c.id === p.customer_id);
    const doc = await createDoc(p.kind, customer?.id || '');
    if (!doc) return;
    const items: LineItem[] = p.items.map((i) => ({
      id: uid(),
      materialId: data.materials.some((m) => m.id === i.material_id) ? i.material_id : undefined,
      description: i.description,
      details: i.details,
      quantity: Number(i.quantity) || 1,
      unit: i.unit || 'Stück',
      unitPrice: Number(i.unit_price) || 0,
      vat: company.smallBusiness ? 0 : Number(i.vat ?? company.defaultVat),
      discount: 0,
      interval: i.monthly ? 'monthly' : undefined,
    }));
    saveDoc({
      ...doc,
      subject: p.subject,
      items,
      recipient: customer ? doc.recipient : { ...doc.recipient, name: p.recipient_name },
    });
    setOpen(false);
    router.push(docEditPath(doc));
  };

  if (!enabled) return null;

  return (
    <>
      <button className={`assistant-fab${allowed ? '' : ' locked'}`} onClick={show} aria-label="Assistent öffnen" title="Assistent">
        {allowed ? <Mic size={22} /> : <Lock size={18} />}
        <span>Assistent</span>
      </button>
      {open ? (
        <div className="assistant-backdrop" onClick={() => setOpen(false)}>
          <aside className="assistant" role="dialog" aria-label="Assistent" onClick={(e) => e.stopPropagation()}>
            <header className="assistant-head">
              <span className="assistant-badge"><Sparkles size={16} /></span>
              <div><strong>Assistent</strong><small>Ihre digitale Bürokraft</small></div>
              <button className="icon-btn" onClick={() => setSpeak(!speak)} title={speak ? 'Vorlesen aus' : 'Vorlesen an'} aria-label="Vorlesen umschalten">{speak ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
              <button className="icon-btn" onClick={reset} title="Neu beginnen" aria-label="Neu beginnen"><RotateCcw size={17} /></button>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Schließen"><X size={18} /></button>
            </header>

            <div className="assistant-list" ref={listRef}>
              {!bubbles.length ? (
                <div className="assistant-intro">
                  <button className="btn btn-primary assistant-briefing" onClick={() => send('Was steht heute an? Bitte ein kurzes Tagesbriefing.')}><Sun size={17} /> Was steht heute an?</button>
                  <p><strong>Sagen Sie einfach, was zu tun ist.</strong> Zum Beispiel:</p>
                  {['Schreib allen mit überfälligen Rechnungen eine freundliche Zahlungserinnerung', 'Gibt es neue Anfragen im Posteingang?', 'Neues Angebot für Herrn Müller: zwei Steckdosen von Gira und Arbeit pauschal 20 Euro', 'Leg einen neuen Kunden an: Bäckerei Huber, Hauptstraße 5, 4020 Linz', 'Rechnung RE-2026-0042 ist heute bezahlt worden', 'Wie viel Umsatz habe ich diesen Monat gemacht?'].map((t) => (
                    <button key={t} className="assistant-example" onClick={() => send(t)}>„{t}“</button>
                  ))}
                  <p className="muted small">Ich schreibe E-Mails an Ihre Kunden, erinnere an offene Rechnungen, lese Ihren Posteingang, lege Belege und Kunden an und beantworte Fragen zu Ihren Zahlen. Verschickt oder gespeichert wird erst, wenn Sie bestätigen.</p>
                </div>
              ) : null}
              {bubbles.map((b, i) => (
                <div key={i} className={`assistant-msg from-${b.role === 'user' ? 'user' : 'ai'}`}>
                  {b.text ? <p>{b.text}</p> : null}
                  {(b.actions || []).map((a, k) => <ActionCard key={k} action={a} onDocument={acceptDocument} />)}
                </div>
              ))}
              {busy ? (
                <div className="assistant-msg from-ai">
                  {live.text ? <p>{live.text}</p> : null}
                  {!live.text || live.status ? <p className="assistant-typing"><Loader2 size={15} className="spin" /> {live.status || 'Einen Moment …'}</p> : null}
                </div>
              ) : null}
            </div>

            <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              {supported ? (
                <button type="button" className={`assistant-mic${listening ? ' on' : ''}`} onClick={toggleMic} disabled={busy} aria-label={listening ? 'Aufnahme beenden' : 'Sprechen'}>
                  {listening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              ) : null}
              <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Ich höre zu …' : supported ? 'Sprechen oder tippen …' : 'Anliegen eingeben …'}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
              <button className="btn btn-primary assistant-send" disabled={busy || !input.trim() || listening} aria-label="Senden"><Send size={17} /></button>
            </form>
            {remaining !== null ? <p className="assistant-quota">{remaining ? `Noch ${remaining} von ${monthly} Aufgaben in diesem Monat` : 'Monatsguthaben aufgebraucht – am 1. geht es weiter'}</p> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ActionCard({ action, onDocument }: { action: AgentAction; onDocument: (p: AgentProposal) => Promise<void> }) {
  const [done, setDone] = useState(false);
  if (action.type === 'email') return <EmailCard p={action} done={done} onDone={() => setDone(true)} />;
  if (action.type === 'customer') return <CustomerCard p={action} done={done} onDone={() => setDone(true)} />;
  if (action.type === 'payment') return <PaymentCard p={action} done={done} onDone={() => setDone(true)} />;
  return <ProposalCard p={action} done={done} onAccept={() => { setDone(true); onDocument(action); }} />;
}

function EmailCard({ p, done, onDone }: { p: EmailProposal; done: boolean; onDone: () => void }) {
  const { data, design, activeCompanyId, markSent, setDocStatus } = useStore();
  const company = data.company!;
  const doc = data.documents.find((d) => d.id === p.document_id);
  const customer = data.customers.find((c) => c.id === (p.customer_id || doc?.customerId));
  const [to, setTo] = useState(p.to || customer?.email || '');
  const [subject, setSubject] = useState(p.subject);
  const [text, setText] = useState(p.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (doc && doc.kind === 'invoice' && doc.status === 'draft') setDocStatus(doc.id, 'sent');
      const pdf = doc ? await renderPdf(<DocumentTemplate company={company} doc={doc} design={design} customerNumber={customer?.number} />) : undefined;
      await sendMail({ to, subject, text, fromName: company.name, replyTo: company.email, bcc: data.settings.email.bcc, pdf, fileName: doc ? docFileName(doc) : undefined, companyId: activeCompanyId, inReplyTo: p.in_reply_to });
      if (doc) markSent(doc.id, to);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="proposal">
      <div className="proposal-head"><strong><Mail size={14} /> E-Mail</strong><span>{p.purpose}</span></div>
      <label className="proposal-field"><span>An</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="E-Mail-Adresse" disabled={done} /></label>
      <label className="proposal-field"><span>Betreff</span><input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={done} /></label>
      <textarea className="proposal-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={done} />
      {doc ? <small className="muted"><Paperclip size={12} /> {DOC_KINDS[doc.kind].one} {doc.number} als PDF</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
      <button className="btn btn-primary" disabled={done || busy || !to.trim() || !subject.trim()} onClick={submit}>
        {done ? <><Check size={16} /> Gesendet</> : busy ? <><Loader2 size={16} className="spin" /> Wird gesendet …</> : <><Send size={16} /> Jetzt senden</>}
      </button>
    </div>
  );
}

function CustomerCard({ p, done, onDone }: { p: CustomerProposal; done: boolean; onDone: () => void }) {
  const { data, saveCustomer } = useStore();
  const existing = data.customers.find((c) => c.id === p.customer_id);
  const fields: [string, string][] = [['Name', p.name], ['Ansprechpartner', p.contact_person], ['E-Mail', p.email], ['Telefon', p.phone], ['Adresse', [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')], ['Notiz', p.notes]];
  const submit = async () => {
    const base = existing || emptyCustomer(data.company?.country);
    const saved = await saveCustomer({ ...base, name: p.name, contactPerson: p.contact_person, email: p.email, phone: p.phone, street: p.street, zip: p.zip, city: p.city, notes: p.notes || base.notes });
    if (saved) onDone();
  };
  return (
    <div className="proposal">
      <div className="proposal-head"><strong><UserPlus size={14} /> {existing ? 'Kunde ändern' : 'Neuer Kunde'}</strong><span>{existing?.number || ''}</span></div>
      <ul>{fields.filter(([, v]) => v).map(([k, v]) => <li key={k}><span className="muted">{k}</span><b>{v}</b></li>)}</ul>
      <button className="btn btn-primary" disabled={done || !p.name.trim()} onClick={submit}>{done ? <><Check size={16} /> Gespeichert</> : <><Check size={16} /> {existing ? 'Änderungen speichern' : 'Kunde anlegen'}</>}</button>
    </div>
  );
}

function PaymentCard({ p, done, onDone }: { p: PaymentProposal; done: boolean; onDone: () => void }) {
  const { data, setDocStatus } = useStore();
  const doc = data.documents.find((d) => d.id === p.document_id && d.kind === 'invoice');
  if (!doc) return <div className="proposal"><small className="muted">Die Rechnung wurde nicht gefunden.</small></div>;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.paid_date) ? p.paid_date : today();
  const already = doc.status === 'paid';
  return (
    <div className="proposal">
      <div className="proposal-head"><strong><CheckCircle2 size={14} /> Zahlungseingang</strong><span>{doc.recipient.name}</span></div>
      <ul>
        <li><span>Rechnung {doc.number}</span><b>{money(docTotals(doc.items, !!data.company?.smallBusiness, doc.kind).gross)}</b></li>
        <li><span className="muted">Bezahlt am</span><b>{formatDate(date)}</b></li>
      </ul>
      <button className="btn btn-primary" disabled={done || already} onClick={() => { setDocStatus(doc.id, 'paid', date); onDone(); }}>
        {done || already ? <><Check size={16} /> Als bezahlt markiert</> : <><Check size={16} /> Als bezahlt markieren</>}
      </button>
    </div>
  );
}

function ProposalCard({ p, done, onAccept }: { p: AgentProposal; done: boolean; onAccept: () => void }) {
  const { data } = useStore();
  const small = !!data.company?.smallBusiness;
  const customer = data.customers.find((c) => c.id === p.customer_id);
  const totals = docTotals(p.items.filter((i) => !i.monthly).map((i) => ({ id: '', description: i.description, details: '', quantity: i.quantity, unit: i.unit, unitPrice: i.unit_price, vat: small ? 0 : i.vat, discount: 0 })), small);
  const cfg = DOC_KINDS[p.kind] || DOC_KINDS.offer;
  return (
    <div className="proposal">
      <div className="proposal-head"><strong>{cfg.one}</strong><span>{customer?.name || p.recipient_name || 'Ohne Empfänger'}{customer ? '' : p.recipient_name ? ' (neu)' : ''}</span></div>
      {p.subject ? <small className="muted">{p.subject}</small> : null}
      <ul>
        {p.items.map((i, k) => (
          <li key={k}><span>{qty(i.quantity)} {i.unit} {i.description}{i.material_id ? '' : ' *'}</span>{cfg.prices ? <b>{money(i.quantity * i.unit_price)}{i.monthly ? ' /Monat' : ''}</b> : null}</li>
        ))}
      </ul>
      {cfg.prices ? <div className="proposal-sum"><span>{small ? 'Summe' : 'Summe netto'}{p.items.some((i) => i.monthly) ? ' einmalig' : ''}</span><b>{money(totals.net)}</b></div> : null}
      {p.items.some((i) => !i.material_id) ? <small className="muted">* freie Position (nicht aus dem Materialstamm)</small> : null}
      <button className="btn btn-primary" disabled={done} onClick={onAccept}>{done ? <><Check size={16} /> Übernommen</> : <><Check size={16} /> Als Entwurf übernehmen</>}</button>
    </div>
  );
}
