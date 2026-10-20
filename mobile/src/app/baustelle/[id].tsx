import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Camera, Check, Clock, MapPin, Package, Pencil, ReceiptText, StickyNote, Trash2, TriangleAlert, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '../../components/picker';
import { Badge, Button, Card, Empty, Field, H, Note, Row, Screen, Segmented, Stat, s } from '../../components/ui';
import { confirm, notify } from '../../lib/confirm';
import { useProjects } from '../../lib/projects';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import * as A from '../../lib/actions';
import { docTotals, formatDate, money, parseNumber, qty, round2, today } from '../../shared/calc';
import { ENTRY_KINDS, addPhoto, billable, deleteEntry, emptyEntry, invoiceItems, markBilled, photoUrls, projectSummary, saveEntry } from '../../shared/projects';
import type { EntryKind, ProjectEntry } from '../../shared/projects';

type Tab = 'all' | EntryKind;
const ICONS = { hours: Clock, material: Package, photo: Camera, defect: TriangleAlert, note: StickyNote };

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, companyId, createDoc, commit } = useStore();
  const { projects, entries, setEntries, loading, error, reload } = useProjects(id);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('all');
  const [sheet, setSheet] = useState<EntryKind | null>(null);
  const [busy, setBusy] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => {
    const paths = entries.filter((e) => e.photoPath && !urls[e.photoPath]).map((e) => e.photoPath);
    if (paths.length) photoUrls(supabase, paths).then((u) => setUrls((x) => ({ ...x, ...u }))).catch(() => {});
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = projects?.find((p) => p.id === id);
  if (!projects) return <Screen><Text style={s.muted}>Lädt …</Text></Screen>;
  if (!project) return <Screen><Text style={s.muted}>Baustelle nicht gefunden.</Text></Screen>;

  const company = data.company!;
  const customer = data.customers.find((c) => c.id === project.customerId);
  const sum = projectSummary(entries);
  const open = billable(entries);
  const shown = entries.filter((e) => tab === 'all' || e.kind === tab);
  const address = [project.street, [project.zip, project.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e) { notify('Fehler', (e as Error).message); } finally { setBusy(''); }
  };

  const takePhoto = (source: 'camera' | 'library') => run('photo', async () => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error(source === 'camera' ? 'Bitte erlauben Sie den Zugriff auf die Kamera.' : 'Bitte erlauben Sie den Zugriff auf Ihre Fotos.');
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    for (const a of res.assets) {
      const body = await (await fetch(a.uri)).arrayBuffer();
      const saved = await addPhoto(supabase, companyId!, project.id, body, a.fileName || `foto-${Date.now()}.jpg`, a.mimeType || 'image/jpeg', '', today());
      setEntries((x) => [saved, ...x]);
    }
  });

  const createInvoice = () => {
    if (!open.length) return;
    const items = invoiceItems(open, project, company, data.materials);
    const total = docTotals(items, company.smallBusiness).gross;
    confirm(`Rechnung über ${money(total)} erstellen?`, `${open.length} Einträge werden als abgerechnet markiert. Material wird beim Festschreiben vom Lager abgebucht.`, 'Erstellen', () => run('invoice', async () => {
      const doc = await createDoc('invoice', project.customerId);
      if (!doc) return;
      commit((d) => A.saveDoc(d, { ...doc, subject: `Baustelle ${project.name}${project.city ? `, ${project.city}` : ''}`, items }));
      await markBilled(supabase, companyId!, open.map((e) => e.id), doc.id);
      router.push(`/beleg/${doc.id}`);
    }));
  };

  return (
    <>
      <Stack.Screen options={{ title: project.name, headerRight: () => (
        <Pressable onPress={() => router.push(`/baustelle/bearbeiten?id=${project.id}`)} hitSlop={10} accessibilityLabel="Bearbeiten"><Pencil size={20} color={C.ink} /></Pressable>
      ) }} />
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <Note tone="warning">{error}</Note> : null}
        <Card>
          <Row title={customer?.name || 'Ohne Kunde'} sub={[project.number, address].filter(Boolean).join(' · ')}
            right={address ? <MapPin size={18} color={C.primary} /> : undefined}
            onPress={address ? () => Linking.openURL(Platform.OS === 'ios' ? `maps:?q=${encodeURIComponent(address)}` : `geo:0,0?q=${encodeURIComponent(address)}`) : undefined} last />
        </Card>
        {project.status === 'done' ? <Note>Diese Baustelle ist abgeschlossen.</Note> : null}

        <View style={st.quick}>
          <QuickBtn icon={Clock} label="Stunden" onPress={() => setSheet('hours')} />
          <QuickBtn icon={Package} label="Material" onPress={() => setSheet('material')} />
          <QuickBtn icon={Camera} label={busy === 'photo' ? 'Lädt …' : 'Foto'} onPress={() => takePhoto('camera')} onLongPress={() => takePhoto('library')} />
          <QuickBtn icon={TriangleAlert} label="Mangel" onPress={() => setSheet('defect')} />
          <QuickBtn icon={StickyNote} label="Notiz" onPress={() => setSheet('note')} />
        </View>
        <Text style={[s.mutedSmall, { textAlign: 'center', marginTop: -6, marginBottom: 12 }]}>Foto lange drücken: aus der Galerie wählen</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <Stat label="Regiestunden" value={`${qty(sum.hours)} Std.`} sub={`${qty(sum.openHours)} offen`} />
          <Stat label="Noch abzurechnen" value={money(sum.openValue)} sub={sum.openDefects ? `${sum.openDefects} ${sum.openDefects === 1 ? 'Mangel' : 'Mängel'} offen` : 'netto'} tone={sum.openValue ? 'success' : undefined} />
        </View>
        <Button title={busy === 'invoice' ? 'Erstelle …' : 'Rechnung erstellen'} icon={ReceiptText} variant="primary" disabled={!open.length || !!busy} onPress={createInvoice} />

        <H>Erfasst</H>
        <Segmented value={tab} options={[['all', 'Alles'], ['hours', 'Stunden'], ['material', 'Material'], ['photo', 'Fotos'], ['defect', 'Mängel'], ['note', 'Notizen']]} onChange={setTab} />
        {tab === 'photo' ? (
          <View style={st.grid}>
            {shown.map((e) => (
              <Pressable key={e.id} style={st.thumb} onPress={() => urls[e.photoPath] && setViewer(urls[e.photoPath])}
                onLongPress={() => confirm('Foto löschen?', undefined, 'Löschen', () => run('del', async () => { await deleteEntry(supabase, companyId!, e); setEntries((x) => x.filter((y) => y.id !== e.id)); }), true)}>
                {urls[e.photoPath] ? <Image source={{ uri: urls[e.photoPath] }} style={StyleSheet.absoluteFill} /> : <Camera size={22} color={C.muted} />}
              </Pressable>
            ))}
            {!shown.length ? <Empty icon={Camera} title="Noch keine Fotos" /> : null}
          </View>
        ) : (
          <Card>
            {shown.length ? shown.map((e, i) => {
              const Icon = ICONS[e.kind];
              const value = e.kind === 'hours' || e.kind === 'material' ? money(round2(e.quantity * e.unitPrice)) : undefined;
              return (
                <Row key={e.id} icon={Icon}
                  title={e.kind === 'hours' ? `${qty(e.quantity)} Std.${e.person ? ` · ${e.person}` : ''}` : e.kind === 'material' ? `${qty(e.quantity)} ${e.unit} ${e.description}` : e.description || ENTRY_KINDS[e.kind].one}
                  sub={`${formatDate(e.date)}${e.kind === 'hours' && e.description ? ` · ${e.description}` : ''}`}
                  right={e.kind === 'defect' ? <Badge label={e.status === 'done' ? 'Behoben' : 'Offen'} tone={e.status === 'done' ? 'success' : 'warning'} /> : value}
                  rightSub={e.invoiceId ? 'abgerechnet' : value ? 'offen' : undefined}
                  last={i === shown.length - 1}
                  onPress={() => {
                    if (e.kind === 'photo') { if (urls[e.photoPath]) setViewer(urls[e.photoPath]); return; }
                    if (e.kind === 'defect') return run('u', async () => { const saved = await saveEntry(supabase, companyId!, { ...e, status: e.status === 'done' ? 'open' : 'done' }); setEntries((x) => x.map((y) => (y.id === e.id ? saved : y))); });
                    if (e.invoiceId) return;
                    confirm(`${ENTRY_KINDS[e.kind].one} löschen?`, undefined, 'Löschen', () => run('del', async () => { await deleteEntry(supabase, companyId!, e); setEntries((x) => x.filter((y) => y.id !== e.id)); }), true);
                  }} />
              );
            }) : <Empty icon={Check} title="Noch nichts erfasst" text="Tippen Sie oben auf Stunden, Material, Foto, Mangel oder Notiz." />}
          </Card>
        )}
        <Text style={[s.mutedSmall, { textAlign: 'center' }]}>Mangel antippen: offen/behoben · Eintrag antippen: löschen</Text>
      </Screen>

      {sheet ? <EntrySheet kind={sheet} rate={project.hourlyRate} onClose={() => setSheet(null)}
        onSave={(e) => run('add', async () => { const saved = await saveEntry(supabase, companyId!, { ...e, projectId: project.id }); setEntries((x) => [saved, ...x]); setSheet(null); })} /> : null}

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={st.viewer} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <X size={28} color="#fff" style={{ position: 'absolute', top: 54, right: 20 }} />
        </Pressable>
      </Modal>
    </>
  );
}

function QuickBtn({ icon: Icon, label, onPress, onLongPress }: { icon: typeof Clock; label: string; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [st.qb, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={st.qbIcon}><Icon size={22} color="#fff" /></View>
      <Text style={st.qbText}>{label}</Text>
    </Pressable>
  );
}

/** Erfassung: Regiestunden, Material, Mangel, Notiz */
function EntrySheet({ kind, rate, onClose, onSave }: { kind: EntryKind; rate: number; onClose: () => void; onSave: (e: ProjectEntry) => void }) {
  const { data } = useStore();
  const [e, setE] = useState<ProjectEntry>({ ...emptyEntry('', kind, today()), unitPrice: kind === 'hours' ? rate : 0 });
  const [nums, setNums] = useState({ q: kind === 'hours' || kind === 'material' ? '1' : '', price: kind === 'hours' && rate ? rate.toFixed(2).replace('.', ',') : '' });
  const [pick, setPick] = useState(false);
  const set = (p: Partial<ProjectEntry>) => setE({ ...e, ...p });
  const ok = kind === 'hours' ? parseNumber(nums.q) > 0 : kind === 'material' ? parseNumber(nums.q) > 0 && !!e.description.trim() : !!e.description.trim();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <Text style={[s.h, { flex: 1, fontSize: 19 }]}>{ENTRY_KINDS[kind].one}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Schließen"><X size={24} color={C.ink} /></Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            {kind === 'hours' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field label="Stunden" value={nums.q} onChangeText={(v) => setNums({ ...nums, q: v })} keyboardType="decimal-pad" autoFocus />
                  <Field label="Stundensatz" value={nums.price} onChangeText={(v) => setNums({ ...nums, price: v })} keyboardType="decimal-pad" placeholder="0,00" />
                </View>
                <Field label="Wer" value={e.person} onChangeText={(v) => set({ person: v })} placeholder="z. B. Thomas" />
                <Field label="Tätigkeit" value={e.description} onChangeText={(v) => set({ description: v })} multiline placeholder="z. B. Verteiler gesetzt, Leitungen gezogen" />
              </>
            ) : kind === 'material' ? (
              <>
                <Button title={e.materialId ? e.description : 'Artikel aus dem Lager wählen'} icon={Package} onPress={() => setPick(true)} />
                <View style={{ height: 12 }} />
                {!e.materialId ? <Field label="Oder frei eingeben" value={e.description} onChangeText={(v) => set({ description: v })} /> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field label={`Menge${e.unit ? ` (${e.unit})` : ''}`} value={nums.q} onChangeText={(v) => setNums({ ...nums, q: v })} keyboardType="decimal-pad" />
                  <Field label="Preis netto" value={nums.price} onChangeText={(v) => setNums({ ...nums, price: v })} keyboardType="decimal-pad" placeholder="0,00" />
                </View>
              </>
            ) : (
              <Field label={kind === 'defect' ? 'Was ist der Mangel?' : 'Notiz'} value={e.description} onChangeText={(v) => set({ description: v })} multiline autoFocus
                placeholder={kind === 'defect' ? 'z. B. FI-Schalter Bad löst aus' : ''} />
            )}
            <Field label="Datum (TT.MM.JJJJ)" value={formatDate(e.date)} onChangeText={(v) => { const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) set({ date: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }); }} keyboardType="numbers-and-punctuation" />
            <Button title="Eintragen" variant="primary" icon={Check} disabled={!ok} onPress={() => onSave({ ...e, quantity: parseNumber(nums.q), unitPrice: parseNumber(nums.price) })} />
          </ScrollView>
        </KeyboardAvoidingView>
        <Picker visible={pick} title="Artikel wählen" placeholder="Artikel, Nummer …" onClose={() => setPick(false)}
          items={data.materials.map((m) => ({ id: m.id, title: m.name, sub: `${m.number} · ${qty(m.stock)} ${m.unit} am Lager`, right: money(m.salePrice), search: `${m.name} ${m.number} ${m.category}` }))}
          onPick={(mid) => {
            const m = data.materials.find((x) => x.id === mid)!;
            set({ materialId: m.id, description: m.name, unit: m.unit, vat: m.vat });
            setNums({ ...nums, price: m.salePrice ? m.salePrice.toFixed(2).replace('.', ',') : '' });
            setPick(false);
          }} />
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  quick: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  qb: { alignItems: 'center', gap: 6, flex: 1 },
  qbIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  qbText: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  thumb: { width: '31.5%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
});
