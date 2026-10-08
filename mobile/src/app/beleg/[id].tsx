import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { Check, ChevronRight, CopyPlus, FileDown, PackagePlus, Plus, Printer, Trash2, UserRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { ItemSheet } from '../../components/item-sheet';
import { Picker } from '../../components/picker';
import { Badge, Button, Card, Field, H, Note, Row, Screen, s } from '../../components/ui';
import * as A from '../../lib/actions';
import { confirm } from '../../lib/confirm';
import { printDoc, shareDocPdf } from '../../lib/pdf';
import { useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { displayStatus, docTotals, formatDate, lineNet, money, positionLabels, qty, uid } from '../../shared/calc';
import { DOC_KINDS, NEXT_KINDS } from '../../shared/docs';
import { emptyItem } from '../../shared/defaults';
import { formatRate, taxProfile } from '../../shared/tax';
import type { LineItem, SalesDoc } from '../../shared/types';

const toDe = (iso: string) => (iso ? formatDate(iso) : '');
const fromDe = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, commit, convertDoc } = useStore();
  const navigation = useNavigation();
  const stored = data.documents.find((d) => d.id === id);
  const [doc, setDoc] = useState<SalesDoc | undefined>(stored);
  const [dates, setDates] = useState({ date: toDe(stored?.date || ''), due: toDe(stored?.dueDate || '') });
  const [editing, setEditing] = useState<{ item: LineItem; isNew: boolean } | null>(null);
  const [pick, setPick] = useState<'customer' | 'material' | null>(null);
  const [busy, setBusy] = useState('');
  const docRef = useRef(doc);
  docRef.current = doc;

  // Von außen geänderter Beleg (z. B. Status) übernehmen
  // Status, Lagerbuchung und Versand kommen immer aus dem gespeicherten Stand (nie aus der Bearbeitungskopie)
  useEffect(() => {
    if (stored) setDoc((d) => (d ? { ...d, status: stored.status, stockBooked: stored.stockBooked, paidDate: stored.paidDate, sentAt: stored.sentAt, sentTo: stored.sentTo } : stored));
  }, [stored]);

  // Beim Verlassen automatisch speichern
  const save = () => {
    const d = docRef.current;
    if (!d) return;
    const current = dataRefDoc();
    if (!current) return;
    const merged: SalesDoc = { ...d, status: current.status, stockBooked: current.stockBooked, paidDate: current.paidDate, sentAt: current.sentAt, sentTo: current.sentTo };
    if (JSON.stringify(current) !== JSON.stringify(merged)) commit((x) => A.saveDoc(x, merged));
  };
  const dataRef = useRef(data);
  dataRef.current = data;
  const dataRefDoc = () => dataRef.current.documents.find((x) => x.id === id);
  useEffect(() => navigation.addListener('beforeRemove', save), [navigation]); // eslint-disable-line react-hooks/exhaustive-deps
  // App geht in den Hintergrund: Zwischenstand sichern
  useEffect(() => { const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') save(); }); return () => sub.remove(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc || !data.company) return <Screen><Text style={s.muted}>Beleg nicht gefunden.</Text></Screen>;

  const company = data.company;
  const cfg = DOC_KINDS[doc.kind];
  const small = company.smallBusiness;
  const totals = docTotals(doc.items, small);
  const st = displayStatus(doc);
  const locked = doc.kind === 'invoice' && doc.status !== 'draft';
  const labels = positionLabels(doc.items);
  const tax = taxProfile(company);
  const update = (p: Partial<SalesDoc>) => setDoc({ ...doc, ...p });

  const status = (next: SalesDoc['status'], question?: string) => {
    const run = () => {
      save();
      commit((x) => A.setDocStatus(x, doc.id, next));
    };
    if (question) confirm(question, undefined, 'Ja', run);
    else run();
  };

  const withBusy = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { save(); await fn(); } catch (e) { Alert.alert('Fehler', (e as Error).message); } finally { setBusy(''); }
  };

  const saveItem = (item: LineItem) => {
    const exists = doc.items.some((i) => i.id === item.id);
    update({ items: exists ? doc.items.map((i) => (i.id === item.id ? item : i)) : [...doc.items, item] });
    setEditing(null);
  };
  const removeItem = (itemId: string) => {
    update({ items: doc.items.filter((i) => i.id !== itemId && i.parentId !== itemId) });
    setEditing(null);
  };
  const addAlternative = (parent: LineItem) => {
    const item: LineItem = { ...emptyItem(parent.vat), parentId: parent.id, variant: 'alternative', unit: parent.unit, quantity: parent.quantity };
    // Alternative direkt hinter der Hauptposition (und ihren bisherigen Alternativen)
    const idx = doc.items.reduce((last, i, k) => (i.id === parent.id || i.parentId === parent.id ? k : last), -1);
    setEditing({ item, isNew: true });
    setDoc({ ...doc, items: [...doc.items.slice(0, idx + 1), item, ...doc.items.slice(idx + 1)] });
  };

  const actions: { title: string; onPress: () => void; primary?: boolean }[] = [];
  if (doc.status === 'draft') {
    actions.push(doc.kind === 'invoice'
      ? { title: 'Festschreiben', primary: true, onPress: () => status('sent', `Rechnung ${doc.number} festschreiben? Danach ist sie nicht mehr änderbar.`) }
      : { title: `Als „${cfg.status.sent?.label}“ markieren`, primary: true, onPress: () => status('sent') });
  }
  if (doc.kind === 'invoice' && doc.status === 'sent') {
    actions.push({ title: 'Zahlung erfassen (bezahlt)', primary: true, onPress: () => status('paid') });
    actions.push({ title: 'Stornieren', onPress: () => status('cancelled', `Rechnung ${doc.number} stornieren?`) });
  }
  if (doc.kind === 'invoice' && doc.status === 'paid') actions.push({ title: 'Wieder als offen markieren', onPress: () => status('sent') });
  if (doc.kind === 'offer' && doc.status === 'sent') {
    actions.push({ title: 'Angenommen', primary: true, onPress: () => status('accepted') });
    actions.push({ title: 'Abgelehnt', onPress: () => status('declined') });
  }
  if (doc.kind === 'confirmation' && doc.status === 'sent') actions.push({ title: 'Als erledigt markieren', onPress: () => status('accepted') });
  if (doc.kind === 'order' && doc.status === 'sent') actions.push({ title: 'Ware erhalten (Bestand einbuchen)', primary: true, onPress: () => status('accepted') });

  const partners = data.customers.map((c) => ({ id: c.id, title: c.name, sub: `${c.number}${c.city ? ` · ${c.city}` : ''}`, search: `${c.name} ${c.number} ${c.city} ${c.contactPerson}` }));
  const materials = data.materials.map((m) => ({ id: m.id, title: m.name, sub: `${m.number} · ${qty(m.stock)} ${m.unit} am Lager`, right: money(doc.kind === 'order' ? m.purchasePrice : m.salePrice), search: `${m.name} ${m.number} ${m.category} ${m.description}` }));

  return (
    <>
      <Stack.Screen options={{ title: `${cfg.one} ${doc.number}` }} />
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Badge label={st.label} tone={st.tone} />
          {doc.sentTo ? <Text style={s.mutedSmall}>versendet an {doc.sentTo}</Text> : null}
        </View>
        {locked ? <Note>Diese Rechnung ist festgeschrieben und kann nicht mehr geändert werden. Korrekturen über Storno und neue Rechnung.</Note> : null}

        <H>{cfg.partner}</H>
        <Card>
          <Row icon={UserRound} title={doc.recipient.name || `${cfg.partner} wählen`} sub={[doc.recipient.street, [doc.recipient.zip, doc.recipient.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined}
            right={locked ? undefined : <ChevronRight size={18} color={C.muted} />} last onPress={locked ? undefined : () => setPick('customer')} />
        </Card>

        <H>Angaben</H>
        <Card style={{ padding: 14, paddingBottom: 2 }}>
          <Field label="Betreff" value={doc.subject} onChangeText={(v) => update({ subject: v })} editable={!locked} placeholder="z. B. Elektroinstallation Küche" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label={cfg.dateLabel} value={dates.date} editable={!locked} keyboardType="numbers-and-punctuation" placeholder="TT.MM.JJJJ"
              onChangeText={(v) => setDates({ ...dates, date: v })} onBlur={() => { const iso = fromDe(dates.date); if (iso) update({ date: iso }); else setDates({ ...dates, date: toDe(doc.date) }); }} />
            <Field label={cfg.dueLabel} value={dates.due} editable={!locked} keyboardType="numbers-and-punctuation" placeholder="TT.MM.JJJJ"
              onChangeText={(v) => setDates({ ...dates, due: v })} onBlur={() => { const iso = dates.due.trim() ? fromDe(dates.due) : ''; if (iso !== null) update({ dueDate: iso }); else setDates({ ...dates, due: toDe(doc.dueDate) }); }} />
          </View>
          {doc.kind === 'invoice' ? <Field label="Leistungsdatum / -zeitraum" value={doc.serviceDate} onChangeText={(v) => update({ serviceDate: v })} editable={!locked} /> : null}
        </Card>

        <H sub={doc.items.length ? `${doc.items.length} Positionen` : undefined}>Positionen</H>
        <Card>
          {doc.items.map((item, i) => (
            <View key={item.id}>
              <Row title={`${labels[i]}  ${item.description || 'Ohne Bezeichnung'}`}
                sub={`${item.variant === 'optional' ? 'Optional · ' : item.variant || item.parentId ? `Alternative${item.chosen ? ' (gewählt)' : ''} · ` : ''}${qty(item.quantity)} ${item.unit}${cfg.prices ? ` × ${money(item.unitPrice)}${item.discount ? ` – ${qty(item.discount)} %` : ''}` : ''}`}
                right={cfg.prices ? (item.variant ? `(${money(lineNet(item))})` : money(lineNet(item))) : undefined}
                onPress={locked ? undefined : () => setEditing({ item, isNew: false })} last={i === doc.items.length - 1 && locked} />
              {!locked && doc.kind === 'offer' && !item.parentId && !item.variant && doc.items[i + 1]?.parentId !== item.id ? (
                <Pressable onPress={() => addAlternative(item)} style={{ paddingHorizontal: 14, paddingBottom: 10, marginTop: -6, backgroundColor: C.surface }}>
                  <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>+ Alternative zu Pos. {labels[i]}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {!locked ? (
            <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
              <View style={{ flex: 1 }}><Button small title="Aus Material" icon={PackagePlus} onPress={() => setPick('material')} /></View>
              <View style={{ flex: 1 }}><Button small title="Freie Position" icon={Plus} onPress={() => setEditing({ item: emptyItem(company.smallBusiness ? 0 : company.defaultVat), isNew: true })} /></View>
            </View>
          ) : null}
        </Card>

        {cfg.prices ? (
          <Card style={{ padding: 14, gap: 6 }}>
            {!small ? <Line label="Netto" value={money(totals.net)} /> : null}
            {!small ? totals.vatGroups.map((g) => <Line key={g.rate} label={`${tax.label} ${formatRate(g.rate)}`} value={money(g.vat)} />) : null}
            <Line label={cfg.totalLabel || 'Summe'} value={money(totals.gross)} strong />
            {small ? <Text style={s.mutedSmall}>{tax.smallBusinessNote}</Text> : null}
          </Card>
        ) : null}

        <H>Texte</H>
        <Card style={{ padding: 14, paddingBottom: 2 }}>
          <Field label="Einleitung (leer = Standardtext)" value={doc.intro} onChangeText={(v) => update({ intro: v })} multiline editable={!locked} />
          <Field label="Schlusstext (leer = Standardtext)" value={doc.outro} onChangeText={(v) => update({ outro: v })} multiline editable={!locked} />
        </Card>

        <View style={{ gap: 10 }}>
          <Button title="PDF teilen / senden" icon={FileDown} variant="primary" busy={busy === 'pdf'} onPress={() => withBusy('pdf', async () => {
            await shareDocPdf(dataRef.current, doc);
            if (!doc.sentAt) commit((x) => A.markSent(x, doc.id, 'Gerät (geteilt)'));
          })} />
          <Button title="Drucken" icon={Printer} busy={busy === 'print'} onPress={() => withBusy('print', () => printDoc(dataRef.current, doc))} />
          {actions.map((a) => <Button key={a.title} title={a.title} icon={Check} variant={a.primary ? 'primary' : 'default'} onPress={a.onPress} />)}
          {NEXT_KINDS[doc.kind].map((k) => (
            <Button key={k} title={`${DOC_KINDS[k].one} erstellen`} icon={CopyPlus} busy={busy === k} onPress={() => withBusy(k, async () => {
              const next = await convertDoc(doc.id, k);
              if (next) router.replace(`/beleg/${next.id}`);
            })} />
          ))}
          {!locked ? (
            <Button title="Beleg löschen" icon={Trash2} variant="danger" onPress={() => confirm(`${cfg.one} ${doc.number} löschen?`, 'Das lässt sich nicht rückgängig machen.', 'Löschen', () => {
              docRef.current = undefined; commit((x) => A.deleteDoc(x, doc.id)); router.back();
            }, true)} />
          ) : null}
        </View>
      </Screen>

      <ItemSheet item={editing?.item || null} company={company} prices={cfg.prices} offer={doc.kind === 'offer'} isChild={!!editing?.item.parentId}
        onSave={saveItem}
        onDelete={() => editing && removeItem(editing.item.id)}
        onClose={() => {
          // Neue, leer gebliebene Position verwerfen
          if (editing?.isNew) setDoc((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== editing.item.id || i.description.trim()) } : d));
          setEditing(null);
        }} />

      <Picker visible={pick === 'customer'} title={`${cfg.partner} wählen`} items={partners} placeholder="Name, Nummer, Ort …"
        footer={<Button small title="Neuen Kunden anlegen" icon={Plus} onPress={() => { setPick(null); router.push('/kunde/neu'); }} />}
        onClose={() => setPick(null)}
        onPick={(cid) => {
          const c = data.customers.find((x) => x.id === cid)!;
          update({ customerId: c.id, recipient: { name: c.name, contactPerson: c.contactPerson, street: c.street, zip: c.zip, city: c.city, country: c.country, vatId: c.vatId } });
          setPick(null);
        }} />

      <Picker visible={pick === 'material'} title="Artikel übernehmen" items={materials} placeholder="Artikel, Nummer, Kategorie …"
        onClose={() => setPick(null)}
        onPick={(mid) => {
          const m = data.materials.find((x) => x.id === mid)!;
          const item: LineItem = { id: uid(), materialId: m.id, description: m.name, details: m.description, quantity: 1, unit: m.unit,
            unitPrice: doc.kind === 'order' ? m.purchasePrice : m.salePrice, vat: small ? 0 : m.vat, discount: 0 };
          setPick(null);
          setEditing({ item, isNew: false });
          setDoc({ ...doc, items: [...doc.items, item] });
        }} />
    </>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: strong ? 1 : 0, borderTopColor: C.line, paddingTop: strong ? 8 : 0 }}>
      <Text style={[strong ? s.h : s.muted]}>{label}</Text>
      <Text style={[strong ? s.h : { color: C.ink, fontSize: 15 }, { fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

