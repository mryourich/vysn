import { router } from 'expo-router';
import { Building2, Check } from 'lucide-react-native';
import { Card, Row, Screen } from '../components/ui';
import { useStore } from '../lib/store';
import { C } from '../lib/theme';
import { PLANS } from '../shared/plans';

export default function Companies() {
  const { companies, companyId, switchCompany } = useStore();
  return (
    <Screen>
      <Card>
        {companies.map((c, i) => (
          <Row key={c.id} icon={Building2} title={c.name || 'Ohne Namen'} sub={`Tarif ${PLANS[c.plan]?.label ?? c.plan}`}
            right={c.id === companyId ? <Check size={20} color={C.primary} /> : undefined} last={i === companies.length - 1}
            onPress={async () => { router.back(); if (c.id !== companyId) await switchCompany(c.id); }} />
        ))}
      </Card>
    </Screen>
  );
}
