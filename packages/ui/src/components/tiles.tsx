import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { color, radius } from '../tokens';
import { mono, monoTabular } from '../typography';

// Stat tiles (2-col grid), 26px sparkline, water ticks. Deltas wear an accent
// only when they encode direction; sources appear as em-style microlabels.

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function StatTile({
  label, source, value, unit, delta, deltaTone, children,
}: {
  label: string;
  /** e.g. "PIXEL WATCH" — the honesty source tag. */
  source?: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
  children?: ReactNode;
}) {
  const deltaColor = deltaTone === 'up' ? color.carbs : deltaTone === 'down' ? color.fat : color.mute;
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
        {source ? <Text style={styles.tileSource}>{source.toUpperCase()}</Text> : null}
      </View>
      <Text style={styles.tileValue}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {delta ? <Text style={[styles.tileDelta, { color: deltaColor }]}>{delta}</Text> : null}
      {children}
    </View>
  );
}

/** Real-or-hidden: a tile with no data explains itself quietly. */
export function EmptyTile({ label, message }: { label: string; message: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={styles.tileEmpty}>{message}</Text>
    </View>
  );
}

/** 26px sparkline with an end dot — pass normalized points (0–1 range). */
export function Sparkline({ points, stroke, width = 140, height = 26 }: {
  points: number[]; stroke: string; width?: number; height?: number;
}) {
  if (points.length < 2) return null;
  const pad = 3.5;
  const xs = points.map((_, i) => pad + (i * (width - pad * 2)) / (points.length - 1));
  const ys = points.map((p) => pad + (1 - Math.max(0, Math.min(1, p))) * (height - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ marginTop: 10 }}>
      <Path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.5} fill={stroke} stroke={color.surface} strokeWidth={2} />
    </Svg>
  );
}

/** 14px water ticks, 3px gaps; tap anywhere adds a tick (+250 instant). */
export function WaterTicks({ total, filled, onAdd }: { total: number; filled: number; onAdd?: () => void }) {
  return (
    <Pressable onPress={onAdd} style={styles.ticks}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.tick, i < filled && { backgroundColor: color.recovery }]} />
      ))}
    </Pressable>
  );
}

export function TickCaption({ left, right, onPressLeft }: { left: string; right: string; onPressLeft?: () => void }) {
  return (
    <View style={styles.tickCap}>
      <Pressable onPress={onPressLeft}><Text style={styles.tickCapAction}>{left.toUpperCase()}</Text></Pressable>
      <Text style={styles.tickCapText}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  tile: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.tile,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
  },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  tileLabel: { fontFamily: mono, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, color: color.mute, flexShrink: 1 },
  tileSource: { fontFamily: mono, fontSize: 9, color: color.faint, letterSpacing: 0.36, flexShrink: 0 },
  tileValue: { ...monoTabular, fontSize: 23, fontWeight: '600', letterSpacing: -0.46, color: color.ink, marginTop: 9 },
  tileUnit: { fontSize: 12, fontWeight: '400', color: color.mute },
  tileDelta: { fontFamily: mono, fontSize: 10.5, marginTop: 5 },
  tileEmpty: { fontSize: 12.5, color: color.faint, lineHeight: 19, marginTop: 10 },
  ticks: { flexDirection: 'row', gap: 3, marginTop: 14 },
  tick: { flex: 1, height: 14, borderRadius: 2.5, backgroundColor: color.border },
  tickCap: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  tickCapAction: { fontFamily: mono, fontSize: 10.5, color: color.ink2, fontWeight: '500' },
  tickCapText: { fontFamily: mono, fontSize: 10.5, color: color.faint },
});
