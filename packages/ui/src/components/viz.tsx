import { StyleSheet, Text, View } from 'react-native';
import { mono, monoTabular } from '../typography';
import { useTheme, sleepStagePalette } from '../theme';

// Data visualizations that are plain views: micronutrient rows, the sleep
// stage bar, the consistency calendar. All real-or-hidden — these render
// only when the caller has actual data.

/** 2px micronutrient bar row — --mute fill, --carbs when target met. */
export function MicroRow({ name, pct }: { name: string; pct: number }) {
  const { theme } = useTheme();
  const full = pct >= 100;
  const fill = full ? theme.fill.carbs : theme.fill.faint;
  return (
    <View style={styles.micro}>
      <Text style={[styles.microName, { color: theme.text.ink2 }]}>{name}</Text>
      <View style={[styles.microTrack, { backgroundColor: theme.surfaces.border }]}>
        <View style={[styles.microFill, { width: `${Math.min(100, pct)}%`, backgroundColor: fill }]} />
      </View>
      <Text style={[styles.microVal, { color: theme.text.mute }, full && { color: theme.text.carbs }]} maxFontSizeMultiplier={1.3}>{Math.round(pct)}%</Text>
    </View>
  );
}

export type SleepStageSeg = { stage: 'deep' | 'light' | 'rem' | 'awake' | 'sleeping' | 'unknown'; fraction: number };

/** 26px sleep stage bar, 2px gaps, indigo ramp + awake gray — per theme. */
export function StageBar({ segments }: { segments: SleepStageSeg[] }) {
  const { theme } = useTheme();
  const stageFill = sleepStagePalette(theme);
  return (
    <View style={styles.stageBar}>
      {segments.map((s, i) => (
        <View key={i} style={[styles.stageSeg, { flex: Math.max(0.0001, s.fraction), backgroundColor: stageFill[s.stage] }]} />
      ))}
    </View>
  );
}

export function StageKey({ items }: { items: { stage: SleepStageSeg['stage']; label: string }[] }) {
  const { theme } = useTheme();
  const stageFill = sleepStagePalette(theme);
  return (
    <View style={styles.stageKey}>
      {items.map((it, i) => (
        <View key={i} style={styles.stageKeyItem}>
          <View style={[styles.stageKeyDot, { backgroundColor: stageFill[it.stage] }]} />
          <Text style={[styles.stageKeyText, { color: theme.text.mute }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function TimeScale({ labels }: { labels: string[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.timeScale}>
      {labels.map((l, i) => <Text key={i} style={[styles.timeScaleText, { color: theme.text.faint }]}>{l}</Text>)}
    </View>
  );
}

export type CalCell = 'on' | 'part' | 'off' | 'today' | 'future' | 'hidden';

/**
 * Consistency calendar — 9px dots. Filled = full log, dim = partial, gaps
 * stay gray: no flames, no guilt, no resetting counters.
 */
export function CalGrid({ cells }: { cells: CalCell[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.calGrid}>
      {cells.map((c, i) => (
        <View key={i} style={styles.calCell}>
          <View
            style={[
              styles.calDot,
              { backgroundColor: theme.surfaces.border },
              c === 'on' && { backgroundColor: theme.fill.carbs },
              c === 'part' && { backgroundColor: theme.fill.faint },
              c === 'today' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.text.ink2 },
              c === 'future' && { backgroundColor: theme.surfaces.surface2 },
              c === 'hidden' && { opacity: 0 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function CalDays() {
  const { theme } = useTheme();
  return (
    <View style={styles.calDays}>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <Text key={i} style={[styles.calDay, { color: theme.text.faint }]}>{d}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  micro: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  microName: { fontSize: 12, width: 88, flexShrink: 0 },
  microTrack: { flex: 1, height: 2, borderRadius: 1 },
  microFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1 },
  microVal: { ...monoTabular, fontSize: 11, width: 40, textAlign: 'right', flexShrink: 0 },
  stageBar: { flexDirection: 'row', height: 26, gap: 2, marginTop: 14 },
  stageSeg: { borderRadius: 2.5 },
  stageKey: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  stageKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageKeyDot: { width: 8, height: 8, borderRadius: 2 },
  stageKeyText: { fontFamily: mono, fontSize: 11 },
  timeScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeScaleText: { fontFamily: mono, fontSize: 11 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 8 },
  calCell: { flexBasis: `${100 / 7}%`, alignItems: 'center' },
  calDot: { width: 9, height: 9, borderRadius: 3 },
  calDays: { flexDirection: 'row', marginTop: 12 },
  calDay: { fontFamily: mono, fontSize: 11, letterSpacing: 0.51, flex: 1, textAlign: 'center' },
});
