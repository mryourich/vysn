import { Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lineNet, money, parseNumber, qty } from '../shared/calc';
import { UNITS } from '../shared/defaults';
import { formatRate, vatChoices } from '../shared/tax';
import type { Company, LineItem } from '../shared/types';
import { C } from '../lib/theme';
import { Button, Field, Segmented, s } from './ui';

const numText = (n: number) => (n ? qty(n) : '');

/** Position bearbeiten (Bezeichnung, Menge, Preis, USt., Rabatt, Optional/Alternative) */
export function ItemSheet({ item, company, prices, offer, isChild, onSave, onDelete, onClose }: {
  item: LineItem | null; company: Company; prices: boolean; offer: boolean; isChild: boolean;
  onSave: (i: LineItem) => void; onDelete: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<LineItem | null>(item);
  const [q, setQ] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  useEffect(() => {
    setDraft(item);
    if (item) { setQ(qty(item.quantity)); setPrice(item.unitPrice ? item.unitPrice.toFixed(2).replace('.', ',') : ''); setDiscount(numText(item.discount)); }
  }, [item]);
  if (!draft) return null;
  const current: LineItem = { ...draft, quantity: parseNumber(q), unitPrice: parseNumber(price), discount: Math.min(100, parseNumber(discount)) };
  const set = (p: Partial<LineItem>) => setDraft({ ...draft, ...p });
  const rates = vatChoices(company, draft.vat);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <Text style={[s.h, { flex: 1, fontSize: 19 }]}>Position</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Schließen"><X size={24} color={C.ink} /></Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            <Field label="Bezeichnung" value={draft.description} onChangeText={(v) => set({ description: v })} autoFocus={!draft.description} />
            <Field label="Beschreibung (optional)" value={draft.details} onChangeText={(v) => set({ details: v })} multiline />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Menge" value={q} onChangeText={setQ} keyboardType="decimal-pad" />
              {prices ? <Field label="Einzelpreis (netto)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0,00" /> : null}
            </View>
            <Text style={s.label}>Einheit</Text>
            <Segmented value={draft.unit} options={[...new Set([draft.unit, ...UNITS])].map((u) => [u, u] as [string, string])} onChange={(u) => set({ unit: u })} />
            {prices && !company.smallBusiness ? (
              <>
                <Text style={s.label}>Steuersatz</Text>
                <Segmented value={String(draft.vat)} options={rates.map((r) => [String(r), formatRate(r)] as [string, string])} onChange={(v) => set({ vat: Number(v) })} />
              </>
            ) : null}
            {prices ? <Field label="Rabatt in %" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" /> : null}
            {offer && !isChild ? (
              <>
                <Text style={s.label}>Art der Position</Text>
                <Segmented value={draft.variant || 'normal'} options={[['normal', 'Normal'], ['optional', 'Optional'], ['alternative', 'Alternative']]}
                  onChange={(v) => set({ variant: v === 'normal' ? undefined : (v as 'optional' | 'alternative'), chosen: v === 'normal' ? undefined : draft.chosen })} />
              </>
            ) : null}
            {offer && (draft.variant || isChild) ? (
              <Segmented value={draft.chosen ? 'yes' : 'no'} options={[['no', 'Nicht gewählt'], ['yes', 'Vom Kunden gewählt']]} onChange={(v) => set({ chosen: v === 'yes' })} />
            ) : null}
            {prices ? <Text style={[s.h, { textAlign: 'right', marginVertical: 8 }]}>{draft.variant || isChild ? `(${money(lineNet(current))})` : money(lineNet(current))}</Text> : null}
            <View style={{ gap: 10, marginTop: 6 }}>
              <Button title="Übernehmen" variant="primary" onPress={() => onSave(current)} disabled={!draft.description.trim()} />
              <Button title="Position löschen" variant="danger" icon={Trash2} onPress={onDelete} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
