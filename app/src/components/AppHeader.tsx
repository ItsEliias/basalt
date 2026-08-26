import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useTheme, resolveTypeface } from '@basalt/ui';

// The app head — title left, mono context + gear right (prototype .apphead).

export function AppHeader({
  title, context, onPressGear,
}: {
  title: string;
  context?: string;
  onPressGear?: () => void;
}) {
  const { theme } = useTheme();
  const dataFont = resolveTypeface(theme.typography.data, theme.typography.weight.regular);
  const dataWeight = String(theme.typography.weight.regular) as TextStyle['fontWeight'];
  const upper = theme.typography.labelCase === 'upper';
  // shape.align is a body/tile-content token (docs/basalt-layouts.md:
  // "Atelier centres tile contents") — the header's Settings entry point
  // (onPressGear) must never disappear for any theme, so align doesn't
  // touch this component's layout, only its title's own text alignment.
  return (
    <View style={styles.head}>
      <Text
        style={[
          styles.title,
          {
            fontFamily: resolveTypeface(theme.typography.display, theme.typography.weight.bold),
            fontWeight: String(theme.typography.weight.bold) as TextStyle['fontWeight'],
            color: theme.text.ink,
          },
        ]}
      >
        {title}
      </Text>
      <View style={styles.right}>
        {context ? (
          <Text style={[styles.context, { fontFamily: dataFont, fontWeight: dataWeight, color: theme.text.mute }]}>
            {upper ? context.toUpperCase() : context}
          </Text>
        ) : null}
        {onPressGear ? (
          <Pressable onPress={onPressGear} hitSlop={18}>
            <Text style={[styles.gear, { color: theme.text.faint }]}>⚙</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: { fontSize: 21, letterSpacing: -0.21 },
  right: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  context: { fontSize: 11, letterSpacing: 0.66 },
  gear: { fontSize: 13 },
});
