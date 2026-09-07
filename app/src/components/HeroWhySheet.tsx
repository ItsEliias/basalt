import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import type { TargetsRecord } from '@basalt/core-data';

// "Why" for the energy hero (core, V4 Phase 5 audit): remaining is
// target − eaten, and every part of that subtraction is shown with its
// source. No number without components.

export function HeroWhySheet({ open, onClose, targets, eatenKcal, activeKcal }: {
  open: boolean;
  onClose: () => void;
  targets: TargetsRecord;
  eatenKcal: number;
  activeKcal: number | null;
}) {
  const { theme } = useTheme();
  const remaining = Math.round(targets.calories - eatenKcal);
  const row = (name: string, value: string) => (
    <View style={styles.row}>
      <Text style={[styles.rowName, { color: theme.text.ink2 }]}>{name}</Text>
      <Text style={[styles.rowVal, { color: theme.text.mute }]}>{value}</Text>
    </View>
  );
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surfaces.surface, borderTopColor: theme.surfaces.borderStrong }]}>
        <Text style={[styles.title, { color: theme.text.mute }]}>ENERGY REMAINING — THE MATH</Text>
        {row('Target', `${Math.round(targets.calories).toLocaleString('en-US')} kcal`)}
        {row('Eaten (your log)', `− ${Math.round(eatenKcal).toLocaleString('en-US')} kcal`)}
        {row('Remaining', `${remaining >= 0 ? '' : '− '}${Math.abs(remaining).toLocaleString('en-US')} kcal${remaining < 0 ? ' over' : ''}`)}
        {activeKcal !== null && activeKcal > 0
          ? row('Active energy (synced, informational)', `${Math.round(activeKcal).toLocaleString('en-US')} kcal — not subtracted unless eat-back is on`)
          : null}
        <SrcNote>
          {targets.reason
            ? `Target set by: ${targets.reason}`
            : 'Target set in Profile & Targets — the formula and every input are shown there.'}
        </SrcNote>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  title: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  rowName: { fontSize: 13, flexShrink: 1 },
  rowVal: { fontFamily: mono, fontSize: 12, textAlign: 'right', flexShrink: 0 },
});
