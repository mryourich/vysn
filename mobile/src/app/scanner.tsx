import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MapPin, ScanLine } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Field, H, Note, Row, Screen } from '../components/ui';
import { useStore } from '../lib/store';
import { C } from '../lib/theme';
import { qty } from '../shared/calc';

/** Liest l/m/c aus einem Etikett (URL von vysnone.com) oder einen Klartext-Code – wie auf der Website. */
function parseScan(text: string): { location?: string; material?: string; company?: string; code?: string } {
  const m = text.match(/\/app\/scan\?(.*)$/);
  if (m) {
    const p = new URLSearchParams(m[1]);
    return { location: p.get('l') || undefined, material: p.get('m') || undefined, company: p.get('c') || undefined };
  }
  return { code: text.trim() };
}

export default function Scanner() {
  const { data, companyId, companies, switchCompany } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [locationId, setLocationId] = useState('');
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState('');
  const lock = useRef(false);

  const open = async (text: string) => {
    if (lock.current) return;
    lock.current = true;
    setTimeout(() => { lock.current = false; }, 1500);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setMessage('');
    const r = parseScan(text);
    if (r.company && r.company !== companyId) {
      if (!companies.some((c) => c.id === r.company)) return setMessage('Dieses Etikett gehört zu einer Firma, auf die Sie keinen Zugriff haben.');
      await switchCompany(r.company);
    }
    let material = r.material;
    let location = r.location;
    if (r.code) {
      const code = r.code.toLowerCase();
      location = data.locations.find((l) => l.code.toLowerCase() === code)?.id;
      material = location ? undefined : data.materials.find((x) => x.number.toLowerCase() === code)?.id;
      if (!location && !material) return setMessage(`Kein Lagerplatz oder Artikel mit „${r.code}“ gefunden.`);
    }
    if (material) return router.push(`/artikel/${material}`);
    if (location) setLocationId(location);
  };

  const location = data.locations.find((l) => l.id === locationId);
  if (location) {
    const items = data.materials.filter((m) => m.locationId === location.id);
    return (
      <Screen>
        <H sub={location.name}>Lagerplatz {location.code}</H>
        <Card>
          {items.length ? items.map((m, i) => (
            <Row key={m.id} title={m.name} sub={m.number} right={`${qty(m.stock)} ${m.unit}`} last={i === items.length - 1} onPress={() => router.push(`/artikel/${m.id}`)} />
          )) : <Empty icon={MapPin} title="Keine Artikel an diesem Platz" />}
        </Card>
        <Button title="Neuer Scan" icon={ScanLine} variant="primary" onPress={() => setLocationId('')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {!permission ? null : !permission.granted ? (
        <Card style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: C.ink2, fontSize: 15 }}>Für den Scanner braucht VYSNER One Zugriff auf die Kamera.</Text>
          <Button title="Kamera erlauben" variant="primary" onPress={requestPermission} />
        </Card>
      ) : (
        <View style={st.camWrap}>
          <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13'] }} onBarcodeScanned={({ data: text }) => open(text)} />
          <View style={st.frame} />
        </View>
      )}
      <Text style={{ color: C.muted, textAlign: 'center', marginVertical: 12 }}>QR-Etikett eines Lagerplatzes oder Artikels in den Rahmen halten.</Text>
      {message ? <Note tone="warning">{message}</Note> : null}
      <Field label="Oder Code eingeben" value={manual} onChangeText={setManual} placeholder="z. B. A-01 oder ART-0003" autoCapitalize="characters" onSubmitEditing={() => manual.trim() && open(manual)} returnKeyType="search" />
      <Button title="Öffnen" onPress={() => manual.trim() && open(manual)} disabled={!manual.trim()} />
    </Screen>
  );
}

const st = StyleSheet.create({
  camWrap: { height: 360, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
});
