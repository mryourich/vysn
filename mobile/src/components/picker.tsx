import { X } from 'lucide-react-native';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../lib/theme';
import { Row, Search, s } from './ui';

export type PickItem = { id: string; title: string; sub?: string; right?: string; search: string };

/** Vollbild-Auswahl mit Suche (Kunden, Artikel) */
export function Picker({ visible, title, items, onPick, onClose, footer, placeholder = 'Suchen …' }: {
  visible: boolean; title: string; items: PickItem[]; onPick: (id: string) => void; onClose: () => void; footer?: ReactNode; placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const list = items.filter((i) => !q || i.search.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <Text style={[s.h, { flex: 1, fontSize: 19 }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Schließen"><X size={24} color={C.ink} /></Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: 16 }}><Search value={q} onChange={setQ} placeholder={placeholder} /></View>
          {footer ? <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>{footer}</View> : null}
          <FlatList data={list} keyExtractor={(i) => i.id} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item, index }) => (
              <View style={[{ borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.line, overflow: 'hidden' }, index === 0 && { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16 }, index === list.length - 1 && { borderBottomWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }]}>
                <Row title={item.title} sub={item.sub} right={item.right} last={index === list.length - 1} onPress={() => { setQ(''); onPick(item.id); }} />
              </View>
            )}
            ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', padding: 24 }]}>Keine Treffer</Text>} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
