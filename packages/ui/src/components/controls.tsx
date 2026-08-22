import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius } from '../tokens';
import { mono } from '../typography';

// Interactive primitives: CTA, chips, sub-nav segments, search, stepper.
// Set completion and selection are typographic state changes — no springs,
// no bounces, nothing louder than a color and a border.

export function CTA({ label, onPress, style, disabled }: {
  label: string; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }, disabled && { opacity: 0.45 }, style]}
    >
      <Text style={styles.ctaText}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, accent }: {
  label: string; on?: boolean; onPress?: () => void;
  /** Accent color for semantically-meaningful chips (e.g. "My equipment"). */
  accent?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.chip, on && styles.chipOn, on && accent ? { borderColor: `${accent}59` } : null]}
    >
      <Text style={[styles.chipText, on && { color: accent ?? color.ink }]}>{label.toUpperCase()}</Text>
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

/** `.seg` — mono caps, underline active. Sub-nav switch preserves the tab. */
export function SubNav({ items, active, onChange }: {
  items: string[]; active: string; onChange: (v: string) => void;
}) {
  return (
    <View style={styles.seg}>
      {items.map((item) => {
        const on = item === active;
        return (
          <Pressable key={item} onPress={() => onChange(item)} hitSlop={8} style={[styles.segBtn, on && styles.segBtnOn]}>
            <Text style={[styles.segText, on && { color: color.ink }]}>{item.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SearchBar({ placeholder, value, onChangeText }: {
  placeholder: string; value?: string; onChangeText?: (t: string) => void;
}) {
  return (
    <View style={styles.search}>
      <Text style={styles.searchGlyph}>⌕</Text>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export function Stepper({ value, unit, onMinus, onPlus }: {
  value: string; unit?: string; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={styles.stepBtnText}>−</Text></Pressable>
      <Text style={styles.stepVal}>{value}{unit ? ` ${unit}` : ''}</Text>
      <Pressable onPress={onPlus} style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={styles.stepBtnText}>+</Text></Pressable>
    </View>
  );
}

/** Dashed "new item" row (`.newrow`). */
export function NewRow({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.newRow}>
      <Text style={styles.newRowText}>{label.toUpperCase()}</Text>
      <Text style={styles.newRowPlus}>+</Text>
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
    backgroundColor: color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border2,
    borderRadius: radius.timer,
    paddingVertical: 13,
    marginTop: 12,
    alignItems: 'center',
  },
  ctaText: { fontFamily: mono, fontSize: 11, letterSpacing: 1.32, color: color.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.chip,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  chipOn: { borderColor: color.border2, backgroundColor: color.surface },
  chipText: { fontFamily: mono, fontSize: 11, letterSpacing: 0.95, color: color.mute },
  seg: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    marginHorizontal: 2,
  },
  segBtn: { paddingTop: 6, paddingBottom: 10, marginBottom: -StyleSheet.hairlineWidth, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segBtnOn: { borderBottomColor: color.ink },
  segText: { fontFamily: mono, fontSize: 11, letterSpacing: 1.3, color: color.faint },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.timer,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  searchGlyph: { color: color.faint, fontSize: 14 },
  searchInput: { flex: 1, fontFamily: mono, fontSize: 11, color: color.ink, paddingVertical: 11, letterSpacing: 0.44 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border2,
    borderRadius: radius.timer,
    overflow: 'hidden',
  },
  stepBtn: { width: 38, height: 34, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: color.ink2, fontSize: 16, fontFamily: mono },
  stepVal: { fontFamily: mono, fontSize: 14, minWidth: 74, textAlign: 'center', color: color.ink },
  newRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border2,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  newRowText: { fontFamily: mono, fontSize: 11, letterSpacing: 1.32, color: color.ink2 },
  newRowPlus: { fontFamily: mono, fontSize: 14, color: color.faint },
});
