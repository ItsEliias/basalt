import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, radius } from '../tokens';
import { mono } from '../typography';

// Onboarding kit — ob-opt single/multi with round/square marks, ob-input,
// chip-label rows, dots progress. Every step skippable; the CTA must stay
// on-screen at all common viewport heights (regression-tested in the app).

export function ObDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i < current && { backgroundColor: color.ink }]} />
      ))}
    </View>
  );
}

export function ObQuestion({ children }: { children: string }) {
  return <Text style={styles.q}>{children}</Text>;
}

export function ObSub({ children }: { children: string }) {
  return <Text style={styles.sub}>{children}</Text>;
}

export function ObOption({
  title, subtitle, on, multi, onPress,
}: {
  title: string;
  subtitle?: string;
  on: boolean;
  /** Square check mark (multi-select) instead of the round radio mark. */
  multi?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.opt, on && styles.optOn]}>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.optTitle}>{title}</Text>
        {subtitle ? <Text style={styles.optSub}>{subtitle.toUpperCase()}</Text> : null}
      </View>
      <View style={[styles.mark, multi && styles.markSq, on && styles.markOn]}>
        {on && multi ? <Text style={styles.markCheck}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

export function ObInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={color.faint}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function ObInRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.inRow}>{children}</View>;
}

export function ObChipLabel({ children }: { children: string }) {
  return <Text style={styles.chipLabel}>{children.toUpperCase()}</Text>;
}

export function ObNote({ children }: { children: string }) {
  return <Text style={styles.note}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, marginTop: 26 },
  dot: { height: 2, flex: 1, backgroundColor: color.border, borderRadius: 1 },
  q: { fontSize: 24, fontWeight: '650' as any, letterSpacing: -0.36, color: color.ink, marginTop: 34, lineHeight: 30 },
  sub: { fontSize: 13, color: color.mute, marginTop: 10, lineHeight: 20, maxWidth: 300 },
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.card,
    padding: 16,
    marginTop: 10,
  },
  optOn: { borderColor: color.ink2, backgroundColor: color.surface },
  optTitle: { fontSize: 14, fontWeight: '550' as any, color: color.ink },
  optSub: { fontFamily: mono, fontSize: 10, color: color.faint, marginTop: 4, letterSpacing: 0.4 },
  mark: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: 8,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSq: { borderRadius: 5 },
  markOn: { borderColor: color.ink, backgroundColor: color.ink },
  markCheck: { fontSize: 10, color: color.bg, lineHeight: 12 },
  input: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.input,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: color.ink,
    fontSize: 14,
    marginTop: 10,
    flexGrow: 1,
    flexBasis: 0,
  },
  inRow: { flexDirection: 'row', gap: 10 },
  chipLabel: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.14, color: color.mute, marginTop: 20 },
  note: { fontFamily: mono, fontSize: 9.5, color: color.faint, letterSpacing: 0.38, lineHeight: 16, marginTop: 22 },
});
