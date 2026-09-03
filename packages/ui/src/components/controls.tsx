import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { radius } from '../tokens';
import { mono } from '../typography';
import { useTheme, resolveTypeface } from '../theme';

// Interactive primitives: CTA, chips, sub-nav segments, search, stepper.
// Set completion and selection are typographic state changes — no springs,
// no bounces, nothing louder than a color and a border.

/** The one filled button — fill.mark/markOn, so it's the same pair as any
 *  other filled element in a theme (nav's active pill, a tile's accent). */
export function CTA({ label, onPress, style, disabled }: {
  label: string; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const { theme } = useTheme();
  const upper = theme.typography.labelCase === 'upper';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.cta,
        { backgroundColor: theme.fill.mark, borderRadius: theme.shape.radius.md },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text
        style={[
          styles.ctaText,
          {
            fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.bold),
            fontWeight: String(theme.typography.weight.bold) as TextStyle['fontWeight'],
            letterSpacing: theme.typography.tracking.label, color: theme.fill.markOn,
          },
        ]}
      >
        {upper ? label.toUpperCase() : label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, accent }: {
  label: string; on?: boolean; onPress?: () => void;
  /** Accent color for semantically-meaningful chips (e.g. "My equipment"). */
  accent?: string;
}) {
  const { theme } = useTheme();
  const upper = theme.typography.labelCase === 'upper';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.chip,
        { borderColor: theme.surfaces.border, borderRadius: theme.shape.radius.sm },
        on && { borderColor: theme.surfaces.borderStrong, backgroundColor: theme.surfaces.surface },
        on && accent ? { borderColor: `${accent}59` } : null,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.regular),
            fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
            letterSpacing: theme.typography.tracking.label, color: theme.text.mute,
          },
          on && { color: accent ?? theme.text.ink },
        ]}
      >
        {upper ? label.toUpperCase() : label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ options, value, onChange, accent }: {
  options: string[]; value?: string; onChange?: (v: string) => void; accent?: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o} label={o} on={o === value} accent={accent} onPress={() => onChange?.(o)} />
      ))}
    </View>
  );
}

export function ChipGroup({ options, values, onToggle }: {
  options: string[]; values: string[]; onToggle?: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o} label={o} on={values.includes(o)} onPress={() => onToggle?.(o)} />
      ))}
    </View>
  );
}

/** `.seg` — caps, underline active. Sub-nav switch preserves the tab. */
export function SubNav({ items, active, onChange }: {
  items: string[]; active: string; onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  const upper = theme.typography.labelCase === 'upper';
  const uiFont = resolveTypeface(theme.typography.ui, theme.typography.weight.regular);
  const uiWeight = String(theme.typography.weight.regular) as TextStyle['fontWeight'];
  return (
    <View style={[styles.seg, { borderBottomColor: theme.surfaces.border }]}>
      {items.map((item) => {
        const on = item === active;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            hitSlop={8}
            style={[styles.segBtn, on && { borderBottomColor: theme.text.accent }]}
          >
            <Text style={[styles.segText, { fontFamily: uiFont, fontWeight: uiWeight, letterSpacing: theme.typography.tracking.label, color: theme.text.faint }, on && { color: theme.text.accent }]}>
              {upper ? item.toUpperCase() : item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SearchBar({ placeholder, value, onChangeText }: {
  placeholder: string; value?: string; onChangeText?: (t: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.surfaces.surface, borderColor: theme.surfaces.border }]}>
      <Text style={[styles.searchGlyph, { color: theme.text.faint }]}>⌕</Text>
      <TextInput
        style={[styles.searchInput, { color: theme.text.ink }]}
        placeholder={placeholder}
        placeholderTextColor={theme.text.faint}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export function Stepper({ value, unit, onMinus, onPlus }: {
  value: string; unit?: string; onMinus: () => void; onPlus: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.stepper, { borderColor: theme.surfaces.borderStrong }]}>
      <Pressable onPress={onMinus} style={[styles.stepBtn, { backgroundColor: theme.surfaces.surface2 }]} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={[styles.stepBtnText, { color: theme.text.ink2 }]}>−</Text></Pressable>
      <Text style={[styles.stepVal, { color: theme.text.ink }]}>{value}{unit ? ` ${unit}` : ''}</Text>
      <Pressable onPress={onPlus} style={[styles.stepBtn, { backgroundColor: theme.surfaces.surface2 }]} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={[styles.stepBtnText, { color: theme.text.ink2 }]}>+</Text></Pressable>
    </View>
  );
}

/** Dashed "new item" row (`.newrow`). */
export function NewRow({ label, onPress }: { label: string; onPress?: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.newRow, { borderColor: theme.surfaces.borderStrong }]}>
      <Text style={[styles.newRowText, { color: theme.text.ink2 }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.newRowPlus, { color: theme.text.faint }]}>+</Text>
    </Pressable>
  );
}

export function useToggleList(initial: string[] = []): [string[], (v: string) => void] {
  const [values, setValues] = useState<string[]>(initial);
  const toggle = (v: string) =>
    setValues((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  return [values, toggle];
}

const styles = StyleSheet.create({
  cta: {
    paddingVertical: 13,
    marginTop: 12,
    alignItems: 'center',
  },
  ctaText: { fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  chipText: { fontSize: 11 },
  seg: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 2,
  },
  segBtn: { paddingTop: 6, paddingBottom: 10, marginBottom: -StyleSheet.hairlineWidth, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segText: { fontSize: 11 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.timer,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  searchGlyph: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: mono, fontSize: 11, paddingVertical: 11, letterSpacing: 0.44 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.timer,
    overflow: 'hidden',
  },
  stepBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 16, fontFamily: mono },
  stepVal: { fontFamily: mono, fontSize: 14, minWidth: 74, textAlign: 'center' },
  newRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  newRowText: { fontFamily: mono, fontSize: 11, letterSpacing: 1.32 },
  newRowPlus: { fontFamily: mono, fontSize: 14 },
});
