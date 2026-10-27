import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import { Check, CheckCircle2, Lock, Mail, Mic, MicOff, Paperclip, RotateCcw, Send, Sparkles, Sun, UserPlus, Volume2, VolumeX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Empty, s } from '../components/ui';
import * as A from '../lib/actions';
import { useStore } from '../lib/store';
import { sendMail } from '../lib/mail';
import { docFileName, docPdfBase64 } from '../lib/pdf';
import { SITE_URL, supabase } from '../lib/supabase';
import { C } from '../lib/theme';
import { docTotals, formatDate, money, qty, today, uid } from '../shared/calc';
import { emptyCustomer } from '../shared/defaults';
import { DOC_KINDS } from '../shared/docs';
import type { DocKind, LineItem } from '../shared/types';

type Proposal = {
  kind: DocKind; customer_id: string; recipient_name: string; subject: string;
  items: { material_id: string; description: string; details: string; quantity: number; unit: string; unit_price: number; vat: number; monthly?: boolean }[];
};
type EmailProposal = { to: string; customer_id: string; subject: string; text: string; document_id: string; in_reply_to: string; purpose: string };
type CustomerProposal = { customer_id: string; name: string; contact_person: string; email: string; phone: string; street: string; zip: string; city: string; notes: string };
type PaymentProposal = { document_id: string; paid_date: string };
type Action = ({ type: 'document' } & Proposal) | ({ type: 'email' } & EmailProposal) | ({ type: 'customer' } & CustomerProposal) | ({ type: 'payment' } & PaymentProposal);
type Bubble = { role: 'user' | 'ai'; text: string; actions?: Action[] };

const speechLang = (country = '') => (/österreich|austria/i.test(country) ? 'de-AT' : /schweiz|switzerland/i.test(country) ? 'de-CH' : 'de-DE');
const EXAMPLES = [
  'Schreib allen mit überfälligen Rechnungen eine freundliche Zahlungserinnerung',
  'Gibt es neue Anfragen im Posteingang?',
  'Neues Angebot für Herrn Müller: zwei Steckdosen von Gira und Arbeit pauschal 20 Euro',
  'Rechnung RE-2026-0042 ist heute bezahlt worden',
];

/** Assistent (Zusatzbuchung) – gleiche Logik wie auf der Website (/api/agent) */
export default function Assistant() {
  const { data, companyId, aiBooked, createDoc, commit } = useStore();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [monthly, setMonthly] = useState(300);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const transcript = useRef('');
  const scroll = useRef<ScrollView>(null);
  const company = data.company;

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const j = await fetch(`${SITE_URL}/api/agent${companyId ? `?companyId=${companyId}` : ''}`, { headers: { authorization: `Bearer ${sess.session?.access_token || ''}`, 'x-vysn-token': sess.session?.access_token || '' } }).then((r) => r.json());
      setEnabled(!!j.enabled);
      if (j.monthlyLimit) setMonthly(j.monthlyLimit);
      if (typeof j.remaining === 'number') setRemaining(j.remaining);
    })().catch(() => setEnabled(false));
  }, [companyId]);
  useEffect(() => () => { Speech.stop(); ExpoSpeechRecognitionModule.abort(); }, []);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('result', (e) => { transcript.current = e.results[0]?.transcript || ''; setInput(transcript.current); });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const text = transcript.current.trim();
    transcript.current = '';
    if (text) send(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error === 'not-allowed') add({ role: 'ai', text: 'Bitte erlauben Sie Mikrofon und Spracherkennung in den Einstellungen Ihres Geräts.' });
  });

  const add = (b: Bubble) => { setBubbles((x) => [...x, b]); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || !companyId) return;
    setInput('');
    add({ role: 'user', text });
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(`${SITE_URL}/api/agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sess.session?.access_token || ''}`, 'x-vysn-token': sess.session?.access_token || '' },
        body: JSON.stringify({ companyId, history, text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Der Assistent ist gerade nicht erreichbar.');
      setHistory(json.messages);
      if (typeof json.remaining === 'number') setRemaining(json.remaining);
      const actions: Action[] = json.actions ?? (json.proposal ? [{ type: 'document', ...json.proposal }] : []);
      const reply = json.reply || (actions.length ? 'Hier ist mein Vorschlag. Passt das so?' : '');
      add({ role: 'ai', text: reply, actions });
      if (speak && reply) Speech.speak(reply, { language: speechLang(company?.country) });
    } catch (e) {
      add({ role: 'ai', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const mic = async () => {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    Speech.stop();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) { add({ role: 'ai', text: 'Bitte erlauben Sie Mikrofon und Spracherkennung in den Einstellungen Ihres Geräts.' }); return; }
    transcript.current = '';
    ExpoSpeechRecognitionModule.start({ lang: speechLang(company?.country), interimResults: true, continuous: false });
  };

  const acceptDocument = async (p: Proposal) => {
    const customer = data.customers.find((c) => c.id === p.customer_id);
    const doc = await createDoc(p.kind, customer?.id || '');
    if (!doc || !company) return;
    const items: LineItem[] = p.items.map((i) => ({
      id: uid(),
      materialId: data.materials.some((m) => m.id === i.material_id) ? i.material_id : undefined,
      description: i.description, details: i.details, quantity: Number(i.quantity) || 1, unit: i.unit || 'Stück',
      unitPrice: Number(i.unit_price) || 0, vat: company.smallBusiness ? 0 : Number(i.vat ?? company.defaultVat), discount: 0,
      interval: i.monthly ? 'monthly' : undefined,
    }));
    commit((d) => A.saveDoc(d, { ...doc, subject: p.subject, items, recipient: customer ? doc.recipient : { ...doc.recipient, name: p.recipient_name } }));
    router.push(`/beleg/${doc.id}`);
  };

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
        <Pressable onPress={() => { setSpeak(!speak); Speech.stop(); }} hitSlop={10}>{speak ? <Volume2 size={20} color={C.ink2} /> : <VolumeX size={20} color={C.ink2} />}</Pressable>
        <Pressable onPress={() => { setBubbles([]); setHistory([]); Speech.stop(); }} hitSlop={10}><RotateCcw size={20} color={C.ink2} /></Pressable>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        {!bubbles.length ? (
          <View style={{ gap: 8 }}>
            <Button title="Was steht heute an?" icon={Sun} variant="primary" onPress={() => send('Was steht heute an? Bitte ein kurzes Tagesbriefing.')} />
            <Text style={[s.h, { marginVertical: 4 }]}>Sagen Sie einfach, was zu tun ist.</Text>
            {EXAMPLES.map((t) => (
              <Pressable key={t} onPress={() => send(t)} style={st.example}><Text style={{ color: C.ink2 }}>„{t}“</Text></Pressable>
            ))}
            <Text style={s.mutedSmall}>Der Assistent schreibt E-Mails an Ihre Kunden, erinnert an offene Rechnungen, liest Ihren Posteingang und legt Belege und Kunden an. Verschickt oder gespeichert wird erst, wenn Sie bestätigen.</Text>
          </View>
        ) : null}
        {bubbles.map((b, i) => (
          <View key={i} style={[st.bubble, b.role === 'user' ? st.user : st.ai]}>
            {b.text ? <Text style={{ color: b.role === 'user' ? '#fff' : C.ink, fontSize: 15.5, lineHeight: 21 }}>{b.text}</Text> : null}
            {(b.actions || []).map((a, k) => <ActionCard key={k} action={a} onDocument={acceptDocument} />)}
          </View>
        ))}
        {busy ? <View style={[st.bubble, st.ai, { flexDirection: 'row', gap: 8 }]}><ActivityIndicator color={C.primary} /><Text style={s.muted}>Einen Moment …</Text></View> : null}
      </ScrollView>
      {remaining !== null ? <Text style={[s.mutedSmall, { textAlign: 'center', paddingTop: 4 }]}>{remaining ? `Noch ${remaining} von ${monthly} Aufgaben in diesem Monat` : 'Monatsguthaben aufgebraucht – am 1. geht es weiter'}</Text> : null}
      <View style={st.inputRow}>
        <Pressable onPress={mic} disabled={busy} style={[st.mic, listening && { backgroundColor: C.danger }]} accessibilityLabel={listening ? 'Aufnahme beenden' : 'Sprechen'}>
          {listening ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
        </Pressable>
        <TextInput value={input} onChangeText={setInput} placeholder={listening ? 'Ich höre zu …' : 'Sprechen oder tippen …'} placeholderTextColor={C.muted} multiline style={st.input} />
        <Pressable onPress={() => send(input)} disabled={busy || !input.trim()} style={[st.send, (busy || !input.trim()) && { opacity: 0.4 }]} accessibilityLabel="Senden">
          <Send size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ActionCard({ action, onDocument }: { action: Action; onDocument: (p: Proposal) => Promise<void> }) {
  const [done, setDone] = useState(false);
  if (action.type === 'email') return <EmailCard p={action} done={done} onDone={() => setDone(true)} />;
  if (action.type === 'customer') return <CustomerCard p={action} done={done} onDone={() => setDone(true)} />;
  if (action.type === 'payment') return <PaymentCard p={action} done={done} onDone={() => setDone(true)} />;
  return <ProposalCard p={action} done={done} onAccept={() => { setDone(true); onDocument(action); }} />;
}

function EmailCard({ p, done, onDone }: { p: EmailProposal; done: boolean; onDone: () => void }) {
  const { data, companyId, commit } = useStore();
  const company = data.company;
  const doc = data.documents.find((d) => d.id === p.document_id);
  const customer = data.customers.find((c) => c.id === (p.customer_id || doc?.customerId));
  const [to, setTo] = useState(p.to || customer?.email || '');
  const [subject, setSubject] = useState(p.subject);
  const [text, setText] = useState(p.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!company || !companyId) return;
    setBusy(true);
    setError('');
    try {
      if (doc && doc.kind === 'invoice' && doc.status === 'draft') commit((d) => A.setDocStatus(d, doc.id, 'sent'));
      const pdfBase64 = doc ? await docPdfBase64(data, doc) : undefined;
      await sendMail({ companyId, to, subject, text, fromName: company.name, replyTo: company.email, bcc: data.settings.email.bcc, pdfBase64, fileName: doc ? docFileName(doc) : undefined, inReplyTo: p.in_reply_to });
      if (doc) commit((d) => A.markSent(d, doc.id, to));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={st.proposal}>
      <View style={st.cardHead}><Mail size={15} color={C.primary} /><Text style={s.h}>E-Mail</Text><Text style={[s.mutedSmall, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>{p.purpose}</Text></View>
      <TextInput value={to} onChangeText={setTo} placeholder="An (E-Mail-Adresse)" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" editable={!done} style={st.field} />
      <TextInput value={subject} onChangeText={setSubject} placeholder="Betreff" placeholderTextColor={C.muted} editable={!done} style={st.field} />
      <TextInput value={text} onChangeText={setText} multiline editable={!done} style={[st.field, { minHeight: 160, textAlignVertical: 'top' }]} />
      {doc ? <View style={st.cardHead}><Paperclip size={13} color={C.muted} /><Text style={s.mutedSmall}>{DOC_KINDS[doc.kind].one} {doc.number} als PDF</Text></View> : null}
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      <Button title={done ? 'Gesendet' : 'Jetzt senden'} icon={done ? Check : Send} variant="primary" busy={busy} disabled={done || !to.trim() || !subject.trim()} onPress={submit} />
    </View>
  );
}

function CustomerCard({ p, done, onDone }: { p: CustomerProposal; done: boolean; onDone: () => void }) {
  const { data, saveCustomer } = useStore();
  const existing = data.customers.find((c) => c.id === p.customer_id);
  const rows: [string, string][] = [['Name', p.name], ['Ansprechpartner', p.contact_person], ['E-Mail', p.email], ['Telefon', p.phone], ['Adresse', [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')], ['Notiz', p.notes]];
  const submit = async () => {
    const base = existing || emptyCustomer(data.company?.country);
    const saved = await saveCustomer({ ...base, name: p.name, contactPerson: p.contact_person, email: p.email, phone: p.phone, street: p.street, zip: p.zip, city: p.city, notes: p.notes || base.notes });
    if (saved) onDone();
  };
  return (
    <View style={st.proposal}>
      <View style={st.cardHead}><UserPlus size={15} color={C.primary} /><Text style={s.h}>{existing ? 'Kunde ändern' : 'Neuer Kunde'}</Text></View>
      {rows.filter(([, v]) => v).map(([k, v]) => <Text key={k} style={{ color: C.ink2 }}><Text style={s.muted}>{k}: </Text>{v}</Text>)}
      <Button title={done ? 'Gespeichert' : existing ? 'Änderungen speichern' : 'Kunde anlegen'} icon={Check} variant="primary" disabled={done || !p.name.trim()} onPress={submit} />
    </View>
  );
}

function PaymentCard({ p, done, onDone }: { p: PaymentProposal; done: boolean; onDone: () => void }) {
  const { data, commit } = useStore();
  const doc = data.documents.find((d) => d.id === p.document_id && d.kind === 'invoice');
  if (!doc) return <Text style={s.muted}>Die Rechnung wurde nicht gefunden.</Text>;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.paid_date) ? p.paid_date : today();
  const paid = done || doc.status === 'paid';
  return (
    <View style={st.proposal}>
      <View style={st.cardHead}><CheckCircle2 size={15} color={C.primary} /><Text style={s.h}>Zahlungseingang</Text></View>
      <Text style={{ color: C.ink2 }}>Rechnung {doc.number} · {doc.recipient.name}</Text>
      <Text style={{ color: C.ink2 }}>{money(docTotals(doc.items, !!data.company?.smallBusiness, doc.kind).gross)} · bezahlt am {formatDate(date)}</Text>
      <Button title={paid ? 'Als bezahlt markiert' : 'Als bezahlt markieren'} icon={Check} variant="primary" disabled={paid} onPress={() => { commit((d) => A.setDocStatus(d, doc.id, 'paid', date)); onDone(); }} />
    </View>
  );
}

function ProposalCard({ p, done, onAccept }: { p: Proposal; done: boolean; onAccept: () => void }) {
  const { data } = useStore();
  const small = !!data.company?.smallBusiness;
  const customer = data.customers.find((c) => c.id === p.customer_id);
  const cfg = DOC_KINDS[p.kind] || DOC_KINDS.offer;
  const totals = docTotals(p.items.filter((i) => !i.monthly).map((i) => ({ id: '', description: i.description, details: '', quantity: i.quantity, unit: i.unit, unitPrice: i.unit_price, vat: small ? 0 : i.vat, discount: 0 })), small);
  return (
    <View style={st.proposal}>
      <Text style={s.h}>{cfg.one} · {customer?.name || p.recipient_name || 'Ohne Empfänger'}</Text>
      {p.subject ? <Text style={s.muted}>{p.subject}</Text> : null}
      {p.items.map((i, k) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flex: 1, color: C.ink2 }}>{qty(i.quantity)} {i.unit} {i.description}{i.material_id ? '' : ' *'}</Text>
          {cfg.prices ? <Text style={{ fontWeight: '700', color: C.ink }}>{money(i.quantity * i.unit_price)}{i.monthly ? ' /Monat' : ''}</Text> : null}
        </View>
      ))}
      {cfg.prices ? <Text style={[s.h, { textAlign: 'right' }]}>{small ? 'Summe' : 'Netto'} {money(totals.net)}</Text> : null}
      {p.items.some((i) => !i.material_id) ? <Text style={s.mutedSmall}>* freie Position (nicht aus dem Materialstamm)</Text> : null}
      <Button title={done ? 'Übernommen' : 'Als Entwurf übernehmen'} icon={Check} variant="primary" disabled={done} onPress={onAccept} />
    </View>
  );
}

const st = StyleSheet.create({
  tools: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, paddingHorizontal: 16, paddingTop: 10 },
  example: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12 },
  bubble: { maxWidth: '88%', borderRadius: 16, padding: 12, gap: 8 },
  user: { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 4 },
  ai: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 4 },
  proposal: { gap: 8, minWidth: 260 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: C.ink, backgroundColor: C.surface },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
  mic: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  send: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, fontSize: 16, color: C.ink },
});
