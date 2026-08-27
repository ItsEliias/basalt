import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { space, type as typeScale } from '../tokens';
import { monoTabular } from '../typography';
import { useTheme, useBlurTarget, resolveTypeface, DENSITY_PAD, TEXT_SCALE_MULTIPLIER, type Theme } from '../theme';

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
  const isGlass = theme.shape.elevation === 'blur' && theme.shape.glassFill;
  const base = {
    backgroundColor: filled
      ? isGlass
        // Depth's translucent-over-gradient look — the real blur itself is
        // applied by the BlurView this style renders inside of (see Card/
        // Tile); this is just the tint layered on top of it.
        ? theme.shape.glassFill
        : theme.surfaces.surface
      : 'transparent',
  };
  const borderWidth =
    theme.shape.elevation === 'none' ? 0 :
    theme.shape.elevation === 'hardShadow' ? theme.shape.borderWidth.thick :
    theme.shape.elevation === 'blur' ? theme.shape.borderWidth.hairline :
    theme.shape.borderWidth.thin;
  const border = borderWidth > 0
    ? {
        borderWidth,
        borderColor: theme.shape.elevation === 'hardShadow'
          ? theme.surfaces.borderStrong
          : isGlass && theme.shape.glassBorder
            ? theme.shape.glassBorder
            : theme.surfaces.border,
      }
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
  const blurTarget = useBlurTarget();
  const containerStyle = useContainerStyle(theme);
  const cardStyle = [
    styles.card,
    ...containerStyle,
    { borderRadius: theme.shape.radius.md, padding: space.card + DENSITY_PAD[density] },
    style,
  ];
  // Depth's glass cards need a REAL backdrop blur — of the GroundGlow behind
  // them (app/App.tsx), not something a flat backgroundColor can fake.
  // Android's blur (unlike iOS's) can't sample "whatever's behind this" on
  // its own — blurTarget/blurMethod point it at the BlurTargetView App.tsx
  // wraps around GroundGlow; see theme/provider.tsx's useBlurTarget().
  if (theme.shape.elevation === 'blur') {
    return (
      <BlurView
        intensity={40}
        tint="dark"
        blurTarget={blurTarget ?? undefined}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={[{ overflow: 'hidden' }, cardStyle]}
      >
        {children}
      </BlurView>
    );
  }
  return <View style={cardStyle}>{children}</View>;
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
          fontSize, fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.medium),
          fontWeight: String(theme.typography.weight.medium) as TextStyle['fontWeight'],
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
          style={[
            styles.kvRight,
            {
              fontFamily: resolveTypeface(theme.typography.data, theme.typography.weight.regular),
              fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
              color: theme.text.ink2,
            },
          ]}
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
          fontSize, fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.regular),
          fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
          color: theme.text.faint,
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
          fontFamily: resolveTypeface(theme.typography.display, theme.typography.weight.bold),
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
          style={[
            styles.heroUnit,
            {
              fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.regular),
              fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
              color: theme.text.mute,
            },
          ]}
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
    <Text
      style={[
        styles.empty,
        {
          color: theme.text.faint,
          fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.regular),
          fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
        },
        style,
      ]}
    >
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
    marginTop: 12,
  },
  heroUnit: {
    fontSize: typeScale.heroUnit.fontSize,
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
