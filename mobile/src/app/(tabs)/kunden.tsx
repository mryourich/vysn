import { router } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Button, Card, Empty, Row, Screen, Search } from '../../components/ui';
import { docTotals, money } from '../../shared/calc';
import { useStore } from '../../lib/store';

export default function Customers() {
  const { data, loading, reload } = useStore();
  const [q, setQ] = useState('');
  const small = !!data.company?.smallBusiness;
  const openBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data.documents) if (d.kind === 'invoice' && d.status === 'sent') m.set(d.customerId, (m.get(d.customerId) || 0) + docTotals(d.items, small).gross);
    return m;
  }, [data.documents, small]);
  const list = data.customers
    .filter((c) => !q || `${c.name} ${c.contactPerson} ${c.city} ${c.number} ${c.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Search value={q} onChange={setQ} placeholder="Name, Ort, Kundennummer …" />
      <Button title="Neuer Kunde" icon={Plus} variant="primary" onPress={() => router.push('/kunde/neu')} />
      <Card style={{ marginTop: 14 }}>
        {list.length ? list.map((c, i) => (
          <Row key={c.id} title={c.name} sub={`${c.number}${c.city ? ` · ${c.city}` : ''}`}
            right={openBy.get(c.id) ? money(openBy.get(c.id)!) : undefined} rightSub={openBy.get(c.id) ? 'offen' : undefined}
            last={i === list.length - 1} onPress={() => router.push(`/kunde/${c.id}`)} />
        )) : <Empty icon={Users} title={q ? 'Keine Treffer' : 'Noch keine Kunden'} text={q ? undefined : 'Legen Sie Ihre Kunden an – Anschrift und Nummer kommen dann automatisch in jeden Beleg.'} />}
      </Card>
    </Screen>
  );
}
