'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock, Mic, MicOff, RotateCcw, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { AgentError, agentStatus, askAgent } from '../../lib/agent';
import type { AgentHistory, AgentProposal } from '../../lib/agent';
import { docTotals, money, qty, uid } from '../../lib/calc';
import { DOC_KINDS, docEditPath } from '../../lib/docs';
import { useStore } from '../../lib/store';
import type { LineItem } from '../../lib/types';

/** Öffnet den Assistenten von überall (z. B. Seite „Erweiterungen“). */
export const ASSISTANT_EVENT = 'vysn:assistant';

type Bubble = { role: 'user' | 'assistant'; text: string; proposal?: AgentProposal | null; done?: boolean };

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
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const listRef = useRef<HTMLDivElement>(null);
  const supported = typeof window !== 'undefined' && !!createRecognition('de-DE');

  // Ohne API-Schlüssel auf dem Server bleibt der Assistent unsichtbar (keine Kosten)
  useEffect(() => { agentStatus().then((s) => setEnabled(s.enabled)); }, []);
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
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [bubbles, busy]);
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
      const r = await askAgent(activeCompanyId, history, text);
      setHistory(r.messages);
      if (typeof r.remaining === 'number') setRemaining(r.remaining);
      const reply = r.reply || (r.proposal ? 'Hier ist mein Vorschlag. Passt das so?' : '');
      setBubbles((b) => [...b, { role: 'assistant', text: reply, proposal: r.proposal }]);
      say(reply);
    } catch (e) {
      if (e instanceof AgentError && e.upgrade) { setOpen(false); requireFeature('ai'); return; }
      setBubbles((b) => [...b, { role: 'assistant', text: (e as Error).message }]);
    } finally {
      setBusy(false);
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
  const accept = async (index: number, p: AgentProposal) => {
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
    }));
    saveDoc({
      ...doc,
      subject: p.subject,
      items,
      recipient: customer ? doc.recipient : { ...doc.recipient, name: p.recipient_name },
    });
    setBubbles((b) => b.map((x, i) => (i === index ? { ...x, done: true } : x)));
    setOpen(false);
    router.push(docEditPath(doc));
  };

  if (!enabled) return null;

  return (
    <>
      <button className={`assistant-fab${allowed ? '' : ' locked'}`} onClick={show} aria-label="KI-Sprachassistent öffnen" title="KI-Sprachassistent">
        {allowed ? <Mic size={22} /> : <Lock size={18} />}
        <span>KI</span>
      </button>
      {open ? (
        <div className="assistant-backdrop" onClick={() => setOpen(false)}>
          <aside className="assistant" role="dialog" aria-label="KI-Sprachassistent" onClick={(e) => e.stopPropagation()}>
            <header className="assistant-head">
              <span className="assistant-badge"><Sparkles size={16} /></span>
              <div><strong>KI-Sprachassistent</strong><small>Diktieren, prüfen, übernehmen</small></div>
              <button className="icon-btn" onClick={() => setSpeak(!speak)} title={speak ? 'Vorlesen aus' : 'Vorlesen an'} aria-label="Vorlesen umschalten">{speak ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
              <button className="icon-btn" onClick={reset} title="Neu beginnen" aria-label="Neu beginnen"><RotateCcw size={17} /></button>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Schließen"><X size={18} /></button>
            </header>

            <div className="assistant-list" ref={listRef}>
              {!bubbles.length ? (
                <div className="assistant-intro">
                  <p><strong>Sagen Sie einfach, was Sie brauchen.</strong> Zum Beispiel:</p>
                  {['Neues Angebot für Herrn Müller: zwei Steckdosen von Gira und Arbeit pauschal 20 Euro', 'Wie viel Umsatz habe ich diesen Monat gemacht?', 'Welche Rechnungen sind noch offen?', 'Tipp: Wie gehe ich mit einem Kunden um, der nicht zahlt?'].map((t) => (
                    <button key={t} className="assistant-example" onClick={() => send(t)}>„{t}“</button>
                  ))}
                  <p className="muted small">Ich erstelle Belege, beantworte Fragen zu Ihren Zahlen und gebe Tipps. Kunden und Artikel suche ich selbst heraus, frage bei Unklarheiten nach und lege erst nach Ihrer Bestätigung etwas an.</p>
                </div>
              ) : null}
              {bubbles.map((b, i) => (
                <div key={i} className={`assistant-msg from-${b.role === 'user' ? 'user' : 'ai'}`}>
                  {b.text ? <p>{b.text}</p> : null}
                  {b.proposal ? <ProposalCard p={b.proposal} done={!!b.done} onAccept={() => accept(i, b.proposal!)} /> : null}
                </div>
              ))}
              {busy ? <div className="assistant-msg from-ai"><p className="assistant-typing"><Loader2 size={15} className="spin" /> Einen Moment …</p></div> : null}
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
            {remaining !== null && remaining <= 5 ? <p className="assistant-quota">{remaining ? `Heute noch ${remaining} ${remaining === 1 ? 'Anfrage' : 'Anfragen'}` : 'Tageslimit erreicht – morgen geht es weiter'}</p> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ProposalCard({ p, done, onAccept }: { p: AgentProposal; done: boolean; onAccept: () => void }) {
  const { data } = useStore();
  const small = !!data.company?.smallBusiness;
  const customer = data.customers.find((c) => c.id === p.customer_id);
  const totals = docTotals(p.items.map((i) => ({ id: '', description: i.description, details: '', quantity: i.quantity, unit: i.unit, unitPrice: i.unit_price, vat: small ? 0 : i.vat, discount: 0 })), small);
  const cfg = DOC_KINDS[p.kind] || DOC_KINDS.offer;
  return (
    <div className="proposal">
      <div className="proposal-head"><strong>{cfg.one}</strong><span>{customer?.name || p.recipient_name || 'Ohne Empfänger'}{customer ? '' : p.recipient_name ? ' (neu)' : ''}</span></div>
      {p.subject ? <small className="muted">{p.subject}</small> : null}
      <ul>
        {p.items.map((i, k) => (
          <li key={k}><span>{qty(i.quantity)} {i.unit} {i.description}{i.material_id ? '' : ' *'}</span>{cfg.prices ? <b>{money(i.quantity * i.unit_price)}</b> : null}</li>
        ))}
      </ul>
      {cfg.prices ? <div className="proposal-sum"><span>{small ? 'Summe' : 'Summe netto'}</span><b>{money(totals.net)}</b></div> : null}
      {p.items.some((i) => !i.material_id) ? <small className="muted">* freie Position (nicht aus dem Materialstamm)</small> : null}
      <button className="btn btn-primary" disabled={done} onClick={onAccept}>{done ? <><Check size={16} /> Übernommen</> : <><Check size={16} /> Als Entwurf übernehmen</>}</button>
    </div>
  );
}
