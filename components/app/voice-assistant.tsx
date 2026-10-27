'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines, Check, CheckCircle2, History, Loader2, Lock, Mail, Mic, MicOff, Paperclip, Plus, Send, Sparkles, Sun, Trash2, Undo2, Volume2, VolumeX, X, XCircle,
} from 'lucide-react';
import { AgentError, agentRemaining, agentStatus, askAgent, deleteChat, listChats, loadChat, saveChat } from '../../lib/agent';
import type { ActionResult, AgentAction, AgentHistory, ChatSummary, EmailProposal } from '../../lib/agent';
import { formatDate, round2, today, uid } from '../../lib/calc';
import { emptyCustomer } from '../../lib/defaults';
import { DOC_KINDS, docEditPath } from '../../lib/docs';
import { sendMail } from '../../lib/mail';
import { useStore } from '../../lib/store';
import type { Customer, LineItem } from '../../lib/types';
import { DocumentTemplate } from '../pdf/document-template';
import { renderPdf } from '../pdf/export';
import { docFileName } from './send-dialog';

/** Öffnet den Assistenten von überall (z. B. Seite „Erweiterungen“). */
export const ASSISTANT_EVENT = 'vysn:assistant';

/** results[k] gehört zu actions[k]; E-Mails haben bis zum Senden kein Ergebnis */
type Bubble = { role: 'user' | 'assistant'; text: string; actions?: AgentAction[]; results?: (ActionResult | null)[] };

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

function createRecognition(lang: string, continuous: boolean): Recognition | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = lang;
  r.continuous = continuous;
  r.interimResults = true;
  return r;
}

const speechLang = (country: string) => (/österreich|austria/i.test(country) ? 'de-AT' : /schweiz|switzerland/i.test(country) ? 'de-CH' : 'de-DE');

/** Möglichst natürliche deutsche Stimme des Geräts */
function pickVoice(lang: string) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const de = voices.filter((v) => v.lang.toLowerCase().startsWith('de'));
  const good = /natural|neural|online|premium|enhanced|google|siri/i;
  return de.find((v) => v.lang === lang && good.test(v.name)) || de.find((v) => good.test(v.name)) || de.find((v) => v.lang === lang) || de[0] || null;
}

const newChatId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${uid()}-${uid()}`);

export function VoiceAssistant() {
  const store = useStore();
  const { data, can, requireFeature, activeCompanyId } = store;
  const pathname = usePathname();
  const company = data.company!;
  const allowed = can('ai');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [chatId, setChatId] = useState(newChatId);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<AgentHistory>([]);
  const [pendingDone, setPendingDone] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ status: string; text: string }>({ status: '', text: '' });
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [talk, setTalk] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [monthly, setMonthly] = useState(300);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const talkRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const supported = typeof window !== 'undefined' && !!createRecognition('de-DE', true);

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
  // Firmenwechsel: neues Gespräch
  useEffect(() => { setBubbles([]); setHistory([]); setChatId(newChatId()); setChats(null); }, [activeCompanyId]);

  const persist = useCallback((next: Bubble[], messages: AgentHistory) => {
    if (!activeCompanyId || !next.length) return;
    const title = next.find((b) => b.role === 'user')?.text || 'Gespräch';
    saveChat(activeCompanyId, { id: chatId, title, messages, bubbles: next });
  }, [activeCompanyId, chatId]);

  const stopTalk = () => {
    talkRef.current = false;
    setTalk(false);
    recRef.current?.abort();
    window.speechSynthesis?.cancel();
  };

  const say = (text: string, then?: () => void) => {
    const clean = text.replace(/[*#_`>]/g, '').trim();
    if ((!speak && !talkRef.current) || !clean || !window.speechSynthesis) { then?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const lang = speechLang(company.country);
    u.lang = lang;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = 1.05;
    u.onend = () => then?.();
    window.speechSynthesis.speak(u);
  };

  /** Belege, Kunden, Zahlungen, Buchungen und Umwandlungen sofort ausführen */
  const run = async (actions: AgentAction[]): Promise<(ActionResult | null)[]> => {
    const results: (ActionResult | null)[] = [];
    let newDocId = '';
    for (const a of actions) {
      try {
        results.push(await execute(a));
      } catch (e) {
        results.push({ ok: false, label: `Fehlgeschlagen: ${(e as Error).message}` });
      }
      const last = results[results.length - 1];
      if (a.type === 'document' && last?.docId) newDocId = last.docId;
    }
    // „NEU“ in E-Mails = der eben angelegte Beleg
    actions.forEach((a) => { if (a.type === 'email' && /^neu$/i.test(a.document_id || '')) a.document_id = newDocId; });
    return results;
  };

  const execute = async (a: AgentAction): Promise<ActionResult | null> => {
    const { saveCustomer, createDoc, saveDoc, setDocStatus, saveExpense, convertDoc } = store;
    if (a.type === 'email') return null;
    if (a.type === 'document') {
      let customer: Customer | undefined = data.customers.find((c) => c.id === a.customer_id);
      let created: Customer | null = null;
      if (!customer && a.new_customer?.name) {
        const n = a.new_customer;
        created = await saveCustomer({ ...emptyCustomer(company.country), name: n.name, contactPerson: n.contact_person, email: n.email, phone: n.phone, street: n.street, zip: n.zip, city: n.city });
        if (created) customer = created;
      }
      const doc = await createDoc(a.kind, customer?.id || '');
      if (!doc) return { ok: false, label: `${DOC_KINDS[a.kind].one} nicht angelegt – das Monatslimit Ihres Tarifs ist erreicht.` };
      const items: LineItem[] = a.items.map((i) => ({
        id: uid(),
        materialId: data.materials.some((m) => m.id === i.material_id) ? i.material_id : undefined,
        description: i.description, details: i.details,
        quantity: Number(i.quantity) || 1, unit: i.unit || 'Stück', unitPrice: Number(i.unit_price) || 0,
        vat: company.smallBusiness ? 0 : Number(i.vat ?? company.defaultVat), discount: 0,
        interval: i.monthly ? 'monthly' : undefined,
      }));
      const recipient = customer
        ? { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: customer.country, vatId: customer.vatId }
        : { ...doc.recipient, name: a.recipient_name };
      saveDoc({ ...doc, customerId: customer?.id || '', subject: a.subject, items, recipient });
      return {
        ok: true,
        label: `${DOC_KINDS[a.kind].one} ${doc.number} für ${recipient.name || 'ohne Empfänger'} als Entwurf angelegt${created ? ` (neuer Kunde ${created.number})` : ''}`,
        href: docEditPath(doc), docId: doc.id, undo: { kind: 'doc', id: doc.id, extra: created?.id },
      };
    }
    if (a.type === 'customer') {
      const existing = data.customers.find((c) => c.id === a.customer_id);
      const base = existing || emptyCustomer(company.country);
      const saved = await saveCustomer({ ...base, name: a.name, contactPerson: a.contact_person, email: a.email, phone: a.phone, street: a.street, zip: a.zip, city: a.city, notes: a.notes || base.notes });
      if (!saved) return { ok: false, label: 'Kunde nicht angelegt – das Monatslimit Ihres Tarifs ist erreicht.' };
      return { ok: true, label: `Kunde ${saved.name} ${existing ? 'aktualisiert' : `angelegt (${saved.number})`}`, href: '/app/kunden', undo: existing ? null : { kind: 'customer', id: saved.id } };
    }
    if (a.type === 'payment') {
      const doc = data.documents.find((d) => d.id === a.document_id && d.kind === 'invoice');
      if (!doc) return { ok: false, label: 'Rechnung nicht gefunden.' };
      if (doc.status === 'paid') return { ok: true, label: `Rechnung ${doc.number} war bereits bezahlt` };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(a.paid_date) ? a.paid_date : today();
      setDocStatus(doc.id, 'paid', date);
      return { ok: true, label: `Rechnung ${doc.number} als bezahlt markiert (${formatDate(date)})`, href: docEditPath(doc), undo: { kind: 'payment', id: doc.id, extra: doc.status } };
    }
    if (a.type === 'expense') {
      const vat = company.smallBusiness && a.kind === 'income' ? 0 : Number(a.vat) || 0;
      const id = uid();
      const ok = saveExpense({ id, kind: a.kind, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : today(), supplier: a.supplier, description: a.description, category: a.category, net: round2((Number(a.gross) || 0) / (1 + vat / 100)), vat, receiptNo: '' });
      if (!ok) return { ok: false, label: 'Nicht gebucht – das Monatslimit Ihres Tarifs ist erreicht.' };
      return { ok: true, label: `${a.kind === 'income' ? 'Einnahme' : 'Ausgabe'} „${a.description}“ über ${String(a.gross).replace('.', ',')} € gebucht`, href: a.kind === 'income' ? '/app/ausgaben?art=einnahmen' : '/app/ausgaben', undo: { kind: 'expense', id } };
    }
    if (a.type === 'convert') {
      const src = data.documents.find((d) => d.id === a.document_id);
      if (!src) return { ok: false, label: 'Beleg nicht gefunden.' };
      const doc = await convertDoc(src.id, a.target_kind);
      if (!doc) return { ok: false, label: `${DOC_KINDS[a.target_kind].one} nicht angelegt – das Monatslimit Ihres Tarifs ist erreicht.` };
      return { ok: true, label: `${DOC_KINDS[src.kind].one} ${src.number} → ${DOC_KINDS[a.target_kind].one} ${doc.number} (Entwurf)`, href: docEditPath(doc), docId: doc.id, undo: { kind: 'doc', id: doc.id } };
    }
    return null;
  };

  const undo = (bi: number, k: number) => {
    const r = bubbles[bi]?.results?.[k];
    if (!r?.undo || r.undone) return;
    const u = r.undo;
    if (u.kind === 'doc') {
      const doc = data.documents.find((d) => d.id === u.id);
      if (doc && doc.status !== 'draft') { window.alert('Der Beleg ist bereits festgeschrieben und kann nicht mehr gelöscht werden.'); return; }
      store.deleteDoc(u.id);
      if (u.extra && !data.documents.some((d) => d.customerId === u.extra && d.id !== u.id)) store.deleteCustomer(u.extra);
    } else if (u.kind === 'customer') {
      if (data.documents.some((d) => d.customerId === u.id)) { window.alert('Der Kunde hat inzwischen Belege und wird nicht gelöscht.'); return; }
      store.deleteCustomer(u.id);
    } else if (u.kind === 'payment') {
      store.setDocStatus(u.id, (u.extra as 'sent') || 'sent');
    } else if (u.kind === 'expense') {
      store.deleteExpense(u.id);
    }
    const next = bubbles.map((b, i) => (i === bi ? { ...b, results: b.results?.map((x, j) => (j === k && x ? { ...x, undone: true } : x)) } : b));
    setBubbles(next);
    setPendingDone((p) => [...p, `Rückgängig gemacht: ${r.label}`]);
    persist(next, history);
  };

  const emailSent = (bi: number, k: number, to: string) => {
    const next = bubbles.map((b, i) => (i === bi ? { ...b, results: (b.actions || []).map((_, j) => (j === k ? { ok: true, label: `E-Mail gesendet an ${to}` } : b.results?.[j] ?? null)) } : b));
    setBubbles(next);
    setPendingDone((p) => [...p, `E-Mail gesendet an ${to}`]);
    persist(next, history);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || !activeCompanyId) return;
    setInput('');
    const withUser: Bubble[] = [...bubbles, { role: 'user', text }];
    setBubbles(withUser);
    setBusy(true);
    try {
      setLive({ status: '', text: '' });
      const r = await askAgent(activeCompanyId, history, text, (e) => {
        if (e.type === 'status') setLive((l) => ({ ...l, status: e.text }));
        else if (e.type === 'delta') setLive((l) => ({ status: '', text: l.text + e.text }));
        else setLive((l) => ({ ...l, text: l.text ? `${l.text}\n` : '' }));
      }, pendingDone);
      setPendingDone([]);
      if (typeof r.remaining === 'number') setRemaining(r.remaining);
      const actions = r.actions ?? (r.proposal ? [{ type: 'document' as const, ...r.proposal }] : []);
      setLive({ status: actions.length ? 'Speichere …' : '', text: '' });
      const results = await run(actions);
      const done = results.filter((x): x is ActionResult => !!x && x.ok).map((x) => (x.docId ? `${x.label} [id ${x.docId}]` : x.label));
      if (done.length) setPendingDone(done);
      const reply = r.reply || (done.length ? `Erledigt: ${done.map((d) => d.replace(/ \[id [^\]]+\]$/, '')).join('. ')}.` : actions.length ? 'Ich habe Ihnen einen Entwurf vorbereitet.' : '');
      const next: Bubble[] = [...withUser, { role: 'assistant', text: reply, actions, results }];
      setBubbles(next);
      setHistory(r.messages);
      persist(next, r.messages);
      // Gesprächsmodus: nach dem Vorlesen automatisch wieder zuhören
      say(reply, () => { if (talkRef.current) listen(); });
    } catch (e) {
      if (e instanceof AgentError && e.upgrade) { setOpen(false); requireFeature('ai'); return; }
      setBubbles((b) => [...b, { role: 'assistant', text: (e as Error).message }]);
      stopTalk();
    } finally {
      setBusy(false);
      setLive({ status: '', text: '' });
    }
  };

  const listen = () => {
    window.speechSynthesis?.cancel();
    const r = createRecognition(speechLang(company.country), !talkRef.current);
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
      if (e.error === 'not-allowed') { setBubbles((b) => [...b, { role: 'assistant', text: 'Bitte erlauben Sie den Zugriff auf das Mikrofon in Ihrem Browser.' }]); stopTalk(); }
    };
    r.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.trim();
      if (text) send(text);
      else if (talkRef.current) stopTalk();
    };
    recRef.current = r;
    setListening(true);
    r.start();
  };

  const toggleMic = () => { if (listening) recRef.current?.stop(); else listen(); };

  const toggleTalk = () => {
    if (talk) { stopTalk(); return; }
    talkRef.current = true;
    setTalk(true);
    say(bubbles.length ? 'Ich höre.' : 'Hallo! Was kann ich für Sie tun?', () => { if (talkRef.current) listen(); });
  };

  const newChat = () => {
    stopTalk();
    setBubbles([]);
    setHistory([]);
    setPendingDone([]);
    setInput('');
    setChatId(newChatId());
    setView('chat');
  };

  const openHistory = async () => {
    setView('history');
    if (activeCompanyId) setChats(await listChats(activeCompanyId));
  };

  const openChat = async (id: string) => {
    const c = await loadChat<Bubble>(id);
    if (!c) return;
    stopTalk();
    setChatId(c.id);
    setBubbles(c.bubbles || []);
    setHistory(c.messages || []);
    setPendingDone([]);
    setView('chat');
  };

  const removeChat = async (id: string) => {
    if (!window.confirm('Gespräch löschen?')) return;
    await deleteChat(id);
    setChats((c) => (c || []).filter((x) => x.id !== id));
    if (id === chatId) newChat();
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
              <div><strong>Assistent</strong><small>{talk ? (listening ? 'Ich höre zu …' : busy ? 'Ich denke nach …' : 'Gesprächsmodus') : 'Ihre digitale Bürokraft'}</small></div>
              {supported ? <button className={`icon-btn${talk ? ' active' : ''}`} onClick={toggleTalk} title={talk ? 'Gespräch beenden' : 'Gespräch führen (freihändig)'} aria-label="Gesprächsmodus"><AudioLines size={17} /></button> : null}
              <button className="icon-btn" onClick={() => { setSpeak(!speak); window.speechSynthesis?.cancel(); }} title={speak ? 'Vorlesen aus' : 'Vorlesen an'} aria-label="Vorlesen umschalten">{speak ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
              <button className="icon-btn" onClick={view === 'history' ? () => setView('chat') : openHistory} title="Verlauf" aria-label="Verlauf"><History size={17} /></button>
              <button className="icon-btn" onClick={newChat} title="Neues Gespräch" aria-label="Neues Gespräch"><Plus size={17} /></button>
              <button className="icon-btn" onClick={() => { stopTalk(); setOpen(false); }} aria-label="Schließen"><X size={18} /></button>
            </header>

            {view === 'history' ? (
              <div className="assistant-list">
                <p className="assistant-history-title">Frühere Gespräche</p>
                {chats === null ? <p className="muted"><Loader2 size={15} className="spin" /> Lade …</p> : !chats.length ? <p className="muted">Noch keine gespeicherten Gespräche.</p> : chats.map((c) => (
                  <div key={c.id} className={`assistant-chat-row${c.id === chatId ? ' on' : ''}`}>
                    <button onClick={() => openChat(c.id)}><strong>{c.title}</strong><small>{formatDate(c.updated_at.slice(0, 10))}</small></button>
                    <button className="icon-btn" onClick={() => removeChat(c.id)} aria-label="Gespräch löschen"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="assistant-list" ref={listRef}>
                {!bubbles.length ? (
                  <div className="assistant-intro">
                    <button className="btn btn-primary assistant-briefing" onClick={() => send('Was steht heute an? Bitte ein kurzes Tagesbriefing.')}><Sun size={17} /> Was steht heute an?</button>
                    <p><strong>Sagen Sie einfach, was zu tun ist.</strong> Zum Beispiel:</p>
                    {['Neue Rechnung für Bäckerei Huber, Hauptstraße 5 in Linz: 3 Stunden Arbeit à 65 Euro', 'Schreib allen mit überfälligen Rechnungen eine freundliche Zahlungserinnerung', 'Gibt es neue Anfragen im Posteingang?', 'Tankrechnung 85 Euro von heute buchen', 'Wie läuft mein Geschäft dieses Jahr?'].map((t) => (
                      <button key={t} className="assistant-example" onClick={() => send(t)}>„{t}“</button>
                    ))}
                    <p className="muted small">Ich lege Belege, Kunden und Buchungen direkt an (rückgängig machbar), schreibe E-Mails an Ihre Kunden, lese Ihren Posteingang und gebe Tipps zu Ihren Zahlen. E-Mails gehen erst raus, wenn Sie auf „Senden“ tippen.{supported ? ' Mit dem Wellen-Symbol oben führen Sie ein Gespräch – ganz ohne Tippen.' : ''}</p>
                  </div>
                ) : null}
                {bubbles.map((b, i) => (
                  <div key={i} className={`assistant-msg from-${b.role === 'user' ? 'user' : 'ai'}`}>
                    {b.text ? <p>{b.text}</p> : null}
                    {(b.actions || []).map((a, k) => (a.type === 'email'
                      ? <EmailCard key={k} p={a} sent={b.results?.[k]?.label} onSent={(to) => emailSent(i, k, to)} />
                      : <ResultCard key={k} r={b.results?.[k] ?? null} onUndo={() => undo(i, k)} onOpen={() => setOpen(false)} />))}
                  </div>
                ))}
                {busy ? (
                  <div className="assistant-msg from-ai">
                    {live.text ? <p>{live.text}</p> : null}
                    {!live.text || live.status ? <p className="assistant-typing"><Loader2 size={15} className="spin" /> {live.status || 'Einen Moment …'}</p> : null}
                  </div>
                ) : null}
              </div>
            )}

            {view === 'chat' ? (
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
            ) : null}
            {remaining !== null ? <p className="assistant-quota">{remaining ? `Noch ${remaining} von ${monthly} Aufgaben in diesem Monat` : 'Monatsguthaben aufgebraucht – am 1. geht es weiter'}</p> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

/** Sofort ausgeführte Aktion: was angelegt wurde, mit Öffnen und Rückgängig */
function ResultCard({ r, onUndo, onOpen }: { r: ActionResult | null; onUndo: () => void; onOpen: () => void }) {
  if (!r) return null;
  return (
    <div className={`action-result${r.ok ? '' : ' failed'}${r.undone ? ' undone' : ''}`}>
      {r.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span>{r.undone ? <s>{r.label}</s> : r.label}{r.undone ? ' – rückgängig gemacht' : ''}</span>
      {r.ok && !r.undone && r.href ? <Link href={r.href} onClick={onOpen} className="link">Öffnen</Link> : null}
      {r.ok && !r.undone && r.undo ? <button className="link" onClick={onUndo}><Undo2 size={13} /> Rückgängig</button> : null}
    </div>
  );
}

function EmailCard({ p, sent, onSent }: { p: EmailProposal; sent?: string; onSent: (to: string) => void }) {
  const { data, design, activeCompanyId, markSent, setDocStatus } = useStore();
  const company = data.company!;
  const doc = data.documents.find((d) => d.id === p.document_id);
  const customer = data.customers.find((c) => c.id === (p.customer_id || doc?.customerId));
  const [to, setTo] = useState(p.to || customer?.email || '');
  const [subject, setSubject] = useState(p.subject);
  const [text, setText] = useState(p.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = !!sent;
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (doc && doc.kind === 'invoice' && doc.status === 'draft') setDocStatus(doc.id, 'sent');
      const pdf = doc ? await renderPdf(<DocumentTemplate company={company} doc={doc} design={design} customerNumber={customer?.number} />) : undefined;
      await sendMail({ to, subject, text, fromName: company.name, replyTo: company.email, bcc: data.settings.email.bcc, pdf, fileName: doc ? docFileName(doc) : undefined, companyId: activeCompanyId, inReplyTo: p.in_reply_to });
      if (doc) markSent(doc.id, to);
      onSent(to);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="proposal">
      <div className="proposal-head"><strong><Mail size={14} /> E-Mail-Entwurf</strong><span>{p.purpose}</span></div>
      <label className="proposal-field"><span>An</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="E-Mail-Adresse" disabled={done} /></label>
      <label className="proposal-field"><span>Betreff</span><input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={done} /></label>
      <textarea className="proposal-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={done} />
      {doc ? <small className="muted"><Paperclip size={12} /> {DOC_KINDS[doc.kind].one} {doc.number} als PDF</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
      <button className="btn btn-primary" disabled={done || busy || !to.trim() || !subject.trim()} onClick={submit}>
        {done ? <><Check size={16} /> {sent}</> : busy ? <><Loader2 size={16} className="spin" /> Wird gesendet …</> : <><Send size={16} /> Jetzt senden</>}
      </button>
    </div>
  );
}
