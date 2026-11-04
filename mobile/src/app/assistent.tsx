import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import {
  AudioLines, Check, CheckCircle2, History, Lock, Mail, Mic, MicOff, Paperclip, Plus, Send, Sparkles, Sun, Trash2, Undo2, Volume2, VolumeX, XCircle,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Empty, s } from '../components/ui';
import * as A from '../lib/actions';
import { confirm, notify } from '../lib/confirm';
import { sendMail } from '../lib/mail';
import { docFileName, docPdfBase64 } from '../lib/pdf';
import { useStore } from '../lib/store';
import { SITE_URL, supabase } from '../lib/supabase';
import { C } from '../lib/theme';
import { formatDate, round2, today, uid } from '../shared/calc';
import { emptyCustomer } from '../shared/defaults';
import { DOC_KINDS } from '../shared/docs';
import { countUsage, usageQuota } from '../shared/plans';
import type { Customer, DocKind, LineItem } from '../shared/types';

type NewCustomer = { name: string; contact_person: string; email: string; phone: string; street: string; zip: string; city: string };
type Proposal = {
  kind: DocKind; customer_id: string; recipient_name: string; subject: string; new_customer?: NewCustomer | null;
  items: { material_id: string; description: string; details: string; quantity: number; unit: string; unit_price: number; vat: number; monthly?: boolean }[];
};
type EmailProposal = { to: string; customer_id: string; subject: string; text: string; document_id: string; in_reply_to: string; purpose: string };
type CustomerProposal = { customer_id: string; name: string; contact_person: string; email: string; phone: string; street: string; zip: string; city: string; notes: string };
type Action =
  | ({ type: 'document' } & Proposal)
  | ({ type: 'email' } & EmailProposal)
  | ({ type: 'customer' } & CustomerProposal)
  | ({ type: 'payment' } & { document_id: string; paid_date: string })
  | ({ type: 'expense' } & { kind: 'expense' | 'income'; date: string; supplier: string; description: string; category: string; gross: number; vat: number })
  | ({ type: 'convert' } & { document_id: string; target_kind: 'confirmation' | 'delivery' | 'invoice' });
type Result = { ok: boolean; label: string; docId?: string; customerId?: string; undo?: { kind: 'doc' | 'customer' | 'payment' | 'expense'; id: string; extra?: string } | null; undone?: boolean };
type Bubble = { role: 'user' | 'ai'; text: string; actions?: Action[]; results?: (Result | null)[] };
type ChatRow = { id: string; title: string; updated_at: string };

const speechLang = (country = '') => (/österreich|austria/i.test(country) ? 'de-AT' : /schweiz|switzerland/i.test(country) ? 'de-CH' : 'de-DE');
const newId = () => {
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
};
const EXAMPLES = [
  'Neue Rechnung für Bäckerei Huber, Hauptstraße 5 in Linz: 3 Stunden Arbeit à 65 Euro',
  'Schreib allen mit überfälligen Rechnungen eine freundliche Zahlungserinnerung',
  'Gibt es neue Anfragen im Posteingang?',
  'Tankrechnung 85 Euro von heute buchen',
  'Wie läuft mein Geschäft dieses Jahr?',
];

/** Assistent (Zusatzbuchung) – gleiche Logik wie auf der Website (/api/agent) */
export default function Assistant() {
  const store = useStore();
  const { data, companyId, aiBooked, commit } = store;
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [chatId, setChatId] = useState(newId);
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [pendingDone, setPendingDone] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [talk, setTalk] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [monthly, setMonthly] = useState(300);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [voice, setVoice] = useState<string | undefined>();
  const transcript = useRef('');
  const talkRef = useRef(false);
  const sendRef = useRef<(t: string) => void>(() => {});
  const scroll = useRef<ScrollView>(null);
  const company = data.company;

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || '';
      const j = await fetch(`${SITE_URL}/api/agent${companyId ? `?companyId=${companyId}` : ''}`, { headers: { authorization: `Bearer ${token}`, 'x-vysn-token': token } }).then((r) => r.json());
      setEnabled(!!j.enabled);
      if (j.monthlyLimit) setMonthly(j.monthlyLimit);
      if (typeof j.remaining === 'number') setRemaining(j.remaining);
    })().catch(() => setEnabled(false));
  }, [companyId]);
  // Beste deutsche Stimme des Geräts (verbesserte Qualität bevorzugt)
  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((voices) => {
      const lang = speechLang(company?.country);
      const de = voices.filter((v) => v.language.toLowerCase().replace('_', '-').startsWith('de'));
      const pick = de.find((v) => v.language.replace('_', '-') === lang && v.quality === Speech.VoiceQuality.Enhanced) || de.find((v) => v.quality === Speech.VoiceQuality.Enhanced) || de.find((v) => v.language.replace('_', '-') === lang);
      setVoice(pick?.identifier);
    }).catch(() => {});
  }, [company?.country]);
  useEffect(() => () => { Speech.stop(); ExpoSpeechRecognitionModule.abort(); }, []);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('result', (e) => { transcript.current = e.results[0]?.transcript || ''; setInput(transcript.current); });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const text = transcript.current.trim();
    transcript.current = '';
    if (text) sendRef.current(text);
    else if (talkRef.current) stopTalk();
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error === 'not-allowed') { add({ role: 'ai', text: 'Bitte erlauben Sie Mikrofon und Spracherkennung in den Einstellungen Ihres Geräts.' }); stopTalk(); }
  });

  const add = (b: Bubble) => { setBubbles((x) => [...x, b]); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); };

  const persist = (next: Bubble[], messages: unknown[]) => {
    if (!companyId || !next.length) return;
    const title = (next.find((b) => b.role === 'user')?.text || 'Gespräch').slice(0, 120);
    supabase.from('assistant_chats').upsert({ id: chatId, company_id: companyId, title, messages, bubbles: next, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.warn('Chat nicht gespeichert', error.message); });
  };

  const stopTalk = () => { talkRef.current = false; setTalk(false); Speech.stop(); ExpoSpeechRecognitionModule.abort(); };

  const say = (text: string, then?: () => void) => {
    const clean = text.replace(/[*#_`>]/g, '').trim();
    if ((!speak && !talkRef.current) || !clean) { then?.(); return; }
    Speech.stop();
    Speech.speak(clean, { language: speechLang(company?.country), voice, rate: 1.02, onDone: () => then?.() });
  };

  const listen = async () => {
    Speech.stop();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) { add({ role: 'ai', text: 'Bitte erlauben Sie Mikrofon und Spracherkennung in den Einstellungen Ihres Geräts.' }); stopTalk(); return; }
    transcript.current = '';
    ExpoSpeechRecognitionModule.start({ lang: speechLang(company?.country), interimResults: true, continuous: false });
  };

  /** Belege, Kunden, Zahlungen, Buchungen und Umwandlungen sofort ausführen */
  const execute = async (a: Action): Promise<Result | null> => {
    if (!company) return null;
    if (a.type === 'email') return null;
    if (a.type === 'document') {
      let customer: Customer | undefined = data.customers.find((c) => c.id === a.customer_id);
      let created: Customer | null = null;
      if (!customer && a.new_customer?.name) {
        const n = a.new_customer;
        created = await store.saveCustomer({ ...emptyCustomer(company.country), name: n.name, contactPerson: n.contact_person, email: n.email, phone: n.phone, street: n.street, zip: n.zip, city: n.city });
        if (created) customer = created;
      }
      const doc = await store.createDoc(a.kind, customer?.id || '');
      if (!doc) return { ok: false, label: `${DOC_KINDS[a.kind].one} nicht angelegt – das Monatslimit Ihres Tarifs ist erreicht.` };
      const items: LineItem[] = a.items.map((i) => ({
        id: uid(),
        materialId: data.materials.some((m) => m.id === i.material_id) ? i.material_id : undefined,
        description: i.description, details: i.details, quantity: Number(i.quantity) || 1, unit: i.unit || 'Stück',
        unitPrice: Number(i.unit_price) || 0, vat: company.smallBusiness ? 0 : Number(i.vat ?? company.defaultVat), discount: 0,
        interval: i.monthly ? 'monthly' : undefined,
      }));
      const recipient = customer
        ? { name: customer.name, contactPerson: customer.contactPerson, street: customer.street, zip: customer.zip, city: customer.city, country: customer.country, vatId: customer.vatId }
        : { ...doc.recipient, name: a.recipient_name };
      commit((d) => A.saveDoc(d, { ...doc, customerId: customer?.id || '', subject: a.subject, items, recipient }));
      return { ok: true, label: `${DOC_KINDS[a.kind].one} ${doc.number} für ${recipient.name || 'ohne Empfänger'} als Entwurf angelegt${created ? ` (neuer Kunde ${created.number})` : ''}`, docId: doc.id, undo: { kind: 'doc', id: doc.id, extra: created?.id } };
    }
    if (a.type === 'customer') {
      const existing = data.customers.find((c) => c.id === a.customer_id);
      const base = existing || emptyCustomer(company.country);
      const saved = await store.saveCustomer({ ...base, name: a.name, contactPerson: a.contact_person, email: a.email, phone: a.phone, street: a.street, zip: a.zip, city: a.city, notes: a.notes || base.notes });
      if (!saved) return { ok: false, label: 'Kunde nicht angelegt – das Monatslimit Ihres Tarifs ist erreicht.' };
      return { ok: true, label: `Kunde ${saved.name} ${existing ? 'aktualisiert' : `angelegt (${saved.number})`}`, customerId: saved.id, undo: existing ? null : { kind: 'customer', id: saved.id } };
    }
    if (a.type === 'payment') {
      const doc = data.documents.find((d) => d.id === a.document_id && d.kind === 'invoice');
      if (!doc) return { ok: false, label: 'Rechnung nicht gefunden.' };
      if (doc.status === 'paid') return { ok: true, label: `Rechnung ${doc.number} war bereits bezahlt` };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(a.paid_date) ? a.paid_date : today();
      commit((d) => A.setDocStatus(d, doc.id, 'paid', date));
      return { ok: true, label: `Rechnung ${doc.number} als bezahlt markiert (${formatDate(date)})`, docId: doc.id, undo: { kind: 'payment', id: doc.id, extra: doc.status } };
    }
    if (a.type === 'expense') {
      if (usageQuota(data, 'booking').reached) return { ok: false, label: 'Nicht gebucht – das Monatslimit Ihres Tarifs ist erreicht.' };
      const vat = Number(a.vat) || 0;
      const id = uid();
      const expense = { id, kind: a.kind, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : today(), supplier: a.supplier, description: a.description, category: a.category, net: round2((Number(a.gross) || 0) / (1 + vat / 100)), vat, receiptNo: '' };
      commit((d) => countUsage({ ...d, expenses: [expense, ...d.expenses] }, 'booking'));
      return { ok: true, label: `${a.kind === 'income' ? 'Einnahme' : 'Ausgabe'} „${a.description}“ über ${String(a.gross).replace('.', ',')} € gebucht`, undo: { kind: 'expense', id } };
    }
    if (a.type === 'convert') {
      const src = data.documents.find((d) => d.id === a.document_id);
      if (!src) return { ok: false, label: 'Beleg nicht gefunden.' };
      const doc = await store.convertDoc(src.id, a.target_kind);
      if (!doc) return { ok: false, label: `${DOC_KINDS[a.target_kind].one} nicht angelegt – das Monatslimit Ihres Tarifs ist erreicht.` };
      return { ok: true, label: `${DOC_KINDS[src.kind].one} ${src.number} → ${DOC_KINDS[a.target_kind].one} ${doc.number} (Entwurf)`, docId: doc.id, undo: { kind: 'doc', id: doc.id } };
    }
    return null;
  };

  const run = async (actions: Action[]) => {
    const results: (Result | null)[] = [];
    let newDocId = '';
    for (const a of actions) {
      try { results.push(await execute(a)); } catch (e) { results.push({ ok: false, label: `Fehlgeschlagen: ${(e as Error).message}` }); }
      const last = results[results.length - 1];
      if (a.type === 'document' && last?.docId) newDocId = last.docId;
    }
    actions.forEach((a) => { if (a.type === 'email' && /^neu$/i.test(a.document_id || '')) a.document_id = newDocId; });
    return results;
  };

  const undo = (bi: number, k: number) => {
    const r = bubbles[bi]?.results?.[k];
    if (!r?.undo || r.undone) return;
    const u = r.undo;
    if (u.kind === 'doc') {
      const doc = data.documents.find((d) => d.id === u.id);
      if (doc && doc.status !== 'draft') { notify('Nicht möglich', 'Der Beleg ist bereits festgeschrieben.'); return; }
      commit((d) => {
        const next = A.deleteDoc(d, u.id);
        return u.extra && !next.documents.some((x) => x.customerId === u.extra) ? { ...next, customers: next.customers.filter((c) => c.id !== u.extra) } : next;
      });
    } else if (u.kind === 'customer') {
      if (data.documents.some((d) => d.customerId === u.id)) { notify('Nicht möglich', 'Der Kunde hat inzwischen Belege.'); return; }
      commit((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== u.id) }));
    } else if (u.kind === 'payment') {
      commit((d) => A.setDocStatus(d, u.id, (u.extra as 'sent') || 'sent'));
    } else if (u.kind === 'expense') {
      commit((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== u.id) }));
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
    if (!text || busy || !companyId) return;
    setInput('');
    const withUser: Bubble[] = [...bubbles, { role: 'user', text }];
    setBubbles(withUser);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    setBusy(true);
    setStatus('Einen Moment …');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || '';
      const res = await fetch(`${SITE_URL}/api/agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-vysn-token': token },
        body: JSON.stringify({ companyId, history, text, done: pendingDone, v: 2 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Der Assistent ist gerade nicht erreichbar.');
      setPendingDone([]);
      if (typeof json.remaining === 'number') setRemaining(json.remaining);
      const actions: Action[] = json.actions ?? (json.proposal ? [{ type: 'document', ...json.proposal }] : []);
      if (actions.length) setStatus('Speichere …');
      const results = await run(actions);
      const done = results.filter((x): x is Result => !!x && x.ok).map((x) => (x.docId ? `${x.label} [id ${x.docId}]` : x.label));
      if (done.length) setPendingDone(done);
      const reply = json.reply || (done.length ? `Erledigt: ${done.map((d) => d.replace(/ \[id [^\]]+\]$/, '')).join('. ')}.` : actions.length ? 'Ich habe Ihnen einen Entwurf vorbereitet.' : '');
      const next: Bubble[] = [...withUser, { role: 'ai', text: reply, actions, results }];
      setBubbles(next);
      setHistory(json.messages);
      persist(next, json.messages);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
      say(reply, () => { if (talkRef.current) listen(); });
    } catch (e) {
      add({ role: 'ai', text: (e as Error).message });
      stopTalk();
    } finally {
      setBusy(false);
      setStatus('');
    }
  };
  sendRef.current = send;

  const mic = () => { if (listening) ExpoSpeechRecognitionModule.stop(); else listen(); };

  const toggleTalk = () => {
    if (talk) { stopTalk(); return; }
    talkRef.current = true;
    setTalk(true);
    say(bubbles.length ? 'Ich höre.' : 'Hallo! Was kann ich für Sie tun?', () => { if (talkRef.current) listen(); });
  };

  const newChat = () => { stopTalk(); setBubbles([]); setHistory([]); setPendingDone([]); setInput(''); setChatId(newId()); setView('chat'); };

  const openHistory = async () => {
    setView('history');
    if (!companyId) return;
    const { data: rows } = await supabase.from('assistant_chats').select('id, title, updated_at').eq('company_id', companyId).order('updated_at', { ascending: false }).limit(50);
    setChats((rows as ChatRow[]) || []);
  };

  const openChat = async (id: string) => {
    const { data: c } = await supabase.from('assistant_chats').select('id, messages, bubbles').eq('id', id).maybeSingle();
    if (!c) return;
    stopTalk();
    setChatId(c.id);
    setBubbles((c.bubbles as Bubble[]) || []);
    setHistory((c.messages as unknown[]) || []);
    setPendingDone([]);
    setView('chat');
  };

  const removeChat = (id: string) => confirm('Gespräch löschen?', undefined, 'Löschen', async () => {
    await supabase.from('assistant_chats').delete().eq('id', id);
    setChats((c) => (c || []).filter((x) => x.id !== id));
    if (id === chatId) newChat();
  }, true);

  if (enabled === false || !aiBooked) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}>
        <Empty icon={enabled === false ? Sparkles : Lock} title={enabled === false ? 'Demnächst verfügbar' : 'Nicht gebucht'}
          text={enabled === false
            ? 'Der Assistent wird gerade eingerichtet.'
            : 'Der Assistent ist eine Zusatzbuchung und für diese Firma nicht freigeschaltet. Zusatzbuchungen lassen sich in der App nicht buchen oder ändern.'} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
      <View style={st.tools}>
        <Text style={[s.mutedSmall, { flex: 1 }]}>{talk ? (listening ? 'Ich höre zu …' : busy ? 'Ich denke nach …' : 'Gesprächsmodus') : ''}</Text>
        <Pressable onPress={toggleTalk} hitSlop={10} style={[st.toolBtn, talk && { backgroundColor: C.primary }]} accessibilityLabel="Gesprächsmodus"><AudioLines size={20} color={talk ? '#fff' : C.ink2} /></Pressable>
        <Pressable onPress={() => { setSpeak(!speak); Speech.stop(); }} hitSlop={10} style={st.toolBtn}>{speak ? <Volume2 size={20} color={C.ink2} /> : <VolumeX size={20} color={C.ink2} />}</Pressable>
        <Pressable onPress={view === 'history' ? () => setView('chat') : openHistory} hitSlop={10} style={st.toolBtn} accessibilityLabel="Verlauf"><History size={20} color={view === 'history' ? C.primary : C.ink2} /></Pressable>
        <Pressable onPress={newChat} hitSlop={10} style={st.toolBtn} accessibilityLabel="Neues Gespräch"><Plus size={20} color={C.ink2} /></Pressable>
      </View>
      {view === 'history' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          <Text style={s.h}>Frühere Gespräche</Text>
          {chats === null ? <ActivityIndicator color={C.primary} /> : !chats.length ? <Text style={s.muted}>Noch keine gespeicherten Gespräche.</Text> : chats.map((c) => (
            <View key={c.id} style={[st.chatRow, c.id === chatId && { borderColor: C.primary }]}>
              <Pressable style={{ flex: 1 }} onPress={() => openChat(c.id)}>
                <Text style={{ color: C.ink, fontWeight: '600' }} numberOfLines={1}>{c.title}</Text>
                <Text style={s.mutedSmall}>{formatDate(c.updated_at.slice(0, 10))}</Text>
              </Pressable>
              <Pressable onPress={() => removeChat(c.id)} hitSlop={10}><Trash2 size={18} color={C.muted} /></Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          {!bubbles.length ? (
            <View style={{ gap: 8 }}>
              <Button title="Was steht heute an?" icon={Sun} variant="primary" onPress={() => send('Was steht heute an? Bitte ein kurzes Tagesbriefing.')} />
              <Text style={[s.h, { marginVertical: 4 }]}>Sagen Sie einfach, was zu tun ist.</Text>
              {EXAMPLES.map((t) => (
                <Pressable key={t} onPress={() => send(t)} style={st.example}><Text style={{ color: C.ink2 }}>„{t}“</Text></Pressable>
              ))}
              <Text style={s.mutedSmall}>Der Assistent legt Belege, Kunden und Buchungen direkt an (rückgängig machbar), schreibt E-Mails an Ihre Kunden, liest Ihren Posteingang und gibt Tipps. E-Mails gehen erst raus, wenn Sie auf „Senden“ tippen. Mit dem Wellen-Symbol oben führen Sie ein Gespräch ohne Tippen.</Text>
            </View>
          ) : null}
          {bubbles.map((b, i) => (
            <View key={i} style={[st.bubble, b.role === 'user' ? st.user : st.ai]}>
              {b.text ? <Text style={{ color: b.role === 'user' ? '#fff' : C.ink, fontSize: 15.5, lineHeight: 21 }}>{b.text}</Text> : null}
              {(b.actions || []).map((a, k) => (a.type === 'email'
                ? <EmailCard key={k} p={a} sent={b.results?.[k]?.label} onSent={(to) => emailSent(i, k, to)} />
                : <ResultCard key={k} r={b.results?.[k] ?? null} onUndo={() => undo(i, k)} />))}
            </View>
          ))}
          {busy ? <View style={[st.bubble, st.ai, { flexDirection: 'row', gap: 8 }]}><ActivityIndicator color={C.primary} /><Text style={s.muted}>{status || 'Einen Moment …'}</Text></View> : null}
        </ScrollView>
      )}
      {remaining !== null ? <Text style={[s.mutedSmall, { textAlign: 'center', paddingTop: 4 }]}>{remaining ? `Noch ${remaining} von ${monthly} Aufgaben in diesem Monat` : 'Monatsguthaben aufgebraucht – am 1. geht es weiter'}</Text> : null}
      {view === 'chat' ? (
        <View style={st.inputRow}>
          <Pressable onPress={mic} disabled={busy} style={[st.mic, listening && { backgroundColor: C.danger }]} accessibilityLabel={listening ? 'Aufnahme beenden' : 'Sprechen'}>
            {listening ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
          </Pressable>
          <TextInput value={input} onChangeText={setInput} placeholder={listening ? 'Ich höre zu …' : 'Sprechen oder tippen …'} placeholderTextColor={C.muted} multiline style={st.input} />
          <Pressable onPress={() => send(input)} disabled={busy || !input.trim()} style={[st.send, (busy || !input.trim()) && { opacity: 0.4 }]} accessibilityLabel="Senden">
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function ResultCard({ r, onUndo }: { r: Result | null; onUndo: () => void }) {
  if (!r) return null;
  const color = !r.ok ? C.danger : r.undone ? C.muted : C.primary;
  return (
    <View style={[st.result, !r.ok && { borderColor: C.danger }, r.undone && { borderColor: C.line }]}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
        {r.ok ? <CheckCircle2 size={16} color={color} /> : <XCircle size={16} color={color} />}
        <Text style={{ flex: 1, color: r.undone ? C.muted : C.ink, textDecorationLine: r.undone ? 'line-through' : 'none' }}>{r.label}</Text>
      </View>
      {r.ok && !r.undone ? (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {r.docId ? <Pressable onPress={() => router.push(`/beleg/${r.docId}`)}><Text style={st.link}>Öffnen</Text></Pressable> : null}
          {r.customerId ? <Pressable onPress={() => router.push(`/kunde/${r.customerId}`)}><Text style={st.link}>Öffnen</Text></Pressable> : null}
          {r.undo ? <Pressable onPress={onUndo} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Undo2 size={14} color={C.primary} /><Text style={st.link}>Rückgängig</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

function EmailCard({ p, sent, onSent }: { p: EmailProposal; sent?: string; onSent: (to: string) => void }) {
  const { data, companyId, commit } = useStore();
  const company = data.company;
  const doc = data.documents.find((d) => d.id === p.document_id);
  const customer = data.customers.find((c) => c.id === (p.customer_id || doc?.customerId));
  const [to, setTo] = useState(p.to || customer?.email || '');
  const [subject, setSubject] = useState(p.subject);
  const [text, setText] = useState(p.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = !!sent;
  const submit = async () => {
    if (!company || !companyId) return;
    setBusy(true);
    setError('');
    try {
      if (doc && doc.kind === 'invoice' && doc.status === 'draft') commit((d) => A.setDocStatus(d, doc.id, 'sent'));
      const pdfBase64 = doc ? await docPdfBase64(data, doc) : undefined;
      await sendMail({ companyId, to, subject, text, fromName: company.name, replyTo: company.email, bcc: data.settings.email.bcc, pdfBase64, fileName: doc ? docFileName(doc) : undefined, inReplyTo: p.in_reply_to });
      if (doc) commit((d) => A.markSent(d, doc.id, to));
      onSent(to);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={st.proposal}>
      <View style={st.cardHead}><Mail size={15} color={C.primary} /><Text style={s.h}>E-Mail-Entwurf</Text><Text style={[s.mutedSmall, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>{p.purpose}</Text></View>
      <TextInput value={to} onChangeText={setTo} placeholder="An (E-Mail-Adresse)" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" editable={!done} style={st.field} />
      <TextInput value={subject} onChangeText={setSubject} placeholder="Betreff" placeholderTextColor={C.muted} editable={!done} style={st.field} />
      <TextInput value={text} onChangeText={setText} multiline editable={!done} style={[st.field, { minHeight: 160, textAlignVertical: 'top' }]} />
      {doc ? <View style={st.cardHead}><Paperclip size={13} color={C.muted} /><Text style={s.mutedSmall}>{DOC_KINDS[doc.kind].one} {doc.number} als PDF</Text></View> : null}
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      <Button title={done ? sent! : 'Jetzt senden'} icon={done ? Check : Send} variant="primary" busy={busy} disabled={done || !to.trim() || !subject.trim()} onPress={submit} />
    </View>
  );
}

const st = StyleSheet.create({
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8 },
  toolBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  example: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12 },
  bubble: { maxWidth: '90%', borderRadius: 16, padding: 12, gap: 8 },
  user: { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 4 },
  ai: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 4 },
  proposal: { gap: 8, minWidth: 260 },
  result: { gap: 6, borderWidth: 1, borderColor: C.primary, borderRadius: 12, padding: 10, minWidth: 250 },
  link: { color: C.primary, fontWeight: '700' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: C.ink, backgroundColor: C.surface },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
  mic: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  send: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, fontSize: 16, color: C.ink },
});
