import { StyleSheet, Text, View } from 'react-native';
import { color } from '../tokens';
import { mono, monoTabular } from '../typography';

// Data visualizations that are plain views: micronutrient rows, the sleep
// stage bar, the consistency calendar. All real-or-hidden — these render
// only when the caller has actual data.

/** 2px micronutrient bar row — --mute fill, --carbs when target met. */
export function MicroRow({ name, pct }: { name: string; pct: number }) {
  const full = pct >= 100;
  const fill = full ? color.carbs : color.mute;
  return (
    <View style={styles.micro}>
      <Text style={styles.microName}>{name}</Text>
      <View style={styles.microTrack}>
        <View style={[styles.microFill, { width: `${Math.min(100, pct)}%`, backgroundColor: fill }]} />
      </View>
      <Text style={[styles.microVal, full && { color: color.carbs }]}>{Math.round(pct)}%</Text>
    </View>
  );
}

export type SleepStageSeg = { stage: 'deep' | 'light' | 'rem' | 'awake' | 'sleeping' | 'unknown'; fraction: number };

const STAGE_FILL: Record<SleepStageSeg['stage'], string> = {
  deep: color.recoveryDeep,
  light: color.recoveryLight,
  rem: color.recovery,
  awake: color.awake,
  sleeping: color.recoveryLight,
  unknown: color.awake,
};

/** 26px sleep stage bar, 2px gaps, indigo ramp + awake gray. */
export function StageBar({ segments }: { segments: SleepStageSeg[] }) {
  return (
    <View style={styles.stageBar}>
      {segments.map((s, i) => (
        <View key={i} style={[styles.stageSeg, { flex: Math.max(0.0001, s.fraction), backgroundColor: STAGE_FILL[s.stage] }]} />
      ))}
    </View>
  );
}

export function StageKey({ items }: { items: { stage: SleepStageSeg['stage']; label: string }[] }) {
  return (
    <View style={styles.stageKey}>
      {items.map((it, i) => (
        <View key={i} style={styles.stageKeyItem}>
          <View style={[styles.stageKeyDot, { backgroundColor: STAGE_FILL[it.stage] }]} />
          <Text style={styles.stageKeyText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function TimeScale({ labels }: { labels: string[] }) {
  return (
    <View style={styles.timeScale}>
      {labels.map((l, i) => <Text key={i} style={styles.timeScaleText}>{l}</Text>)}
    </View>
  );
}

export type CalCell = 'on' | 'part' | 'off' | 'today' | 'future' | 'hidden';

/**
 * Consistency calendar — 9px dots. Filled = full log, dim = partial, gaps
 * stay gray: no flames, no guilt, no resetting counters.
 */
export function CalGrid({ cells }: { cells: CalCell[] }) {
  return (
    <View style={styles.calGrid}>
      {cells.map((c, i) => (
        <View key={i} style={styles.calCell}>
          <View
            style={[
              styles.calDot,
              c === 'on' && { backgroundColor: color.carbs },
              c === 'part' && { backgroundColor: color.faint },
              c === 'today' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.ink2 },
              c === 'future' && { backgroundColor: color.surface2 },
              c === 'hidden' && { opacity: 0 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function CalDays() {
  return (
    <View style={styles.calDays}>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <Text key={i} style={styles.calDay}>{d}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  micro: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  microName: { fontSize: 12, color: color.ink2, width: 88, flexShrink: 0 },
  microTrack: { flex: 1, height: 2, borderRadius: 1, backgroundColor: color.border },
  microFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1 },
  microVal: { ...monoTabular, fontSize: 11, color: color.mute, width: 40, textAlign: 'right', flexShrink: 0 },
  stageBar: { flexDirection: 'row', height: 26, gap: 2, marginTop: 14 },
  stageSeg: { borderRadius: 2.5 },
  stageKey: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  stageKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageKeyDot: { width: 8, height: 8, borderRadius: 2 },
  stageKeyText: { fontFamily: mono, fontSize: 10, color: color.mute },
  timeScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeScaleText: { fontFamily: mono, fontSize: 9.5, color: color.faint },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 8 },
  calCell: { flexBasis: `${100 / 7}%`, alignItems: 'center' },
  calDot: { width: 9, height: 9, borderRadius: 3, backgroundColor: color.border },
  calDays: { flexDirection: 'row', marginTop: 12 },
  calDay: { fontFamily: mono, fontSize: 8.5, color: color.faint, letterSpacing: 0.51, flex: 1, textAlign: 'center' },
});
