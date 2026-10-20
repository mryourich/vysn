import { router, useFocusEffect } from 'expo-router';
import { HardHat, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Note, Row, Screen, Search, Segmented, Stat } from '../../components/ui';
import { useProjects } from '../../lib/projects';
import { useStore } from '../../lib/store';
import { money, qty } from '../../shared/calc';
import { projectSummary } from '../../shared/projects';

export default function Projects() {
  const { data } = useStore();
  const { projects, entries, loading, error, reload } = useProjects();
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active');
  const [q, setQ] = useState('');
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const customer = (id: string) => data.customers.find((c) => c.id === id)?.name || '';
  const list = (projects || [])
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => !q || `${p.name} ${p.number} ${p.city} ${customer(p.customerId)}`.toLowerCase().includes(q.toLowerCase()));
  const active = (projects || []).filter((p) => p.status === 'active');
  const total = projectSummary(entries.filter((e) => active.some((p) => p.id === e.projectId)));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <Note tone="warning">{error}</Note> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Stat label="Offene Regiestunden" value={`${qty(total.openHours)} Std.`} />
        <Stat label="Noch abzurechnen" value={money(total.openValue)} tone={total.openValue ? 'success' : undefined} />
      </View>
      <Button title="Neue Baustelle" icon={Plus} variant="primary" onPress={() => router.push('/baustelle/bearbeiten')} />
      <View style={{ height: 12 }} />
      <Segmented value={filter} options={[['active', 'Laufend'], ['done', 'Abgeschlossen'], ['all', 'Alle']]} onChange={setFilter} />
      <Search value={q} onChange={setQ} placeholder="Baustelle, Kunde, Ort …" />
      <Card>
        {list.length ? list.map((p, i) => {
          const s = projectSummary(entries.filter((e) => e.projectId === p.id));
          return (
            <Row key={p.id} icon={HardHat} title={p.name} sub={[p.number, customer(p.customerId), p.city].filter(Boolean).join(' · ')}
              right={s.openValue ? money(s.openValue) : undefined} rightSub={s.openDefects ? `${s.openDefects} ${s.openDefects === 1 ? 'Mangel' : 'Mängel'} offen` : s.openHours ? `${qty(s.openHours)} Std. offen` : undefined}
              last={i === list.length - 1} onPress={() => router.push(`/baustelle/${p.id}`)} />
          );
        }) : <Empty icon={HardHat} title={projects?.length ? 'Keine Treffer' : 'Noch keine Baustellen'} text={projects?.length ? undefined : 'Legen Sie eine Baustelle an und erfassen Sie vor Ort Stunden, Material, Fotos und Mängel.'} />}
      </Card>
    </Screen>
  );
}
