import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Login } from '../components/login';
import { C } from '../lib/theme';
import { StoreProvider, useStore } from '../lib/store';

SplashScreen.preventAutoHideAsync();

function Root() {
  const { authReady, session } = useStore();
  useEffect(() => { if (authReady) SplashScreen.hideAsync(); }, [authReady]);
  if (!authReady) return null;
  if (!session) return <Login />;
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: C.surface }, headerTintColor: C.ink, headerTitleStyle: { fontWeight: '700' },
      headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: C.bg },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="beleg/[id]" options={{ title: 'Beleg' }} />
      <Stack.Screen name="kunde/[id]" options={{ title: 'Kunde' }} />
      <Stack.Screen name="artikel/[id]" options={{ title: 'Artikel' }} />
      <Stack.Screen name="scanner" options={{ title: 'Lager-Scanner' }} />
      <Stack.Screen name="assistent" options={{ title: 'KI-Sprachassistent', presentation: 'modal' }} />
      <Stack.Screen name="firmen" options={{ title: 'Firma wechseln', presentation: 'modal' }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <Root />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
