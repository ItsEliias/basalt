import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { INTAKE_RANGE_EXPLAINER, intakeRangeLine, uncertaintyFor } from '@basalt/nutrition';
import type { FoodEntryRow } from '@basalt/nutrition';

// Visible uncertainty (uncertainty Extra, on by default): the day's intake
// as a range under the energy hero, tap for the published per-source
// model applied to today's actual entries.

export function IntakeRangeNote({ entries }: { entries: FoodEntryRow[] }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const line = intakeRangeLine(entries);
  if (!line) return null;

  const bySource = new Map<string, { n: number; kcal: number; u: number }>();
  for (const e of entries) {
    const base = String(e.source ?? 'manual').split(':')[0]!;
    const row = bySource.get(base) ?? { n: 0, kcal: 0, u: uncertaintyFor(e.source) };
    row.n += 1;
    row.kcal += e.calories;
    bySource.set(base, row);
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Why this range">
        <Text style={[styles.line, { color: theme.text.faint }]}>{line}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dim} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surfaces.surface, borderTopColor: theme.surfaces.borderStrong }]}>
          <Text style={[styles.title, { color: theme.text.mute }]}>WHY THIS RANGE</Text>
          {[...bySource.entries()].map(([source, row]) => (
            <View key={source} style={styles.row}>
              <Text style={[styles.rowName, { color: theme.text.ink2 }]}>
                {`${row.n} × ${source.replace('_', ' ')}`}
              </Text>
              <Text style={[styles.rowVal, { color: theme.text.mute }]}>
                {`${Math.round(row.kcal).toLocaleString('en-US')} kcal ± ${Math.round(row.u * 100)}%`}
              </Text>
            </View>
          ))}
          <SrcNote>{INTAKE_RANGE_EXPLAINER}</SrcNote>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: mono, fontSize: 11, letterSpacing: 0.3, marginTop: 6 },
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  title: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  rowName: { fontSize: 13 },
  rowVal: { fontFamily: mono, fontSize: 12 },
});
