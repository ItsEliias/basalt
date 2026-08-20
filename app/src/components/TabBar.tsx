import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, mono } from '@basalt/ui';

// The prototype tab bar: mono caps labels with a 4px dot indicator, and the
// round + button raised in the centre. Tab switch resets scroll (screens
// handle that); the + opens the quick-log sheet, never a screen.

export type TabKey = 'today' | 'log' | 'train' | 'recover' | 'trends';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'log', label: 'Log' },
  { key: 'train', label: 'Train' },
  { key: 'recover', label: 'Recover' },
  { key: 'trends', label: 'Trends' },
];

export function TabBar({
  active, onChange, onPlus,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  onPlus: () => void;
}) {
  const insets = useSafeAreaInsets();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = (t: { key: TabKey; label: string }) => {
    const on = t.key === active;
    return (
      <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab}>
        <View style={[styles.dot, on && { backgroundColor: color.ink }]} />
        <Text style={[styles.label, on && { color: color.ink }]}>{t.label.toUpperCase()}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: 14 + insets.bottom }]}>
      {left.map(renderTab)}
      <Pressable onPress={onPlus} style={styles.plusWrap}>
        <View style={styles.plusBtn}>
          <Text style={styles.plusText}>+</Text>
        </View>
      </Pressable>
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: 12,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    backgroundColor: color.bg,
  },
  tab: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
  label: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.14, color: color.faint },
  plusWrap: { top: -4, paddingHorizontal: 4 },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border2,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: color.ink, fontSize: 19, fontWeight: '300' as any, fontFamily: mono, lineHeight: 22 },
});
