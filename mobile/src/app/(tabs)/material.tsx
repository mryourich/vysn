import { router } from 'expo-router';
import { Boxes, Plus, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Empty, Row, Screen, Search } from '../../components/ui';
import { money, qty } from '../../shared/calc';
import { useStore } from '../../lib/store';

export default function Materials() {
  const { data, loading, reload } = useStore();
  const [q, setQ] = useState('');
  const list = data.materials
    .filter((m) => !q || `${m.name} ${m.number} ${m.category} ${m.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Search value={q} onChange={setQ} placeholder="Artikel, Nummer, Kategorie …" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Neuer Artikel" icon={Plus} variant="primary" onPress={() => router.push('/artikel/neu')} /></View>
        <Button title="Scannen" icon={ScanLine} onPress={() => router.push('/scanner')} />
      </View>
      <Card style={{ marginTop: 14 }}>
        {list.length ? list.map((m, i) => {
          const low = m.minStock > 0 && m.stock <= m.minStock;
          return (
            <Row key={m.id} title={m.name} sub={`${m.number}${m.category ? ` · ${m.category}` : ''} · ${money(m.salePrice)}`}
              right={low ? <Badge label={`${qty(m.stock)} ${m.unit}`} tone="warning" /> : `${qty(m.stock)} ${m.unit}`}
              rightSub={low ? 'unter Mindestbestand' : 'Bestand'} last={i === list.length - 1} onPress={() => router.push(`/artikel/${m.id}`)} />
          );
        }) : <Empty icon={Boxes} title={q ? 'Keine Treffer' : 'Noch keine Artikel'} text={q ? undefined : 'Legen Sie Material und Leistungen an – mit Preis, Einheit und Lagerbestand.'} />}
      </Card>
    </Screen>
  );
}
