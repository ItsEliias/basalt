import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, resolveTypeface, TodayIcon, LogIcon, TrainIcon, RecoverIcon, TrendsIcon } from '@basalt/ui';

// The prototype tab bar. `expression.nav` decides its voice per theme:
//   'iconLabel' — line icon above a mono-caps label (Minimal)
//   'label'     — label only, no icon (most themes)
//   'inverted'  — active tab gets a filled pill, fill.mark on fill.markOn
//                 (Brutalist — verified against reference/themes-today.html:
//                 .brutalist .nav .on { color: #F2F0E8; background: #111111 })
// Tab switch resets scroll (screens handle that); the + opens the quick-log
// sheet, never a screen.

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
  const { theme } = useTheme();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const labelFont = resolveTypeface(theme.typography.ui, theme.typography.weight.regular);
  const labelWeight = String(theme.typography.weight.regular) as TextStyle['fontWeight'];
  const upper = theme.typography.labelCase === 'upper';

  const renderTab = (t: { key: TabKey; label: string; Icon: (p: { color: string; size?: number }) => ReactElement }) => {
    const on = t.key === active;
    const inverted = theme.expression.nav === 'inverted';
    const showIcon = theme.expression.nav === 'iconLabel';
    const iconColor = on ? theme.text.ink : theme.text.faint;
    const labelColor = inverted ? (on ? theme.fill.markOn : theme.text.faint) : (on ? theme.text.accent : theme.text.faint);
    const label = upper ? t.label.toUpperCase() : t.label;
    return (
      <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab} hitSlop={8}>
        <View
          style={[
            styles.tabInner,
            inverted && on ? { backgroundColor: theme.fill.mark, borderRadius: theme.shape.radius.sm } : null,
          ]}
        >
          {showIcon ? <t.Icon color={iconColor} size={18} /> : null}
          <Text
            style={[styles.label, { fontFamily: labelFont, fontWeight: labelWeight, letterSpacing: theme.typography.tracking.label, color: labelColor }]}
            maxFontSizeMultiplier={1.3}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { borderTopColor: theme.surfaces.border, backgroundColor: theme.surfaces.bg, paddingBottom: 14 + insets.bottom }]}>
      {left.map(renderTab)}
      <Pressable onPress={onPlus} style={styles.plusWrap} hitSlop={8}>
        <View style={[styles.plusBtn, { borderRadius: theme.shape.radius.lg, borderColor: theme.surfaces.borderStrong, backgroundColor: theme.surfaces.surface2 }]}>
          <Text
            style={[
              styles.plusText,
              {
                color: theme.text.ink,
                fontFamily: resolveTypeface(theme.typography.data, theme.typography.weight.regular),
                fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
              },
            ]}
          >
            +
          </Text>
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
    paddingTop: 12,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  tab: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  tabInner: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  label: { fontSize: 10.5, marginTop: 5 },
  plusWrap: { top: -4, paddingHorizontal: 4 },
  plusBtn: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontSize: 19, lineHeight: 22 },
});
