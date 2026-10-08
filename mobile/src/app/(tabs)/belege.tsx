import { router } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Row, Screen, Search, Segmented } from '../../components/ui';
import { displayStatus, docTotals, formatDate, isOverdue, money } from '../../shared/calc';
import { DOC_KINDS } from '../../shared/docs';
import type { DocKind } from '../../shared/types';
import { DOC_KIND_LIST } from '../../shared/types';
import { useStore } from '../../lib/store';
import { useNewDoc } from '../../lib/hooks';

export default function Documents() {
  const { data, loading, reload } = useStore();
  const newDoc = useNewDoc();
  const [kind, setKind] = useState<DocKind>('invoice');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const small = !!data.company?.smallBusiness;
  const cfg = DOC_KINDS[kind];

  const list = useMemo(() => data.documents
    .filter((d) => d.kind === kind)
    .filter((d) => filter === 'all' || (filter === 'overdue' ? isOverdue(d) : d.status === filter))
    .filter((d) => !q || `${d.number} ${d.recipient.name} ${d.subject}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number)), [data.documents, kind, filter, q]);

  const filters: [string, string][] = [['all', 'Alle'], ...Object.entries(cfg.status).map(([k, v]) => [k, k === 'draft' ? 'Entwürfe' : v!.label] as [string, string]), ...(kind === 'invoice' ? [['overdue', 'Überfällig'] as [string, string]] : [])];

  return (
      <Screen refreshing={loading} onRefresh={reload}>
        <Segmented value={kind} options={DOC_KIND_LIST.map((k) => [k, DOC_KINDS[k].many])} onChange={(k) => { setKind(k); setFilter('all'); }} />
        <Segmented value={filter} options={filters} onChange={setFilter} />
        <Search value={q} onChange={setQ} placeholder={`Nummer, ${cfg.partner}, Betreff …`} />
        <Button title={`${cfg.article === 'ein' ? (kind === 'delivery' ? 'Neuer' : 'Neues') : 'Neue'} ${cfg.one}`} icon={Plus} variant="primary" onPress={() => newDoc(kind)} />
        <Card style={{ marginTop: 14 }}>
          {list.length ? list.map((d, i) => {
            const st = displayStatus(d);
            return (
              <Row key={d.id} title={d.number} sub={`${d.recipient.name || `Kein ${cfg.partner}`}${d.subject ? ` · ${d.subject}` : ''}`}
                right={<Badge label={st.label} tone={st.tone} />}
                rightSub={`${cfg.prices ? money(docTotals(d.items, small).gross) + ' · ' : ''}${formatDate(d.date)}`}
                last={i === list.length - 1} onPress={() => router.push(`/beleg/${d.id}`)} />
            );
          }) : <Empty icon={FileText} title={`Keine ${cfg.many}`} text={q || filter !== 'all' ? 'Keine Treffer für diesen Filter.' : cfg.emptyText} />}
        </Card>
      </Screen>
  );
}
