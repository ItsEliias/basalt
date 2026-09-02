import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Card, SrcNote, ReceiptHeader, ReceiptRow, CTA, ChipRow, ObChipLabel, BodyFigure, EmptyState,
  color, mono, mmss, ScaledText as Text,
} from '@basalt/ui';
import {
  MOBILITY_ROUTINES, ASSESSED_POSITIONS, mobilityTimeline, timelineTotalS,
  type MobilityRoutine, type MobilityPhase, type MobilityAssessment,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';

// Mobility v1 (V3.1 H3) — three fixed routines, silent-capable, haptic
// phase changes, the body-map figure as the visual language (no photos,
// no video). The optional assessment only reorders emphasis — no score
// exists anywhere, pinned in the engine tests.

const ASSESS_KEY = 'basalt.mobilityAssessment';

export function MobilityCard() {
  const [assessment, setAssessment] = useState<MobilityAssessment>({});
  const [assessOpen, setAssessOpen] = useState(false);
  const [active, setActive] = useState<MobilityRoutine | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(ASSESS_KEY).then((raw) => {
      try {
        if (raw) setAssessment(JSON.parse(raw));
      } catch { /* fresh start */ }
    });
  }, []);

  const rate = (key: string, v: number) => {
    const next = { ...assessment, [key]: v };
    setAssessment(next);
    void AsyncStorage.setItem(ASSESS_KEY, JSON.stringify(next));
  };

  return (
    <Card>
      <ReceiptHeader label="Mobility" summary="three routines · a tool, not a library" />
      {MOBILITY_ROUTINES.map((r, i) => (
        <Pressable key={r.key} onPress={() => setActive(r)} hitSlop={8}>
          <ReceiptRow
            name={r.name}
            meta={`${r.stretchKeys.length} stretches · holds ${r.holdS}s · haptics only, sound never needed`}
            value="start"
            last={i === MOBILITY_ROUTINES.length - 1 && !assessOpen}
          />
        </Pressable>
      ))}

      <Pressable onPress={() => setAssessOpen(!assessOpen)} hitSlop={8}>
        <Text style={styles.link}>
          {assessOpen ? 'HIDE SELF-ASSESSMENT' : 'SELF-ASSESSMENT — OPTIONAL, REORDERS EMPHASIS ONLY'}
        </Text>
      </Pressable>
      {assessOpen ? (
        <>
          {ASSESSED_POSITIONS.map((p) => (
            <View key={p.key}>
              <ObChipLabel>{`${p.label} — 1 "${p.anchors[0]}" · 5 "${p.anchors[1]}"`}</ObChipLabel>
              <ChipRow
                options={['1', '2', '3', '4', '5']}
                value={assessment[p.key] !== undefined ? String(assessment[p.key]) : undefined}
                onChange={(v) => rate(p.key, parseInt(v, 10))}
              />
            </View>
          ))}
          <SrcNote>
            Your ratings put the stretches serving your tightest positions first — that is their entire effect. There is no mobility score, and there never will be one.
          </SrcNote>
        </>
      ) : null}

      <MobilityRunner routine={active} assessment={assessment} onClose={() => setActive(null)} />
    </Card>
  );
}

function KeepAwakeWhileOpen() {
  useKeepAwake();
  return null;
}

function MobilityRunner({ routine, assessment, onClose }: {
  routine: MobilityRoutine | null;
  assessment: MobilityAssessment;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [phases, setPhases] = useState<MobilityPhase[]>([]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routine) return;
    const t = mobilityTimeline(routine, assessment);
    setPhases(t);
    setIdx(0);
    setRemaining(t[0]?.seconds ?? 0);
    setRunning(false);
    setDone(false);
    startRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (!running || remaining > 0) return;
    const nextIdx = idx + 1;
    if (nextIdx >= phases.length) {
      setRunning(false);
      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void logSession();
      return;
    }
    const next = phases[nextIdx]!;
    void Haptics.impactAsync(
      next.kind === 'hold' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
    setIdx(nextIdx);
    setRemaining(next.seconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running]);

  const logSession = async () => {
    if (!routine || !startRef.current) return;
    await supabase.from('basalt_mobility_sessions').insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      routine: routine.key,
      started_at: startRef.current,
      ended_at: new Date().toISOString(),
      minutes: routine.totalMin,
      assessment,
    });
  };

  const phase = phases[idx];
  const totalS = timelineTotalS(phases);
  const elapsedS = phases.slice(0, idx).reduce((a, p) => a + p.seconds, 0) + (phase ? phase.seconds - remaining : 0);

  return (
    <Modal visible={routine !== null} transparent animationType="fade" onRequestClose={onClose}>
      {routine ? <KeepAwakeWhileOpen /> : null}
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.grab} />
        <ScrollView style={{ maxHeight: 600 }}>
          <ReceiptHeader label={routine?.name ?? ''} summary={`${mmss(Math.max(0, elapsedS))} of ${mmss(totalS)}`} />
          {phase ? (
            <>
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <BodyFigure
                  intensity={Object.fromEntries(phase.stretch.regions.map((reg) => [reg, 1]))}
                />
              </View>
              <Text style={styles.phaseName}>
                {phase.kind === 'transition' ? 'GET INTO POSITION' : phase.stretch.name.toUpperCase()}
                {phase.side ? ` — ${phase.side.toUpperCase()}` : ''}
              </Text>
              <Text style={styles.phaseClock}>{mmss(Math.max(0, remaining))}</Text>
              <Text style={styles.cue}>{phase.stretch.cue}</Text>
              {!done ? (
                <CTA
                  label={running ? 'Pause' : startRef.current ? 'Resume' : 'Begin'}
                  onPress={() => {
                    if (!startRef.current) startRef.current = new Date().toISOString();
                    setRunning(!running);
                  }}
                />
              ) : null}
            </>
          ) : null}
          {done ? (
            <>
              <EmptyState>{`${routine?.name} · logged as a mobility session`}</EmptyState>
              <CTA label="Done" onPress={onClose} />
            </>
          ) : (
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.link}>STOP — NOTHING LOGS UNDER A FULL ROUTINE</Text>
            </Pressable>
          )}
          <SrcNote>Vibration marks every change — sound never required · transitions hold the published 10 s floor · the figure shows the regions each stretch serves</SrcNote>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 16, paddingTop: 8 },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: 8 },
  link: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, color: color.faint, textAlign: 'center', paddingVertical: 10 },
  phaseName: { fontFamily: mono, fontSize: 13, letterSpacing: 1.4, color: color.ink, textAlign: 'center', marginTop: 10 },
  phaseClock: { fontFamily: mono, fontSize: 40, letterSpacing: 1, color: color.ink, textAlign: 'center', fontVariant: ['tabular-nums'], marginVertical: 4 },
  cue: { fontSize: 13, color: color.ink2, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20, marginBottom: 8 },
});
