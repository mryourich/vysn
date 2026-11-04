import { router } from 'expo-router';
import { AlertTriangle, FilePlus2, Mic, ReceiptText, ScanLine } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Empty, H, Row, Screen, Stat } from '../../components/ui';
import { MONTHS_LONG, displayStatus, docTotals, formatDate, isOverdue, money, qty, today } from '../../shared/calc';
import { DOC_KINDS } from '../../shared/docs';
import { useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import { useNewDoc } from '../../lib/hooks';

export default function Dashboard() {
  const { data, loading, reload, error, aiBooked } = useStore();
  const newDoc = useNewDoc();
  const small = !!data.company?.smallBusiness;
  const month = today().slice(0, 7);
  const invoices = data.documents.filter((d) => d.kind === 'invoice');
  const open = invoices.filter((d) => d.status === 'sent');
  const overdue = open.filter(isOverdue);
  const sum = (list: typeof invoices, f: 'net' | 'gross') => list.reduce((s, d) => s + docTotals(d.items, small)[f], 0);
  const monthRevenue = sum(invoices.filter((d) => (d.status === 'sent' || d.status === 'paid') && d.date.startsWith(month)), 'net');
  const openOffers = data.documents.filter((d) => d.kind === 'offer' && d.status === 'sent');
  const lowStock = data.materials.filter((m) => m.minStock > 0 && m.stock <= m.minStock);
  const recent = [...data.documents].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date)).slice(0, 6);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Text style={st.hello}>{data.company?.name || 'VYSNER One'}</Text>
      {error ? <Text style={{ color: C.danger, marginBottom: 10 }}>{error}</Text> : null}
      <View style={st.actions}>
        <Quick icon={ReceiptText} label="Rechnung" onPress={() => newDoc('invoice')} />
        <Quick icon={FilePlus2} label="Angebot" onPress={() => newDoc('offer')} />
        <Quick icon={ScanLine} label="Scannen" onPress={() => router.push('/scanner')} />
        <Quick icon={Mic} label="KI" onPress={() => router.push('/assistent')} dim={!aiBooked} />
      </View>
      <View style={st.stats}>
        <Stat label="Offene Rechnungen" value={money(sum(open, 'gross'))} sub={`${open.length} offen`} />
        <Stat label="Überfällig" value={money(sum(overdue, 'gross'))} sub={`${overdue.length} Rechnungen`} tone={overdue.length ? 'danger' : undefined} />
        <Stat label={`Umsatz ${MONTHS_LONG[Number(month.slice(5)) - 1]}`} value={money(monthRevenue)} sub="netto" tone="success" />
        <Stat label="Offene Angebote" value={money(sum(openOffers, 'net'))} sub={`${openOffers.length} versendet`} />
      </View>

      {lowStock.length ? (
        <>
          <H>Mindestbestand unterschritten</H>
          <Card>
            {lowStock.slice(0, 5).map((m, i, a) => (
              <Row key={m.id} icon={AlertTriangle} title={m.name} sub={m.number} right={`${qty(m.stock)} ${m.unit}`} rightSub={`min. ${qty(m.minStock)}`} last={i === a.length - 1} onPress={() => router.push(`/artikel/${m.id}`)} />
            ))}
          </Card>
        </>
      ) : null}

      <H>Zuletzt bearbeitet</H>
      <Card>
        {recent.length ? recent.map((d, i) => {
          const st2 = displayStatus(d);
          return (
            <Row key={d.id} title={`${DOC_KINDS[d.kind].one} ${d.number}`} sub={`${d.recipient.name || 'Ohne Empfänger'} · ${formatDate(d.date)}`}
              right={<Badge label={st2.label} tone={st2.tone} />} rightSub={DOC_KINDS[d.kind].prices ? money(docTotals(d.items, small).gross) : undefined}
              last={i === recent.length - 1} onPress={() => router.push(`/beleg/${d.id}`)} />
          );
        }) : <Empty icon={ReceiptText} title="Noch keine Belege" text="Erstellen Sie Ihr erstes Angebot oder Ihre erste Rechnung." />}
      </Card>
    </Screen>
  );
}

function Quick({ icon: Icon, label, onPress, dim }: { icon: typeof Mic; label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.quick, pressed && { opacity: 0.7 }, dim && { opacity: 0.55 }]}>
      <View style={st.quickIcon}><Icon size={22} color="#fff" /></View>
      <Text style={st.quickText}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  hello: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  quick: { alignItems: 'center', gap: 6, flex: 1 },
  quickIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
});
