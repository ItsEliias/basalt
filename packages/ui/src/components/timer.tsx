import { StyleSheet, Text, View } from 'react-native';
import { color } from '../tokens';
import { mono, monoTabular } from '../typography';

// Guided set timer display — hero countdown, phase label, 3px progress bar,
// set ticks. Pure presentation: the engine lives in @basalt/training.

export type GuidedPhaseTone = 'work' | 'rest' | 'warn' | 'idle';

export function GuidedTimerDisplay({
  seconds, phaseLabel, tone, progress, setsDone, setsTotal, currentSet,
}: {
  seconds: string;
  phaseLabel: string;
  tone: GuidedPhaseTone;
  /** 0–1 fill of the current phase. */
  progress: number;
  setsDone: number;
  setsTotal: number;
  /** 0-based index of the set now running, or -1 when idle/finished. */
  currentSet: number;
}) {
  const numColor = tone === 'warn' ? color.fat : tone === 'rest' ? color.recovery : color.ink;
  return (
    <View>
      <Text style={[styles.num, { color: numColor }]}>{seconds}</Text>
      <Text style={styles.phase}>{phaseLabel.toUpperCase()}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
      </View>
      <View style={styles.setTicks}>
        {Array.from({ length: setsTotal }, (_, i) => (
          <View
            key={i}
            style={[
              styles.setTick,
              i < setsDone && { backgroundColor: color.protein },
              i === currentSet && { backgroundColor: color.ink2 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** "50 s work · 20 s rest · 4 sets · 5 s lead-in" config strip. */
export function GuidedTimerConfig({ parts }: { parts: { value: string; label: string }[] }) {
  return (
    <View style={styles.cfg}>
      {parts.map((p, i) => (
        <Text key={i} style={styles.cfgItem}>
          <Text style={styles.cfgValue}>{p.value}</Text> {p.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  num: {
    ...monoTabular,
    fontSize: 64,
    fontWeight: '600',
    letterSpacing: -1.92,
    lineHeight: 64,
    textAlign: 'center',
    marginTop: 18,
  },
  phase: {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: color.mute,
    textAlign: 'center',
    marginTop: 10,
  },
  barTrack: { height: 3, borderRadius: 2, backgroundColor: color.border, marginTop: 16, overflow: 'hidden' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: color.ink2 },
  setTicks: { flexDirection: 'row', gap: 5, marginTop: 14, justifyContent: 'center' },
  setTick: { width: 26, height: 4, borderRadius: 2, backgroundColor: color.border },
  cfg: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  cfgItem: { fontFamily: mono, fontSize: 10.5, color: color.faint },
  cfgValue: { color: color.ink2, fontWeight: '500' },
});
