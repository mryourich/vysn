import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Building2, ExternalLink, FileText, Globe, LogOut, Mic, Repeat, ScanLine, Shield } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Badge, Card, H, Row, Screen, s } from '../../components/ui';
import { SITE_URL } from '../../lib/supabase';
import { confirm } from '../../lib/confirm';
import { useStore } from '../../lib/store';
import { PLANS, USAGE_KINDS, usageQuota } from '../../shared/plans';

export default function More() {
  const { data, session, companies, signOut, aiBooked, saving } = useStore();
  const company = data.company;
  const plan = company?.plan || 'start';
  const limited = PLANS[plan].monthlyLimit !== null;
  return (
    <Screen>
      <Card>
        <Row icon={Building2} title={company?.name || 'Firma'} sub={[company?.street, [company?.zip, company?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined}
          right={<Badge label={`Tarif ${PLANS[plan].label}`} tone="success" />} last={companies.length < 2} />
        {companies.length > 1 ? <Row icon={Repeat} title="Firma wechseln" sub={`${companies.length} Firmen`} last onPress={() => router.push('/firmen')} /> : null}
      </Card>

      {limited && data.company ? (
        <>
          <H sub="Kontingent in diesem Monat">Tarif {PLANS[plan].label}</H>
          <Card>
            {USAGE_KINDS.map((k, i) => {
              const q = usageQuota(data, k.kind);
              return <Row key={k.kind} title={k.many} right={`${q.used} / ${q.limit}`} last={i === USAGE_KINDS.length - 1} />;
            })}
          </Card>
          <Text style={[s.mutedSmall, { marginTop: -6, marginBottom: 14 }]}>Tarife und Zusatzbuchungen verwalten Sie im Browser in Ihrem Konto. In der App gilt der gebuchte Umfang automatisch.</Text>
        </>
      ) : null}

      <H>Werkzeuge</H>
      <Card>
        <Row icon={ScanLine} title="Lager-Scanner" sub="QR-Etiketten scannen und buchen" onPress={() => router.push('/scanner')} />
        <Row icon={Mic} title="KI-Sprachassistent" sub={aiBooked ? 'Belege per Sprache, Fragen zu Ihren Zahlen' : 'Zusatzbuchung – nicht gebucht'} last onPress={() => router.push('/assistent')} />
      </Card>

      <H>Weitere Bereiche</H>
      <Card>
        <Row icon={Globe} title="Buchführung, Berichte, Einstellungen" sub="Im Browser auf vysnone.com" right={<ExternalLink size={16} color="#667085" />} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/app`)} />
        <Row icon={Shield} title="Datenschutz" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/datenschutz`)} />
        <Row icon={FileText} title="Impressum" last onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/impressum`)} />
      </Card>

      <Card>
        <Row icon={LogOut} title="Abmelden" sub={session?.user.email} last onPress={() => confirm('Abmelden?', undefined, 'Abmelden', signOut, true)} />
      </Card>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={s.mutedSmall}>VYSNER One · Version {Constants.expoConfig?.version}</Text>
        <Text style={s.mutedSmall}>{saving ? 'Speichert …' : 'Alle Änderungen gespeichert'}</Text>
      </View>
    </Screen>
  );
}
