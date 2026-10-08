import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Button, Card, Field, H, Row, Screen, Segmented, Stat, s } from '../../components/ui';
import * as A from '../../lib/actions';
import { confirm } from '../../lib/confirm';
import { useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { formatDate, money, parseNumber, qty } from '../../shared/calc';
import { UNITS, emptyMaterial } from '../../shared/defaults';
import { formatRate, vatChoices } from '../../shared/tax';
import type { Material } from '../../shared/types';

const price = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '');

export default function MaterialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, saveMaterial, commit } = useStore();
  const isNew = id === 'neu';
  const stored = data.materials.find((m) => m.id === id);
  const company = data.company;
  const [m, setM] = useState<Material>(stored || emptyMaterial(company?.defaultVat ?? 19));
  const [nums, setNums] = useState({ sale: price(m.salePrice), purchase: price(m.purchasePrice), stock: m.stock ? qty(m.stock) : '', min: m.minStock ? qty(m.minStock) : '' });
  const [book, setBook] = useState({ qty: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Material>) => setM({ ...m, ...p });
  const live = stored || m;

  if (!isNew && !stored) return <Screen><Text style={s.muted}>Artikel nicht gefunden.</Text></Screen>;

  const save = async () => {
    setBusy(true);
    const next: Material = { ...m, salePrice: parseNumber(nums.sale), purchasePrice: parseNumber(nums.purchase), minStock: parseNumber(nums.min),
      stock: isNew ? parseNumber(nums.stock) : live.stock, movements: isNew ? [] : live.movements };
    const saved = await saveMaterial(next);
    setBusy(false);
    if (saved && isNew) router.replace(`/artikel/${saved.id}`);
    else if (saved) Alert.alert('Gespeichert');
  };

  const bookStock = (sign: 1 | -1) => {
    const n = parseNumber(book.qty);
    if (!n) return;
    commit((d) => A.bookStock(d, live.id, sign * n, book.note || (sign > 0 ? 'Zugang' : 'Entnahme')));
    setBook({ qty: '', note: '' });
  };

  const location = data.locations.find((l) => l.id === live.locationId);

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Neuer Artikel' : m.name || 'Artikel' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <Screen>
          {!isNew ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <Stat label="Bestand" value={`${qty(live.stock)} ${live.unit}`} sub={location ? `Lagerort ${location.code}` : undefined} tone={live.minStock > 0 && live.stock <= live.minStock ? 'danger' : undefined} />
                <Stat label="Verkaufspreis" value={money(live.salePrice)} sub="netto" />
              </View>
              <H>Bestand buchen</H>
              <Card style={{ padding: 14, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 110 }}><Field label="Menge" value={book.qty} onChangeText={(v) => setBook({ ...book, qty: v })} keyboardType="decimal-pad" /></View>
                  <Field label="Notiz" value={book.note} onChangeText={(v) => setBook({ ...book, note: v })} placeholder="z. B. Baustelle Müller" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Button title="Entnahme" icon={Minus} onPress={() => bookStock(-1)} disabled={!parseNumber(book.qty)} /></View>
                  <View style={{ flex: 1 }}><Button title="Zugang" icon={Plus} variant="primary" onPress={() => bookStock(1)} disabled={!parseNumber(book.qty)} /></View>
                </View>
              </Card>
            </>
          ) : null}

          <H>Stammdaten</H>
          <Card style={{ padding: 14, paddingBottom: 2 }}>
            {!isNew ? <Field label="Artikelnummer" value={m.number} editable={false} /> : null}
            <Field label="Bezeichnung" value={m.name} onChangeText={(v) => set({ name: v })} autoFocus={isNew} />
            <Field label="Beschreibung" value={m.description} onChangeText={(v) => set({ description: v })} multiline />
            <Field label="Kategorie" value={m.category} onChangeText={(v) => set({ category: v })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Verkauf netto" value={nums.sale} onChangeText={(v) => setNums({ ...nums, sale: v })} keyboardType="decimal-pad" placeholder="0,00" />
              <Field label="Einkauf netto" value={nums.purchase} onChangeText={(v) => setNums({ ...nums, purchase: v })} keyboardType="decimal-pad" placeholder="0,00" />
            </View>
            <Text style={s.label}>Einheit</Text>
            <Segmented value={m.unit} options={[...new Set([m.unit, ...UNITS])].map((u) => [u, u] as [string, string])} onChange={(u) => set({ unit: u })} />
            {company && !company.smallBusiness ? (
              <>
                <Text style={s.label}>Steuersatz</Text>
                <Segmented value={String(m.vat)} options={vatChoices(company, m.vat).map((r) => [String(r), formatRate(r)] as [string, string])} onChange={(v) => set({ vat: Number(v) })} />
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {isNew ? <Field label="Anfangsbestand" value={nums.stock} onChangeText={(v) => setNums({ ...nums, stock: v })} keyboardType="decimal-pad" /> : null}
              <Field label="Mindestbestand" value={nums.min} onChangeText={(v) => setNums({ ...nums, min: v })} keyboardType="decimal-pad" />
            </View>
            {data.locations.length ? (
              <>
                <Text style={s.label}>Lagerort</Text>
                <Segmented value={m.locationId || '-'} options={[['-', 'Ohne'], ...data.locations.map((l) => [l.id, l.code] as [string, string])]} onChange={(v) => set({ locationId: v === '-' ? '' : v })} />
              </>
            ) : null}
          </Card>
          <Button title={isNew ? 'Artikel anlegen' : 'Speichern'} icon={Save} variant="primary" busy={busy} disabled={!m.name.trim()} onPress={save} />

          {!isNew ? (
            <>
              <H>Lagerbewegungen</H>
              <Card>
                {live.movements.length ? live.movements.slice(0, 40).map((mv, i, a) => (
                  <Row key={mv.id} title={mv.note || (mv.quantity > 0 ? 'Zugang' : 'Entnahme')} sub={formatDate(mv.date)}
                    right={<Text style={{ fontWeight: '700', color: mv.quantity > 0 ? C.success : C.danger }}>{mv.quantity > 0 ? '+' : ''}{qty(mv.quantity)} {live.unit}</Text>} last={i === a.length - 1} />
                )) : <Row title="Noch keine Bewegungen" last />}
              </Card>
              <Button title="Artikel löschen" icon={Trash2} variant="danger" onPress={() => confirm(`${m.name} löschen?`, undefined, 'Löschen', () => { commit((d) => ({ ...d, materials: d.materials.filter((x) => x.id !== live.id) })); router.back(); }, true)} />
            </>
          ) : null}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}
