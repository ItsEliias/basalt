import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { mono, monoTabular } from '../typography';
import { capState, fillPct, overCapSuffix } from '../format';
import { useTheme, resolveTypeface } from '../theme';

// Macro rows, cap rows, hairline bars and the segmented macro stack —
// prototype .macro / .bar / .stack, metrics copied exactly.

/** Progress bar — track geometry/colour from the theme (reference/themes-
 *  today.html's `.meter`), fill colour stays caller-supplied so macro/cap
 *  rows keep their own semantic colours (protein/carbs/fat, or fat/faint
 *  for cap state) rather than every bar collapsing to one accent. */
export function Bar({ pct, fill }: { pct: number; fill: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.barTrack,
        { height: theme.shape.meterHeight, borderRadius: theme.shape.meterRadius, backgroundColor: theme.surfaces.surface2 },
      ]}
    >
      <View
        style={[
          styles.barFill,
          { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: fill, borderRadius: theme.shape.meterRadius },
        ]}
      />
    </View>
  );
}

function Ratio({ value, target, unit, over }: { value: string; target: string; unit: string; over?: boolean }) {
  const { theme } = useTheme();
  // Data face, floored at 12.5 — condensed faces (Athletic) cramp below it.
  const size = Math.max(12.5, theme.typography.scale.sm);
  return (
    <Text style={[styles.ratio, { fontSize: size, color: theme.text.ink2 }, over && { color: theme.text.fat }]} maxFontSizeMultiplier={1.3}>
      {value} <Text style={[styles.ratioOf, { fontSize: size, color: theme.text.faint }, over && { color: theme.text.fat }]}>/ {target} {unit}</Text>
      {over ? '' : null}
    </Text>
  );
}

/** dotkey + name + `142 / 180 g` ratio + 3px bar. */
export function MacroRow({
  name, dot, value, target, unit = 'g',
}: {
  name: string; dot: string; value: number; target: number; unit?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.macro}>
      <View style={styles.kv}>
        <Text style={[styles.name, { color: theme.text.ink }]}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          {'  '}{name}
        </Text>
        <Ratio value={String(Math.round(value))} target={String(Math.round(target))} unit={unit} />
      </View>
      <Bar pct={fillPct(value, target)} fill={dot} />
    </View>
  );
}

/**
 * Cap row — under is the goal. First component migrated onto the theme
 * contract (see packages/ui/src/theme/): text colour, fill colour, and
 * `expression.overCap` together decide the over-state, so it renders
 * correctly in any of the six themes, not just Minimal.
 *
 * Deliberately does NOT read `shape.align` — verified against
 * reference/themes-today.html: every theme including Atelier keeps list
 * rows left-aligned (`align: 'center'` only centres hero/tile content).
 * Not a gap; a row component has nothing to center.
 *
 * `overCap` controls how the over-state is WORDED, never whether it's
 * shown — the bar and dot always fill in `fill.fat` regardless:
 *   'all'  -> numeric delta stated ("· 5 over")
 *   'word' -> plain word, no delta ("— over")
 *   'fill' -> the fill alone carries it, no extra text
 * ('color' is contractually forbidden — colour alone fails WCAG 1.4.1 and
 * the honesty rule that over-cap is stated plainly.)
 */
export function CapRow({
  name, value, cap, unit = 'g', decimals = 0,
}: {
  name: string; value: number; cap: number; unit?: string; decimals?: number;
}) {
  const { theme } = useTheme();
  const s = capState(value, cap);
  const fmt = (n: number) => n.toFixed(decimals);
  const overSuffix = overCapSuffix(s.over, theme.expression.overCap, s.overBy, fmt);
  const dataFont = resolveTypeface(theme.typography.data, theme.typography.weight.regular);
  const dataWeight = String(theme.typography.weight.regular) as TextStyle['fontWeight'];
  // Data face, floored at 12.5 — condensed faces (Athletic) cramp below it.
  const ratioSize = Math.max(12.5, theme.typography.scale.sm);

  return (
    <View style={styles.macro}>
      <View style={styles.kv}>
        <Text style={[styles.name, { color: theme.text.ink2 }]}>
          <View style={[styles.dot, { backgroundColor: s.over ? theme.fill.fat : theme.fill.faint }]} />
          {'  '}{name}
        </Text>
        <Text
          style={[styles.ratio, { fontSize: ratioSize, fontFamily: dataFont, fontWeight: dataWeight, color: s.over ? theme.text.fat : theme.text.ink2 }]}
          maxFontSizeMultiplier={1.3}
        >
          {fmt(value)}{' '}
          <Text style={[styles.ratioOf, { fontSize: ratioSize, fontFamily: dataFont, fontWeight: dataWeight, color: s.over ? theme.text.fat : theme.text.faint }]}>
            / {fmt(cap)} {unit}
          </Text>
          {overSuffix}
        </Text>
      </View>
      <Bar pct={s.fillPct} fill={s.over ? theme.fill.fat : theme.fill.faint} />
    </View>
  );
}

/** Segmented 6px macro stack with 2px gaps (hero card footer). */
export function SegmentedStack({
  segments,
}: {
  /** widths as fractions of the whole (0–1); remainder renders as track. */
  segments: { fraction: number; fill: string }[];
}) {
  const { theme } = useTheme();
  const used = segments.reduce((s, x) => s + Math.max(0, x.fraction), 0);
  return (
    <View style={styles.stack}>
      {segments.map((s, i) => (
        <View key={i} style={[styles.stackSeg, { flex: Math.max(0.0001, s.fraction), backgroundColor: s.fill }]} />
      ))}
      <View style={[styles.stackSeg, { flex: Math.max(0.0001, 1 - Math.min(1, used)), backgroundColor: theme.surfaces.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  macro: { marginTop: 13 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontSize: 12.5 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  ratio: { ...monoTabular, fontSize: 12 },
  ratioOf: { fontFamily: mono },
  barTrack: { marginTop: 7, overflow: 'hidden' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  stack: { height: 6, borderRadius: 3, marginTop: 14, flexDirection: 'row', gap: 2 },
  stackSeg: { borderRadius: 2 },
});
