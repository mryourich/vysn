import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LogIn } from 'lucide-react-native';
import { SITE_URL, supabase } from '../lib/supabase';
import { C } from '../lib/theme';
import { Button, Field } from './ui';

/** Anmeldung mit dem Konto von vysnone.com. Registrieren und Passwort vergessen laufen über die Website. */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (e) setError(/invalid/i.test(e.message) ? 'E-Mail oder Passwort ist falsch.' : /confirm/i.test(e.message) ? 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.' : e.message);
    setBusy(false);
  };

  return (
    <SafeAreaView style={st.wrap} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.inner} keyboardShouldPersistTaps="handled">
          <View style={st.brand}>
            <Image source={require('../../assets/images/mark-dark.png')} style={st.mark} />
            <Text style={st.name}>VYSNER <Text style={{ color: '#4cd964', fontWeight: '600' }}>ONE</Text></Text>
            <Text style={st.claim}>Angebote, Rechnungen, Lager und Zahlen – jetzt auch unterwegs.</Text>
          </View>
          <View style={st.card}>
            <Text style={st.title}>Anmelden</Text>
            <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
            <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={login} returnKeyType="go" />
            {error ? <Text style={st.error}>{error}</Text> : null}
            <Button title="Anmelden" variant="primary" icon={LogIn} onPress={login} busy={busy} disabled={!email || !password} />
            <View style={st.links}>
              <Text style={st.link} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/app`)}>Passwort vergessen?</Text>
              <Text style={st.link} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/app`)}>Konto anlegen</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.brand },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24 },
  brand: { alignItems: 'center', gap: 8 },
  mark: { width: 96, height: 96 },
  name: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 2 },
  claim: { color: '#a9bdb1', fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 20, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 14 },
  error: { color: C.danger, marginBottom: 12, fontSize: 14 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { color: C.primary, fontWeight: '600', fontSize: 14 },
});
