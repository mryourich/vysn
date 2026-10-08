import { Tabs } from 'expo-router';
import { Boxes, FileText, LayoutDashboard, Menu, Users } from 'lucide-react-native';
import { C } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: C.primary, tabBarInactiveTintColor: C.muted,
      tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
      headerStyle: { backgroundColor: C.surface }, headerTitleStyle: { fontWeight: '800', color: C.ink },
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Übersicht', tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} /> }} />
      <Tabs.Screen name="belege" options={{ title: 'Belege', tabBarIcon: ({ color }) => <FileText color={color} size={22} /> }} />
      <Tabs.Screen name="kunden" options={{ title: 'Kunden', tabBarIcon: ({ color }) => <Users color={color} size={22} /> }} />
      <Tabs.Screen name="material" options={{ title: 'Material', tabBarIcon: ({ color }) => <Boxes color={color} size={22} /> }} />
      <Tabs.Screen name="mehr" options={{ title: 'Mehr', tabBarIcon: ({ color }) => <Menu color={color} size={22} /> }} />
    </Tabs>
  );
}
