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

// Confirmed on-device (Samsung SM_S908E, Android 16): native TextInput
// ignores its `color`/`fontSize` style on this RN 0.85.3 + New Architecture
// combo — a debug backgroundColor override rendered instantly, a debug text
// color never did, on both Fabric and the legacy bridge. So the typed value
// and the placeholder are drawn ourselves as an overlaid <Text> (plain Text
// color renders correctly everywhere else in the app) on top of a
// functionally-normal but visually-blank TextInput, which still owns focus,
// the keyboard and the caret.
export function ObInput(props: React.ComponentProps<typeof TextInput>) {
  const { value, placeholder, secureTextEntry, multiline, style, ...rest } = props;
  const shown = secureTextEntry ? '•'.repeat(value?.length ?? 0) : value;
  return (
    <View style={[styles.inputWrap, style]}>
      <TextInput
        placeholderTextColor="transparent"
        cursorColor={color.ink}
        selectionColor={color.ink}
        {...rest}
        value={value}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={styles.inputNative}
      />
      <Text
        pointerEvents="none"
        numberOfLines={multiline ? undefined : 1}
        style={[styles.inputOverlay, !value && styles.inputPlaceholder]}
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
  return <Text style={styles.chipLabel}>{children.toUpperCase()}</Text>;
}

export function ObNote({ children }: { children: string }) {
  return <Text style={styles.note}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, marginTop: 26 },
  dot: { height: 2, flex: 1, backgroundColor: color.border, borderRadius: 1 },
  q: { fontSize: 24, fontWeight: '650' as any, letterSpacing: -0.36, color: color.ink, marginTop: 34, lineHeight: 30 },
  sub: { fontSize: 14, color: color.mute, marginTop: 10, lineHeight: 20, maxWidth: 300 },
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
  optSub: { fontFamily: mono, fontSize: 11, color: color.faint, marginTop: 4, letterSpacing: 0.4 },
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
  markCheck: { fontSize: 11, color: color.bg, lineHeight: 12 },
  inputWrap: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
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
    color: color.ink,
    fontSize: 14,
  },
  inputPlaceholder: { color: color.faint },
  inRow: { flexDirection: 'row', gap: 10 },
  chipLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14, color: color.mute, marginTop: 20 },
  note: { fontFamily: mono, fontSize: 10.5, color: color.faint, letterSpacing: 0.38, lineHeight: 16, marginTop: 22 },
});
