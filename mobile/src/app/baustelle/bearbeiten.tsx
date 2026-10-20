import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Picker } from '../../components/picker';
import { Button, Card, Field, H, Row, Screen, Segmented, s } from '../../components/ui';
import { useProjects } from '../../lib/projects';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { parseNumber, today } from '../../shared/calc';
import { emptyProject, saveProject } from '../../shared/projects';
import type { Project } from '../../shared/projects';

/** Baustelle anlegen (ohne id) oder bearbeiten (?id=…) */
export default function EditProject() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, companyId } = useStore();
  const { projects } = useProjects();
  const [p, setP] = useState<Project>({ ...emptyProject(), startDate: today() });
  const [rate, setRate] = useState('');
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const found = id ? projects?.find((x) => x.id === id) : undefined;
    if (found) { setP(found); setRate(found.hourlyRate ? found.hourlyRate.toFixed(2).replace('.', ',') : ''); }
  }, [id, projects]);
  const set = (patch: Partial<Project>) => setP({ ...p, ...patch });
  const customer = data.customers.find((c) => c.id === p.customerId);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveProject(supabase, companyId!, { ...p, name: p.name.trim(), hourlyRate: parseNumber(rate) });
      if (id) router.back(); else router.replace(`/baustelle/${saved.id}`);
    } catch (e) {
      Alert.alert('Nicht gespeichert', (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: id ? 'Baustelle bearbeiten' : 'Neue Baustelle' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <Screen>
          <H>Kunde</H>
          <Card><Row title={customer?.name || 'Kunde wählen'} sub={customer ? [customer.street, customer.city].filter(Boolean).join(', ') : 'optional'} onPress={() => setPick(true)} last /></Card>
          <H>Baustelle</H>
          <Card style={{ padding: 14, paddingBottom: 2 }}>
            <Field label="Bezeichnung" value={p.name} onChangeText={(v) => set({ name: v })} placeholder="z. B. EFH Huber – Elektroinstallation" />
            <Field label="Straße" value={p.street} onChangeText={(v) => set({ street: v })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 110 }}><Field label="PLZ" value={p.zip} onChangeText={(v) => set({ zip: v })} keyboardType="number-pad" /></View>
              <Field label="Ort" value={p.city} onChangeText={(v) => set({ city: v })} />
            </View>
            <Field label="Stundensatz netto (Regiestunden)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0,00" />
            <Field label="Notizen" value={p.notes} onChangeText={(v) => set({ notes: v })} multiline placeholder="Zugang, Ansprechpartner vor Ort, Schlüssel …" />
            {id ? (
              <>
                <Text style={s.label}>Status</Text>
                <Segmented value={p.status} options={[['active', 'Laufend'], ['done', 'Abgeschlossen']]} onChange={(v) => set({ status: v })} />
              </>
            ) : null}
          </Card>
          <Button title={id ? 'Speichern' : 'Baustelle anlegen'} icon={Save} variant="primary" busy={busy} disabled={!p.name.trim()} onPress={save} />
        </Screen>
      </KeyboardAvoidingView>
      <Picker visible={pick} title="Kunde wählen" placeholder="Name, Nummer, Ort …" onClose={() => setPick(false)}
        items={data.customers.map((c) => ({ id: c.id, title: c.name, sub: `${c.number}${c.city ? ` · ${c.city}` : ''}`, search: `${c.name} ${c.number} ${c.city}` }))}
        onPick={(cid) => {
          const c = data.customers.find((x) => x.id === cid)!;
          set({ customerId: c.id, ...(!p.street && !p.city ? { street: c.street, zip: c.zip, city: c.city } : {}), ...(!p.name ? { name: `${c.name}${c.city ? ` – ${c.city}` : ''}` } : {}) });
          setPick(false);
        }} />
    </>
  );
}
