import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { color, radius, space, type as typeScale } from '../tokens';
import { mono, monoTabular } from '../typography';
import { useTheme, DENSITY_PAD, TEXT_SCALE_MULTIPLIER } from '../theme';

// Base primitives: Card, MicroLabel, KV, SrcNote, HeroNumeral, EmptyState.
// Every component copies the prototype's exact metrics — do not invent new
// visual language here. Card/MicroLabel/SrcNote/KV read density + text
// scale from the theme context (Settings → Display); HeroNumeral is
// intentionally exempt from the in-app text-scale preference — it's
// already capped for OS accessibility scaling and is meant to stay the
// one fixed anchor size per screen.

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { density } = useTheme();
  return <View style={[styles.card, { padding: space.card + DENSITY_PAD[density] }, style]}>{children}</View>;
}

export function MicroLabel({ children, faint, style }: { children: ReactNode; faint?: boolean; style?: StyleProp<TextStyle> }) {
  const { textScale } = useTheme();
  const fontSize = typeScale.microLabel.fontSize * TEXT_SCALE_MULTIPLIER[textScale];
  return (
    <Text style={[styles.microLabel, { fontSize }, faint && { color: color.faint }, style]} maxFontSizeMultiplier={1.3}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

/** label left, right-aligned mono summary right — the card header row. */
export function KV({ label, right, faint, style }: { label: ReactNode; right?: ReactNode; faint?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.kv, style]}>
      {typeof label === 'string' ? <MicroLabel faint={faint}>{label}</MicroLabel> : label}
      {typeof right === 'string' ? (
        <Text style={styles.kvRight} maxFontSizeMultiplier={1.3}>{right}</Text>
      ) : right}
    </View>
  );
}

/** The honesty footer on every data card — 10.5px mono caps, faint. */
export function SrcNote({ children, center, style }: { children: ReactNode; center?: boolean; style?: StyleProp<TextStyle> }) {
  const { textScale } = useTheme();
  const fontSize = typeScale.srcNote.fontSize * TEXT_SCALE_MULTIPLIER[textScale];
  return (
    <Text
      style={[styles.srcNote, { fontSize }, center && { textAlign: 'center' }, style]}
      maxFontSizeMultiplier={1.3}
    >
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

/**
 * One per screen maximum. Proportional figures, tight tracking. Font
 * scaling is capped (not disabled) at 1.3x so a hero numeral can't outgrow
 * its card at the largest system text sizes — the user's preference still
 * moves it, just with a ceiling.
 */
export function HeroNumeral({ value, unit, style }: { value: string; unit?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.hero, style]} maxFontSizeMultiplier={1.3}>
      {value}
      {unit ? <Text style={styles.heroUnit} maxFontSizeMultiplier={1.3}> {unit}</Text> : null}
    </Text>
  );
}

/**
 * Real-or-hidden empty state: quiet typography, never a zero, never a
 * placeholder chart (honesty rules §5).
 */
export function EmptyState({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.empty, style]}>{children}</Text>;
}

/** 1px hairline rule inside cards. */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.card,
    padding: space.card,
    marginTop: space.cardGap,
  },
  microLabel: {
    fontSize: typeScale.microLabel.fontSize,
    fontWeight: '600',
    letterSpacing: typeScale.microLabel.letterSpacing,
    color: color.mute,
    fontFamily: mono,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kvRight: {
    ...monoTabular,
    fontSize: typeScale.ratio.fontSize,
    color: color.ink2,
  },
  srcNote: {
    fontFamily: mono,
    fontSize: typeScale.srcNote.fontSize,
    color: color.faint,
    marginTop: 10,
    letterSpacing: typeScale.srcNote.letterSpacing,
    lineHeight: typeScale.srcNote.lineHeight,
  },
  hero: {
    fontSize: typeScale.hero.fontSize,
    fontWeight: '600',
    letterSpacing: typeScale.hero.letterSpacing,
    color: color.ink,
    lineHeight: typeScale.hero.fontSize,
    marginTop: 12,
  },
  heroUnit: {
    fontSize: typeScale.heroUnit.fontSize,
    fontWeight: '400',
    color: color.mute,
    letterSpacing: 0,
  },
  empty: {
    fontSize: 12.5,
    color: color.faint,
    lineHeight: 19,
    marginTop: 10,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
    marginVertical: 12,
  },
});
