import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FilePlus2, Mail, MapPin, Phone, ReceiptText, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Text, View } from 'react-native';
import { Badge, Button, Card, Field, H, Row, Screen, s } from '../../components/ui';
import { useNewDoc } from '../../lib/hooks';
import { confirm } from '../../lib/confirm';
import { useStore } from '../../lib/store';
import { displayStatus, docTotals, formatDate, money } from '../../shared/calc';
import { emptyCustomer } from '../../shared/defaults';
import { DOC_KINDS } from '../../shared/docs';
import type { Customer } from '../../shared/types';

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, saveCustomer, commit } = useStore();
  const newDoc = useNewDoc();
  const isNew = id === 'neu';
  const stored = data.customers.find((c) => c.id === id);
  const [c, setC] = useState<Customer>(stored || emptyCustomer(data.company?.country || 'Deutschland'));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Customer>) => setC({ ...c, ...p });
  const docs = data.documents.filter((d) => d.customerId === id).sort((a, b) => b.date.localeCompare(a.date));
  const small = !!data.company?.smallBusiness;

  if (!isNew && !stored) return <Screen><Text style={s.muted}>Kunde nicht gefunden.</Text></Screen>;

  const save = async () => {
    setBusy(true);
    const saved = await saveCustomer(c);
    setBusy(false);
    if (saved && isNew) router.replace(`/kunde/${saved.id}`);
    else if (saved) Alert.alert('Gespeichert');
  };

  const remove = () => {
    if (docs.length) return Alert.alert('Nicht möglich', `${c.name} hat ${docs.length} Belege und kann nicht gelöscht werden.`);
    confirm(`${c.name} löschen?`, undefined, 'Löschen', () => { commit((d) => ({ ...d, customers: d.customers.filter((x) => x.id !== c.id) })); router.back(); }, true);
  };

  const address = [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Neuer Kunde' : c.name || 'Kunde' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <Screen>
          {!isNew ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {c.phone ? <View style={{ flex: 1 }}><Button small title="Anrufen" icon={Phone} onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`)} /></View> : null}
                {c.email ? <View style={{ flex: 1 }}><Button small title="E-Mail" icon={Mail} onPress={() => Linking.openURL(`mailto:${c.email}`)} /></View> : null}
                {address ? <View style={{ flex: 1 }}><Button small title="Karte" icon={MapPin} onPress={() => Linking.openURL(Platform.OS === 'ios' ? `maps:?q=${encodeURIComponent(address)}` : `geo:0,0?q=${encodeURIComponent(address)}`)} /></View> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <View style={{ flex: 1 }}><Button title="Angebot" icon={FilePlus2} onPress={() => newDoc('offer', c.id)} /></View>
                <View style={{ flex: 1 }}><Button title="Rechnung" icon={ReceiptText} variant="primary" onPress={() => newDoc('invoice', c.id)} /></View>
              </View>
            </>
          ) : null}

          <H>Stammdaten</H>
          <Card style={{ padding: 14, paddingBottom: 2 }}>
            {!isNew ? <Field label="Kundennummer" value={c.number} editable={false} /> : null}
            <Field label="Name / Firma" value={c.name} onChangeText={(v) => set({ name: v })} autoFocus={isNew} />
            <Field label="Ansprechpartner" value={c.contactPerson} onChangeText={(v) => set({ contactPerson: v })} />
            <Field label="Straße und Hausnummer" value={c.street} onChangeText={(v) => set({ street: v })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 110 }}><Field label="PLZ" value={c.zip} onChangeText={(v) => set({ zip: v })} keyboardType="number-pad" /></View>
              <Field label="Ort" value={c.city} onChangeText={(v) => set({ city: v })} />
            </View>
            <Field label="Land" value={c.country} onChangeText={(v) => set({ country: v })} />
            <Field label="E-Mail" value={c.email} onChangeText={(v) => set({ email: v })} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Telefon" value={c.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" />
            <Field label="USt-IdNr. / UID" value={c.vatId} onChangeText={(v) => set({ vatId: v })} autoCapitalize="characters" />
            <Field label="Notizen" value={c.notes} onChangeText={(v) => set({ notes: v })} multiline />
          </Card>
          <Button title={isNew ? 'Kunde anlegen' : 'Speichern'} icon={Save} variant="primary" busy={busy} disabled={!c.name.trim()} onPress={save} />

          {!isNew ? (
            <>
              <H sub={docs.length ? `${docs.length} Belege` : undefined}>Belege</H>
              <Card>
                {docs.length ? docs.slice(0, 30).map((d, i) => {
                  const st = displayStatus(d);
                  return <Row key={d.id} title={`${DOC_KINDS[d.kind].one} ${d.number}`} sub={formatDate(d.date)} right={<Badge label={st.label} tone={st.tone} />}
                    rightSub={DOC_KINDS[d.kind].prices ? money(docTotals(d.items, small).gross) : undefined} last={i === Math.min(docs.length, 30) - 1} onPress={() => router.push(`/beleg/${d.id}`)} />;
                }) : <Row title="Noch keine Belege" last />}
              </Card>
              <Button title="Kunde löschen" icon={Trash2} variant="danger" onPress={remove} />
            </>
          ) : null}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
