import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { space, type as typeScale } from '../tokens';
import { monoTabular } from '../typography';
import { useTheme, resolveTypeface, DENSITY_PAD, TEXT_SCALE_MULTIPLIER, type Theme } from '../theme';

// Base primitives: Card, MicroLabel, KV, SrcNote, HeroNumeral, EmptyState.
// Every component copies the prototype's exact metrics for Minimal — do not
// invent new visual language here. All read colour/typography/shape from
// the active theme (Settings → Display); Card/MicroLabel/SrcNote/KV also
// read density + text scale. HeroNumeral is intentionally exempt from the
// in-app text-scale preference — it's already capped for OS accessibility
// scaling and is meant to stay the one fixed anchor size per screen.

/**
 * Container chrome shared by Card and Tile (packages/ui/src/components/
 * todayTiles.tsx) — the one place `shape.container`/`shape.elevation`
 * become real styles, so the two never drift apart. See the design-spec
 * §6 amendment for why hardShadow/blur are theme-scoped, not forbidden.
 */
export function useContainerStyle(theme: Theme): object[] {
  const filled = theme.shape.container === 'card' || theme.shape.container === 'boxed';
  const base = {
    backgroundColor: filled
      ? theme.shape.elevation === 'blur'
        // Depth's translucent-over-gradient look, approximated without a
        // real backdrop blur (no expo-blur dependency added for this) —
        // see docs/THEME-SYSTEM-REPORT.md, flagged as a compromise and a
        // device check.
        ? theme.surfaces.surface2
        : theme.surfaces.surface
      : 'transparent',
  };
  const borderWidth =
    theme.shape.elevation === 'none' ? 0 :
    theme.shape.elevation === 'hardShadow' ? theme.shape.borderWidth.thick :
    theme.shape.elevation === 'blur' ? theme.shape.borderWidth.hairline :
    theme.shape.borderWidth.thin;
  const border = borderWidth > 0
    ? { borderWidth, borderColor: theme.shape.elevation === 'hardShadow' ? theme.surfaces.borderStrong : theme.surfaces.border }
    : null;
  // A flat, non-blurred offset shadow (Brutalist) — not the soft glow the
  // pre-contract spec banned; see the design-spec §6 amendment.
  const hardShadow = theme.shape.elevation === 'hardShadow'
    ? { shadowColor: theme.surfaces.borderStrong, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }
    : null;
  return [base, border, hardShadow].filter(Boolean) as object[];
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme, density } = useTheme();
  const containerStyle = useContainerStyle(theme);
  return (
    <View
      style={[
        styles.card,
        ...containerStyle,
        { borderRadius: theme.shape.radius.md, padding: space.card + DENSITY_PAD[density] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function MicroLabel({ children, faint, style }: { children: ReactNode; faint?: boolean; style?: StyleProp<TextStyle> }) {
  const { theme, textScale } = useTheme();
  const fontSize = typeScale.microLabel.fontSize * TEXT_SCALE_MULTIPLIER[textScale];
  const upper = theme.typography.labelCase === 'upper';
  return (
    <Text
      style={[
        styles.microLabel,
        {
          fontSize, fontFamily: resolveTypeface(theme.typography.ui),
          letterSpacing: theme.typography.tracking.label, color: theme.text.mute,
        },
        faint && { color: theme.text.faint },
        style,
      ]}
      maxFontSizeMultiplier={1.3}
    >
      {typeof children === 'string' && upper ? children.toUpperCase() : children}
    </Text>
  );
}

/** label left, right-aligned mono summary right — the card header row. */
export function KV({ label, right, faint, style }: { label: ReactNode; right?: ReactNode; faint?: boolean; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.kv, style]}>
      {typeof label === 'string' ? <MicroLabel faint={faint}>{label}</MicroLabel> : label}
      {typeof right === 'string' ? (
        <Text
          style={[styles.kvRight, { fontFamily: resolveTypeface(theme.typography.data), color: theme.text.ink2 }]}
          maxFontSizeMultiplier={1.3}
        >
          {right}
        </Text>
      ) : right}
    </View>
  );
}

/** The honesty footer on every data card — small caps, faint. */
export function SrcNote({ children, center, style }: { children: ReactNode; center?: boolean; style?: StyleProp<TextStyle> }) {
  const { theme, textScale } = useTheme();
  const fontSize = typeScale.srcNote.fontSize * TEXT_SCALE_MULTIPLIER[textScale];
  const upper = theme.typography.labelCase === 'upper';
  return (
    <Text
      style={[
        styles.srcNote,
        {
          fontSize, fontFamily: resolveTypeface(theme.typography.ui), color: theme.text.faint,
          letterSpacing: theme.typography.tracking.label,
        },
        center && { textAlign: 'center' },
        style,
      ]}
      maxFontSizeMultiplier={1.3}
    >
      {typeof children === 'string' && upper ? children.toUpperCase() : children}
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
  const { theme } = useTheme();
  return (
    <Text
      style={[
        styles.hero,
        {
          fontFamily: resolveTypeface(theme.typography.display),
          fontSize: theme.typography.scale.hero,
          fontWeight: String(theme.typography.weight.bold) as TextStyle['fontWeight'],
          letterSpacing: theme.typography.tracking.hero,
          lineHeight: theme.typography.scale.hero,
          color: theme.text.ink,
        },
        style,
      ]}
      maxFontSizeMultiplier={1.3}
    >
      {value}
      {unit ? (
        <Text
          style={[styles.heroUnit, { fontFamily: resolveTypeface(theme.typography.ui), color: theme.text.mute }]}
          maxFontSizeMultiplier={1.3}
        >
          {' '}{unit}
        </Text>
      ) : null}
    </Text>
  );
}

/**
 * Real-or-hidden empty state: quiet typography, never a zero, never a
 * placeholder chart (honesty rules §5). `expression.emptyState` adds a
 * touch more visual weight for themes whose voice calls for it — the text
 * itself never changes, and 'quiet' (most themes) renders exactly as
 * before: plain text, nothing added.
 */
export function EmptyState({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  const text = (
    <Text style={[styles.empty, { color: theme.text.faint, fontFamily: resolveTypeface(theme.typography.ui) }, style]}>
      {children}
    </Text>
  );
  if (theme.expression.emptyState === 'boxed') {
    return (
      <View style={[styles.emptyBoxed, { borderColor: theme.surfaces.border, borderRadius: theme.shape.radius.sm }]}>
        {text}
      </View>
    );
  }
  if (theme.expression.emptyState === 'ruled') {
    return (
      <View style={[styles.emptyRuled, { borderTopColor: theme.surfaces.border }]}>
        {text}
      </View>
    );
  }
  return text;
}

/** 1px hairline rule inside cards. */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.surfaces.border }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.card,
    marginTop: space.cardGap,
  },
  microLabel: {
    fontSize: typeScale.microLabel.fontSize,
    fontWeight: '600',
    letterSpacing: typeScale.microLabel.letterSpacing,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kvRight: {
    ...monoTabular,
    fontSize: typeScale.ratio.fontSize,
  },
  srcNote: {
    fontSize: typeScale.srcNote.fontSize,
    marginTop: 10,
    lineHeight: typeScale.srcNote.lineHeight,
  },
  hero: {
    fontWeight: '600',
    marginTop: 12,
  },
  heroUnit: {
    fontSize: typeScale.heroUnit.fontSize,
    fontWeight: '400',
    letterSpacing: 0,
  },
  empty: {
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 10,
  },
  emptyBoxed: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 10,
  },
  emptyRuled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 10,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
});
