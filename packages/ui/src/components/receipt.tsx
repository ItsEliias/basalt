import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { type as typeScale } from '../tokens';
import { monoTabular } from '../typography';
import { MicroLabel } from './base';
import { useTheme, resolveTypeface, DENSITY_PAD, TEXT_SCALE_MULTIPLIER } from '../theme';

// The receipt — Basalt's signature list. Name + meta line left, right-
// aligned value + unit; hairline separators; meal tags as light
// typographic section headers, never containers. Name/mealTag read
// typography.ui (chrome); meta/value/unit read typography.data (numerals,
// timestamps, tables) per the contract's own split.

export function ReceiptHeader({ label, summary }: { label: string; summary?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.header}>
      <MicroLabel>{label}</MicroLabel>
      {summary ? (
        <Text
          style={[
            styles.sum,
            {
              fontFamily: resolveTypeface(theme.typography.data, theme.typography.weight.regular),
              fontWeight: String(theme.typography.weight.regular) as TextStyle['fontWeight'],
              color: theme.text.faint,
            },
          ]}
        >
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

export function MealTag({ children }: { children: string }) {
  const { theme } = useTheme();
  const upper = theme.typography.labelCase === 'upper';
  return (
    <Text
      style={[
        styles.mealTag,
        {
          fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.medium),
          fontWeight: String(theme.typography.weight.medium) as TextStyle['fontWeight'],
          color: theme.text.mute,
          letterSpacing: theme.typography.tracking.label,
        },
      ]}
    >
      {upper ? children.toUpperCase() : children}
    </Text>
  );
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
  const { theme, density, textScale } = useTheme();
  const nameSize = typeScale.rowName.fontSize * TEXT_SCALE_MULTIPLIER[textScale];
  const metaSize = typeScale.rowMeta.fontSize * TEXT_SCALE_MULTIPLIER[textScale];
  const dataFont = resolveTypeface(theme.typography.data, theme.typography.weight.regular);
  const dataWeight = String(theme.typography.weight.regular) as TextStyle['fontWeight'];
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: theme.expression.rowMinHeight,
          borderBottomColor: theme.surfaces.border,
          paddingVertical: 10 + DENSITY_PAD[density],
        },
        last && styles.rowLast,
      ]}
    >
      <View style={styles.left}>
        {thumb}
        <View style={{ flexShrink: 1 }}>
          <Text
            style={[
              styles.name,
              {
                fontSize: nameSize,
                fontFamily: resolveTypeface(theme.typography.ui, theme.typography.weight.medium),
                fontWeight: String(theme.typography.weight.medium) as TextStyle['fontWeight'],
                color: theme.text.ink,
              },
            ]}
            maxFontSizeMultiplier={1.3}
          >
            {name}
          </Text>
          {meta ? (
            <Text
              style={[
                styles.meta,
                { fontSize: metaSize, fontFamily: dataFont, fontWeight: dataWeight, color: theme.text.faint },
                metaAccent ? { color: metaAccent } : null,
              ]}
              maxFontSizeMultiplier={1.3}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
      {value !== undefined ? (
        <View style={styles.right}>
          <Text
            style={[styles.value, { fontFamily: dataFont, fontWeight: dataWeight, color: theme.text.ink }, valueColor ? { color: valueColor } : null]}
            maxFontSizeMultiplier={1.3}
          >
            {value}
          </Text>
          {unit ? (
            <Text style={[styles.unit, { fontFamily: dataFont, fontWeight: dataWeight, color: theme.text.faint }]} maxFontSizeMultiplier={1.3}>
              {unit}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sum: { fontSize: 11, flexShrink: 1, marginLeft: 12, textAlign: 'right' },
  mealTag: {
    fontSize: 11,
    paddingTop: 14,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1, paddingRight: 12 },
  name: { fontSize: 14 },
  meta: { fontSize: 11.5, marginTop: 3 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  value: { ...monoTabular, fontSize: 15 },
  unit: { fontSize: 11.5, marginTop: 3 },
});
