import { StyleSheet, Text, View } from 'react-native';
import { mono, monoTabular } from '../typography';
import { useTheme } from '../theme';

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
  const { theme } = useTheme();
  const numColor = tone === 'warn' ? theme.text.fat : tone === 'rest' ? theme.text.recovery : theme.text.ink;
  // Counting is the state the phone is read from across a room — the
  // countdown goes full hero (104) and the phase label steps up.
  const counting = currentSet >= 0 && tone !== 'idle';
  return (
    <View>
      <Text
        style={[styles.num, counting && styles.numCounting, { color: numColor }]}
        maxFontSizeMultiplier={1.3}
      >
        {seconds}
      </Text>
      <Text style={[styles.phase, counting && styles.phaseCounting, { color: theme.text.mute }]}>{phaseLabel.toUpperCase()}</Text>
      <View style={[styles.barTrack, { backgroundColor: theme.surfaces.border }]}>
        <View style={[styles.barFill, { backgroundColor: theme.fill.mark }, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
      </View>
      <View style={styles.setTicks}>
        {Array.from({ length: setsTotal }, (_, i) => (
          <View
            key={i}
            style={[
              styles.setTick,
              { backgroundColor: theme.surfaces.border },
              i < setsDone && { backgroundColor: theme.fill.protein },
              i === currentSet && { backgroundColor: theme.fill.mark },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** "50 s work · 20 s rest · 4 sets · 5 s lead-in" config strip. */
export function GuidedTimerConfig({ parts }: { parts: { value: string; label: string }[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.cfg}>
      {parts.map((p, i) => (
        <Text key={i} style={[styles.cfgItem, { color: theme.text.faint }]}>
          <Text style={[styles.cfgValue, { color: theme.text.ink2 }]}>{p.value}</Text> {p.label}
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
  numCounting: { fontSize: 104, lineHeight: 104, letterSpacing: -3.12 },
  phase: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textAlign: 'center',
    marginTop: 10,
  },
  phaseCounting: { fontSize: 12.5, letterSpacing: 2 },
  barTrack: { height: 4, borderRadius: 2, marginTop: 16, overflow: 'hidden' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  setTicks: { flexDirection: 'row', gap: 5, marginTop: 14, justifyContent: 'center' },
  setTick: { width: 26, height: 4, borderRadius: 2 },
  cfg: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  cfgItem: { fontFamily: mono, fontSize: 11 },
  cfgValue: { fontWeight: '500' },
});
