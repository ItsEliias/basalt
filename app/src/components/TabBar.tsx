import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, mono, TodayIcon, LogIcon, TrainIcon, RecoverIcon, TrendsIcon } from '@basalt/ui';

// The prototype tab bar: mono caps labels with a small line icon above each,
// and the round + button raised in the centre. Tab switch resets scroll
// (screens handle that); the + opens the quick-log sheet, never a screen.

export type TabKey = 'today' | 'log' | 'train' | 'recover' | 'trends';

const TABS: { key: TabKey; label: string; Icon: (p: { color: string; size?: number }) => ReactElement }[] = [
  { key: 'today', label: 'Today', Icon: TodayIcon },
  { key: 'log', label: 'Log', Icon: LogIcon },
  { key: 'train', label: 'Train', Icon: TrainIcon },
  { key: 'recover', label: 'Recover', Icon: RecoverIcon },
  { key: 'trends', label: 'Trends', Icon: TrendsIcon },
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

  const renderTab = (t: { key: TabKey; label: string; Icon: (p: { color: string; size?: number }) => ReactElement }) => {
    const on = t.key === active;
    const iconColor = on ? color.ink : color.faint;
    return (
      <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab} hitSlop={8}>
        <t.Icon color={iconColor} size={18} />
        <Text style={[styles.label, on && { color: color.ink }]} maxFontSizeMultiplier={1.3}>
          {t.label.toUpperCase()}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: 14 + insets.bottom }]}>
      {left.map(renderTab)}
      <Pressable onPress={onPlus} style={styles.plusWrap} hitSlop={8}>
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
  label: { fontFamily: mono, fontSize: 10.5, letterSpacing: 1.14, color: color.faint, marginTop: 5 },
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
