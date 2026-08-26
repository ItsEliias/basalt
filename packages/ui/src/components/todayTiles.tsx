import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, resolveTypeface } from '../theme';

// The Tiles Today layout (docs/basalt-layouts.md) — a grid of single-metric
// cells, each tappable, drilling into the matching ledger section. Fixed v1
// content model and tile set; see TodayScreen's todayTileSpecs().
//
// No theme-specific branching anywhere below: every visual difference comes
// from a token (shape.container/elevation/radius/align, typography.display/
// data, fill.mark/markOn, expression.overCap/emptyState). If a theme needed
// `theme.id === '...'` here, the contract would be missing a token.

export type TileSpan = 'full' | 'half';

export function TileGridThemed({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

function useContainerStyle() {
  const { theme } = useTheme();
  const filled = theme.shape.container === 'card' || theme.shape.container === 'boxed';
  const base = {
    borderRadius: theme.shape.radius.md,
    backgroundColor: filled
      ? theme.shape.elevation === 'blur'
        // Depth's translucent-over-gradient look, approximated without a
        // real backdrop blur (no expo-blur dependency added for this) —
        // see docs/THEME-SYSTEM-REPORT.md, flagged as a compromise.
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

/**
 * One metric cell. `empty` follows real-or-hidden: no value renders the
 * theme's own emptyState treatment (never a zero); `over` renders the
 * theme's over-cap wording — the caller computes it with the same
 * overCapSuffix() CapRow uses (via `overSuffix`) so the two surfaces can
 * never disagree about what "over" looks like, but a tile with no cap
 * concept (Energy) can still tint red via `over` without a fabricated
 * "· 0 over" the Tile itself would otherwise have no way to suppress.
 */
export function Tile({
  span, label, value, unit, source, over, overSuffix, empty, emptyMessage, onPress,
}: {
  span: TileSpan;
  label: string;
  value?: string;
  unit?: string;
  source?: string;
  /** Tints value/suffix in text.fat. Doesn't imply a suffix — pass one explicitly. */
  over?: boolean;
  /** Pre-computed via overCapSuffix() — the Tile doesn't invent cap wording itself. */
  overSuffix?: string;
  empty?: boolean;
  emptyMessage?: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const containerStyle = useContainerStyle();
  const displayFont = resolveTypeface(theme.typography.display);
  const dataFont = resolveTypeface(theme.typography.data);
  const align = theme.shape.align === 'center' ? 'center' : 'left';
  const suffix = overSuffix ?? '';

  const content = empty ? (
    <>
      <Text style={[styles.label, { color: theme.text.mute, textAlign: align, fontFamily: dataFont, letterSpacing: theme.typography.tracking.label }]}>
        {theme.typography.labelCase === 'upper' ? label.toUpperCase() : label}
      </Text>
      {/* Real-or-hidden: the theme's own emptyState voice, never a zero.
          'ruled'/'boxed' still read as quiet prose here — the tile's own
          container already supplies the visual weight those styles add
          elsewhere; a tile doesn't need a second one. */}
      <Text style={[styles.empty, { color: theme.text.faint, textAlign: align }]}>{emptyMessage}</Text>
    </>
  ) : (
    <>
      <View style={[styles.head, { justifyContent: align === 'center' ? 'center' : 'space-between' }]}>
        <Text style={[styles.label, { color: theme.text.mute, fontFamily: dataFont, letterSpacing: theme.typography.tracking.label }]}>
          {theme.typography.labelCase === 'upper' ? label.toUpperCase() : label}
        </Text>
        {source && align !== 'center' ? (
          <Text style={[styles.source, { color: theme.text.faint, fontFamily: dataFont }]}>
            {theme.typography.labelCase === 'upper' ? source.toUpperCase() : source}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.value,
          {
            fontFamily: displayFont,
            color: over ? theme.text.fat : theme.text.ink,
            textAlign: align,
            fontSize: span === 'full' ? theme.typography.scale.hero : theme.typography.scale.xl,
          },
        ]}
        maxFontSizeMultiplier={1.3}
      >
        {value}
        {unit ? <Text style={[styles.unit, { color: theme.text.mute, fontFamily: dataFont }]}> {unit}</Text> : null}
      </Text>
      {suffix ? (
        <Text style={[styles.suffix, { color: theme.text.fat, fontFamily: dataFont, textAlign: align }]}>{suffix.trim()}</Text>
      ) : null}
    </>
  );

  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      style={[
        styles.tile,
        { minHeight: theme.expression.rowMinHeight + 34, flexBasis: span === 'full' ? '100%' : '47%' },
        ...containerStyle,
      ]}
      onPress={onPress}
      hitSlop={onPress ? 4 : undefined}
    >
      {content}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  tile: { flexGrow: 1, minWidth: 0, padding: 12, justifyContent: 'center', gap: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 11, fontWeight: '600' },
  source: { fontSize: 10.5 },
  value: { fontWeight: '700', marginTop: 4 },
  unit: { fontSize: 12, fontWeight: '400' },
  suffix: { fontSize: 11, marginTop: 2 },
  empty: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});
