import { StyleSheet, Text, View } from 'react-native';
import { color } from '../tokens';
import { mono, monoTabular } from '../typography';
import { capState, fillPct } from '../format';

// Macro rows, cap rows, hairline bars and the segmented macro stack —
// prototype .macro / .bar / .stack, metrics copied exactly.

/** 3px hairline progress bar. */
export function Bar({ pct, fill }: { pct: number; fill: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: fill }]} />
    </View>
  );
}

function Ratio({ value, target, unit, over }: { value: string; target: string; unit: string; over?: boolean }) {
  return (
    <Text style={[styles.ratio, over && { color: color.fat }]}>
      {value} <Text style={[styles.ratioOf, over && { color: color.fat }]}>/ {target} {unit}</Text>
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
  return (
    <View style={styles.macro}>
      <View style={styles.kv}>
        <Text style={styles.name}>
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
 * Cap row — under is the goal. Over-state: bar 100% in --fat, ratio text in
 * --fat with "· N over" stated plainly. Never hidden, never scolded.
 */
export function CapRow({
  name, value, cap, unit = 'g', decimals = 0,
}: {
  name: string; value: number; cap: number; unit?: string; decimals?: number;
}) {
  const s = capState(value, cap);
  const fmt = (n: number) => n.toFixed(decimals);
  return (
    <View style={styles.macro}>
      <View style={styles.kv}>
        <Text style={styles.name}>
          <View style={[styles.dot, { backgroundColor: s.over ? color.fat : color.faint }]} />
          {'  '}{name}
        </Text>
        <Text style={[styles.ratio, s.over && { color: color.fat }]}>
          {fmt(value)} <Text style={[styles.ratioOf, s.over && { color: color.fat }]}>/ {fmt(cap)} {unit}</Text>
          {s.over ? ` · ${fmt(s.overBy)} over` : ''}
        </Text>
      </View>
      <Bar pct={s.fillPct} fill={s.over ? color.fat : color.faint} />
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
  const used = segments.reduce((s, x) => s + Math.max(0, x.fraction), 0);
  return (
    <View style={styles.stack}>
      {segments.map((s, i) => (
        <View key={i} style={[styles.stackSeg, { flex: Math.max(0.0001, s.fraction), backgroundColor: s.fill }]} />
      ))}
      <View style={[styles.stackSeg, styles.stackRest, { flex: Math.max(0.0001, 1 - Math.min(1, used)) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  macro: { marginTop: 13 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontSize: 12.5, color: color.ink2 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  ratio: { ...monoTabular, fontSize: 12, color: color.ink2 },
  ratioOf: { fontFamily: mono, color: color.faint },
  barTrack: { height: 3, borderRadius: 2, backgroundColor: color.border, marginTop: 7, overflow: 'hidden' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  stack: { height: 6, borderRadius: 3, marginTop: 14, flexDirection: 'row', gap: 2 },
  stackSeg: { borderRadius: 2 },
  stackRest: { backgroundColor: color.border },
});
