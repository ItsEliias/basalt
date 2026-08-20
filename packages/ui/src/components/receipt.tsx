import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color } from '../tokens';
import { mono, monoTabular } from '../typography';
import { MicroLabel } from './base';

// The receipt — Basalt's signature list. Name + mono meta line left,
// right-aligned mono value + unit; 1px hairline separators; meal tags as
// light typographic section headers, never containers.

export function ReceiptHeader({ label, summary }: { label: string; summary?: string }) {
  return (
    <View style={styles.header}>
      <MicroLabel>{label}</MicroLabel>
      {summary ? <Text style={styles.sum}>{summary}</Text> : null}
    </View>
  );
}

export function MealTag({ children }: { children: string }) {
  return <Text style={styles.mealTag}>{children.toUpperCase()}</Text>;
}

export function ReceiptRow({
  name, meta, value, unit, last, valueColor, thumb, metaAccent,
}: {
  name: string;
  meta?: ReactNode;
  value?: string;
  unit?: string;
  last?: boolean;
  valueColor?: string;
  /** Optional 30px leading thumbnail element. */
  thumb?: ReactNode;
  /** Render `meta` in an accent (e.g. a dietary-conflict line in --fat). */
  metaAccent?: string;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.left}>
        {thumb}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.name}>{name}</Text>
          {meta ? <Text style={[styles.meta, metaAccent ? { color: metaAccent } : null]}>{meta}</Text> : null}
        </View>
      </View>
      {value !== undefined ? (
        <View style={styles.right}>
          <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sum: { fontFamily: mono, fontSize: 11, color: color.faint },
  mealTag: {
    fontFamily: mono,
    fontSize: 9.5,
    letterSpacing: 0.95,
    color: color.mute,
    paddingTop: 14,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1, paddingRight: 12 },
  name: { fontSize: 13, fontWeight: '500', color: color.ink },
  meta: { fontFamily: mono, fontSize: 10.5, color: color.faint, marginTop: 3 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  value: { ...monoTabular, fontSize: 13, color: color.ink },
  unit: { fontFamily: mono, fontSize: 10, color: color.faint, marginTop: 3 },
});
