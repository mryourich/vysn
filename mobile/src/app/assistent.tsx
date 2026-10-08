import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import { Check, Lock, Mic, MicOff, RotateCcw, Send, Sparkles, Volume2, VolumeX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Empty, s } from '../components/ui';
import * as A from '../lib/actions';
import { useStore } from '../lib/store';
import { SITE_URL, supabase } from '../lib/supabase';
import { C } from '../lib/theme';
import { docTotals, money, qty, uid } from '../shared/calc';
import { DOC_KINDS } from '../shared/docs';
import type { DocKind, LineItem } from '../shared/types';

type Proposal = {
  kind: DocKind; customer_id: string; recipient_name: string; subject: string;
  items: { material_id: string; description: string; details: string; quantity: number; unit: string; unit_price: number; vat: number }[];
};
type Bubble = { role: 'user' | 'ai'; text: string; proposal?: Proposal | null; done?: boolean };

const speechLang = (country = '') => (/österreich|austria/i.test(country) ? 'de-AT' : /schweiz|switzerland/i.test(country) ? 'de-CH' : 'de-DE');
const EXAMPLES = [
  'Neues Angebot für Herrn Müller: zwei Steckdosen von Gira und Arbeit pauschal 20 Euro',
  'Wie viel Umsatz habe ich diesen Monat gemacht?',
  'Welche Rechnungen sind noch offen?',
];

/** KI-Sprachassistent (Zusatzbuchung) – gleiche Logik wie auf der Website (/api/agent) */
export default function Assistant() {
  const { data, companyId, aiBooked, createDoc, commit } = useStore();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const transcript = useRef('');
  const scroll = useRef<ScrollView>(null);
  const company = data.company;

  useEffect(() => { fetch(`${SITE_URL}/api/agent`).then((r) => r.json()).then((j) => setEnabled(!!j.enabled)).catch(() => setEnabled(false)); }, []);
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
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sess.session?.access_token || ''}` },
        body: JSON.stringify({ companyId, history, text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Der Assistent ist gerade nicht erreichbar.');
      setHistory(json.messages);
      if (typeof json.remaining === 'number') setRemaining(json.remaining);
      const reply = json.reply || (json.proposal ? 'Hier ist mein Vorschlag. Passt das so?' : '');
      add({ role: 'ai', text: reply, proposal: json.proposal });
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

  const accept = async (index: number, p: Proposal) => {
    const customer = data.customers.find((c) => c.id === p.customer_id);
    const doc = await createDoc(p.kind, customer?.id || '');
    if (!doc || !company) return;
    const items: LineItem[] = p.items.map((i) => ({
      id: uid(),
      materialId: data.materials.some((m) => m.id === i.material_id) ? i.material_id : undefined,
      description: i.description, details: i.details, quantity: Number(i.quantity) || 1, unit: i.unit || 'Stück',
      unitPrice: Number(i.unit_price) || 0, vat: company.smallBusiness ? 0 : Number(i.vat ?? company.defaultVat), discount: 0,
    }));
    commit((d) => A.saveDoc(d, { ...doc, subject: p.subject, items, recipient: customer ? doc.recipient : { ...doc.recipient, name: p.recipient_name } }));
    setBubbles((b) => b.map((x, i) => (i === index ? { ...x, done: true } : x)));
    router.push(`/beleg/${doc.id}`);
  };

  if (enabled === false || !aiBooked) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}>
        <Empty icon={enabled === false ? Sparkles : Lock} title={enabled === false ? 'Demnächst verfügbar' : 'Nicht gebucht'}
          text={enabled === false
            ? 'Der KI-Sprachassistent wird gerade eingerichtet.'
            : 'Der KI-Sprachassistent ist eine Zusatzbuchung und für diese Firma nicht freigeschaltet. Zusatzbuchungen lassen sich in der App nicht buchen oder ändern.'} />
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
            <Text style={[s.h, { marginBottom: 4 }]}>Sagen Sie einfach, was Sie brauchen.</Text>
            {EXAMPLES.map((t) => (
              <Pressable key={t} onPress={() => send(t)} style={st.example}><Text style={{ color: C.ink2 }}>„{t}“</Text></Pressable>
            ))}
            <Text style={s.mutedSmall}>Kunden und Artikel sucht der Assistent selbst heraus, fragt bei Unklarheiten nach und legt erst nach Ihrer Bestätigung etwas an.</Text>
          </View>
        ) : null}
        {bubbles.map((b, i) => (
          <View key={i} style={[st.bubble, b.role === 'user' ? st.user : st.ai]}>
            {b.text ? <Text style={{ color: b.role === 'user' ? '#fff' : C.ink, fontSize: 15.5, lineHeight: 21 }}>{b.text}</Text> : null}
            {b.proposal ? <ProposalCard p={b.proposal} done={!!b.done} onAccept={() => accept(i, b.proposal!)} /> : null}
          </View>
        ))}
        {busy ? <View style={[st.bubble, st.ai, { flexDirection: 'row', gap: 8 }]}><ActivityIndicator color={C.primary} /><Text style={s.muted}>Einen Moment …</Text></View> : null}
      </ScrollView>
      {remaining !== null && remaining <= 5 ? <Text style={[s.mutedSmall, { textAlign: 'center' }]}>{remaining ? `Heute noch ${remaining} Anfragen` : 'Tageslimit erreicht – morgen geht es weiter'}</Text> : null}
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

function ProposalCard({ p, done, onAccept }: { p: Proposal; done: boolean; onAccept: () => void }) {
  const { data } = useStore();
  const small = !!data.company?.smallBusiness;
  const customer = data.customers.find((c) => c.id === p.customer_id);
  const cfg = DOC_KINDS[p.kind] || DOC_KINDS.offer;
  const totals = docTotals(p.items.map((i) => ({ id: '', description: i.description, details: '', quantity: i.quantity, unit: i.unit, unitPrice: i.unit_price, vat: small ? 0 : i.vat, discount: 0 })), small);
  return (
    <View style={st.proposal}>
      <Text style={s.h}>{cfg.one} · {customer?.name || p.recipient_name || 'Ohne Empfänger'}</Text>
      {p.subject ? <Text style={s.muted}>{p.subject}</Text> : null}
      {p.items.map((i, k) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flex: 1, color: C.ink2 }}>{qty(i.quantity)} {i.unit} {i.description}{i.material_id ? '' : ' *'}</Text>
          {cfg.prices ? <Text style={{ fontWeight: '700', color: C.ink }}>{money(i.quantity * i.unit_price)}</Text> : null}
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
  proposal: { gap: 6, minWidth: 250 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
  mic: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  send: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, fontSize: 16, color: C.ink },
});
