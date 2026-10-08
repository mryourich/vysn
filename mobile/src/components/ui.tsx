import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { C, R, TONE } from '../lib/theme';

export function Screen({ children, refreshing, onRefresh, padded = true }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={[padded && s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 10, marginTop: 6 }}>
      <Text style={s.h}>{children}</Text>
      {sub ? <Text style={s.muted}>{sub}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, variant = 'default', icon: Icon, disabled, busy, small }: {
  title: string; onPress: () => void; variant?: 'default' | 'primary' | 'danger' | 'quiet'; icon?: LucideIcon; disabled?: boolean; busy?: boolean; small?: boolean;
}) {
  const primary = variant === 'primary';
  const color = primary ? '#fff' : variant === 'danger' ? C.danger : variant === 'quiet' ? C.ink2 : C.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button"
      style={({ pressed }) => [s.btn, small && s.btnSmall, primary && s.btnPrimary, variant === 'quiet' && s.btnQuiet, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}>
      {busy ? <ActivityIndicator size="small" color={color} /> : Icon ? <Icon size={small ? 15 : 18} color={color} /> : null}
      <Text style={[s.btnText, small && { fontSize: 14 }, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: string }) {
  const t = TONE[tone] || TONE.neutral;
  return <View style={[s.badge, { backgroundColor: t.bg }]}><Text style={[s.badgeText, { color: t.fg }]}>{label}</Text></View>;
}

export function Row({ title, sub, right, rightSub, onPress, icon: Icon, last }: {
  title: string; sub?: string; right?: ReactNode; rightSub?: string; onPress?: () => void; icon?: LucideIcon; last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, !last && s.rowLine, pressed && { backgroundColor: C.surface2 }]}>
      {Icon ? <View style={s.rowIcon}><Icon size={18} color={C.primary} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.muted} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {typeof right === 'string' ? <Text style={s.rowRight}>{right}</Text> : right}
        {rightSub ? <Text style={s.mutedSmall}>{rightSub}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 12, flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.muted} accessibilityLabel={label} {...props} style={[s.input, props.multiline && { minHeight: 84, textAlignVertical: 'top' }, props.style]} />
      {hint ? <Text style={s.mutedSmall}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }} style={{ marginBottom: 12, flexGrow: 0 }}>
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[s.seg, value === k && s.segOn]}>
          <Text style={[s.segText, value === k && { color: '#fff' }]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'danger' | 'success' }) {
  return (
    <View style={s.stat}>
      <Text style={s.mutedSmall}>{label}</Text>
      <Text style={[s.statValue, tone === 'danger' && { color: C.danger }, tone === 'success' && { color: C.success }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={s.mutedSmall}>{sub}</Text> : null}
    </View>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon size={26} color={C.primary} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={[s.muted, { textAlign: 'center' }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} style={[s.input, { marginBottom: 12 }]} clearButtonMode="while-editing" />;
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: string }) {
  const t = TONE[tone] || TONE.info;
  return <View style={[s.note, { backgroundColor: t.bg }]}><Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>{children}</Text></View>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, marginBottom: 14, overflow: 'hidden' },
  h: { fontSize: 17, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 14 },
  mutedSmall: { color: C.muted, fontSize: 12.5 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, paddingHorizontal: 16, borderRadius: R.md, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  btnSmall: { minHeight: 36, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: C.primary, borderColor: C.primary },
  btnQuiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnText: { fontSize: 15.5, fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.surface },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: C.ink },
  rowRight: { fontSize: 15, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, fontWeight: '600', color: C.ink2, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: C.ink, backgroundColor: C.surface },
  seg: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  segOn: { backgroundColor: C.primary, borderColor: C.primary },
  segText: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, gap: 4 },
  statValue: { fontSize: 21, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', padding: 28, gap: 6 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  note: { borderRadius: R.md, padding: 12, marginBottom: 14 },
});
