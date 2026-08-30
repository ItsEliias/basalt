import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { color, radius } from '../tokens';
import { mono, monoTabular } from '../typography';

// The sets table — Set / Prev(ghost) / kg / Reps / RIR. Previous values are
// ghosted editable defaults; a PR is a quiet typographic mark in --carbs.
// Completion is a color state change, nothing springier.

export function ExerciseHead({ name, meta }: { name: string; meta: string }) {
  return (
    <View style={styles.exHead}>
      <Text style={styles.exName}>{name}</Text>
      <Text style={styles.exMeta}>{meta.toUpperCase()}</Text>
    </View>
  );
}

/** Superset link indicator — 2px accent line + mono caps tag. */
export function SupersetTag({ label }: { label: string }) {
  return (
    <View style={styles.ssLink}>
      <View style={styles.ssLine} />
      <Text style={styles.ssText}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** "LAST SESSION · 4 × 8 @ 72.5 kg · 14 AUG" ghost note. */
export function PrevNote({ children }: { children: string }) {
  return <Text style={styles.prevNote}>{children.toUpperCase()}</Text>;
}

export function SetsHeader({ columns }: { columns: string[] }) {
  return (
    <View style={styles.headRow}>
      {columns.map((c, i) => (
        <Text
          key={c}
          style={[styles.headCell, i === 0 ? styles.cellFirst : styles.cellRight]}
          maxFontSizeMultiplier={1.3}
        >
          {c.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

export function SetRow({
  setNumber, prev, kg, reps, rir, ghost, pr, hasComment, onPressSet,
  onChangeKg, onChangeReps, onChangeRir, onCommit,
}: {
  setNumber: string;
  prev: string;
  kg: string;
  reps: string;
  rir: string;
  /** Not-yet-completed row — values render faint. */
  ghost?: boolean;
  /** Quiet PR mark on the reps cell. */
  pr?: boolean;
  /** A saved per-set comment shows as a quiet mark on the set cell. */
  hasComment?: boolean;
  /** Tapping the set number (e.g. to open a comment sheet). */
  onPressSet?: () => void;
  onChangeKg?: (v: string) => void;
  onChangeReps?: (v: string) => void;
  onChangeRir?: (v: string) => void;
  onCommit?: () => void;
}) {
  const valueStyle = [styles.cellValue, ghost && { color: color.faint }];
  return (
    <View style={styles.row}>
      <Pressable onPress={onPressSet} style={styles.cellFirstWrap} hitSlop={6}>
        <Text style={styles.cellSet} maxFontSizeMultiplier={1.3}>
          {setNumber}
          {hasComment ? <Text style={styles.commentMark}> ✎</Text> : null}
        </Text>
      </Pressable>
      <Text style={[styles.cellPrev, styles.cellRight]} maxFontSizeMultiplier={1.3}>{prev}</Text>
      <TextInput
        style={[...valueStyle, styles.cellRight, styles.cellInput]}
        value={kg}
        onChangeText={onChangeKg}
        onEndEditing={onCommit}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={color.faint}
        maxFontSizeMultiplier={1.3}
      />
      <View style={[styles.cellRight, styles.repsWrap]}>
        <TextInput
          style={[...valueStyle, styles.cellInput, { textAlign: 'right' }]}
          value={reps}
          onChangeText={onChangeReps}
          onEndEditing={onCommit}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={color.faint}
          maxFontSizeMultiplier={1.3}
        />
        {pr ? <Text style={styles.pr}> PR</Text> : null}
      </View>
      <TextInput
        style={[...valueStyle, styles.cellRight, styles.cellInput]}
        value={rir}
        onChangeText={onChangeRir}
        onEndEditing={onCommit}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={color.faint}
        maxFontSizeMultiplier={1.3}
      />
    </View>
  );
}

/** Rest timer bar (surface2) — legible at arm's length, skippable. */
export function RestTimerBar({ time, onSkip }: { time: string; onSkip: () => void }) {
  return (
    <View style={styles.rest}>
      <Text style={styles.restLabel}>REST</Text>
      <Text style={styles.restTime}>{time}</Text>
      <Pressable onPress={onSkip}><Text style={styles.restSkip}>SKIP →</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  exHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  exName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15, color: color.ink, flexShrink: 1 },
  exMeta: { fontFamily: mono, fontSize: 11.5, color: color.faint, letterSpacing: 0.6, flexShrink: 0 },
  ssLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ssLine: { width: 2, height: 14, backgroundColor: color.protein, borderRadius: 1, marginLeft: 2 },
  ssText: { fontFamily: mono, fontSize: 11, letterSpacing: 1.24, color: color.protein },
  prevNote: { fontFamily: mono, fontSize: 11, color: color.faint, marginTop: 10 },
  headRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    marginTop: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  headCell: { fontFamily: mono, fontSize: 11, letterSpacing: 0.95, color: color.faint },
  cellFirst: { flex: 0.8, textAlign: 'left' },
  cellFirstWrap: { flex: 0.8 },
  cellRight: { flex: 1, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  cellSet: { ...monoTabular, fontSize: 11, color: color.mute },
  cellPrev: { ...monoTabular, fontSize: 11, color: color.faint },
  cellValue: { ...monoTabular, fontSize: 15, color: color.ink },
  cellInput: { paddingVertical: 4, paddingHorizontal: 0, textAlign: 'right' },
  repsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  pr: { fontFamily: mono, color: color.carbs, fontSize: 11, letterSpacing: 0.72 },
  commentMark: { fontFamily: mono, color: color.faint, fontSize: 11 },
  rest: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border2,
    borderRadius: radius.timer,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  restLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14, color: color.mute },
  restTime: { ...monoTabular, fontSize: 18, fontWeight: '500', color: color.ink },
  restSkip: { fontFamily: mono, fontSize: 11, color: color.faint, letterSpacing: 0.8 },
});
