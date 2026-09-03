import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius } from '../tokens';
import { mono } from '../typography';
import { useTheme } from '../theme';

// Onboarding kit — ob-opt single/multi with round/square marks, ob-input,
// chip-label rows, dots progress. Every step skippable; the CTA must stay
// on-screen at all common viewport heights (regression-tested in the app).

export function ObDots({ total, current }: { total: number; current: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: theme.surfaces.border }, i < current && { backgroundColor: theme.fill.mark }]} />
      ))}
    </View>
  );
}

export function ObQuestion({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.q, { color: theme.text.ink }]}>{children}</Text>;
}

export function ObSub({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.sub, { color: theme.text.mute }]}>{children}</Text>;
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
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.opt, { borderColor: theme.surfaces.border }, on && { borderColor: theme.text.ink2, backgroundColor: theme.surfaces.surface }]}>
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.optTitle, { color: theme.text.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.optSub, { color: theme.text.faint }]}>{subtitle.toUpperCase()}</Text> : null}
      </View>
      <View style={[styles.mark, { borderColor: theme.surfaces.borderStrong }, multi && styles.markSq, on && { borderColor: theme.fill.mark, backgroundColor: theme.fill.mark }]}>
        {on && multi ? <Text style={[styles.markCheck, { color: theme.fill.markOn }]}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

// Confirmed on-device (Samsung SM_S908E, Android 16): native TextInput
// ignores its `color`/`fontSize` style on this RN 0.85.3 + New Architecture
// combo — a debug backgroundColor override rendered instantly, a debug text
// color never did, on both Fabric and the legacy bridge. So the typed value
// and the placeholder are drawn ourselves as an overlaid <Text> (plain Text
// color renders correctly everywhere else in the app) on top of a
// functionally-normal but visually-blank TextInput, which still owns focus,
// the keyboard and the caret.
export function ObInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  const { value, placeholder, secureTextEntry, multiline, style, ...rest } = props;
  const shown = secureTextEntry ? '•'.repeat(value?.length ?? 0) : value;
  return (
    <View style={[styles.inputWrap, { backgroundColor: theme.surfaces.surface, borderColor: theme.surfaces.border }, style]}>
      <TextInput
        placeholderTextColor="transparent"
        cursorColor={theme.text.ink}
        selectionColor={theme.text.ink}
        {...rest}
        value={value}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={styles.inputNative}
      />
      <Text
        pointerEvents="none"
        numberOfLines={multiline ? undefined : 1}
        style={[styles.inputOverlay, { color: theme.text.ink }, !value && { color: theme.text.faint }]}
      >
        {value ? shown : (placeholder ?? '')}
      </Text>
    </View>
  );
}

export function ObInRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.inRow}>{children}</View>;
}

export function ObChipLabel({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.chipLabel, { color: theme.text.mute }]}>{children.toUpperCase()}</Text>;
}

export function ObNote({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.note, { color: theme.text.faint }]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, marginTop: 26 },
  dot: { height: 2, flex: 1, borderRadius: 1 },
  q: { fontSize: 24, fontWeight: '650' as any, letterSpacing: -0.36, marginTop: 34, lineHeight: 30 },
  sub: { fontSize: 14, marginTop: 10, lineHeight: 20, maxWidth: 300 },
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: 16,
    marginTop: 10,
  },
  optTitle: { fontSize: 14, fontWeight: '550' as any },
  optSub: { fontFamily: mono, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
  mark: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderRadius: 8,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSq: { borderRadius: 5 },
  markCheck: { fontSize: 11, lineHeight: 12 },
  inputWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    marginTop: 10,
    flexGrow: 1,
    flexBasis: 'auto',
    position: 'relative',
  },
  inputNative: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: 'transparent',
    fontSize: 14,
  },
  inputOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  inRow: { flexDirection: 'row', gap: 10 },
  chipLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14, marginTop: 20 },
  note: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.38, lineHeight: 16, marginTop: 22 },
});
