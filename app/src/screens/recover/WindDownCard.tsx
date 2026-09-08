import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, ReceiptHeader, ReceiptRow, SrcNote, mono, mmss, useTheme, ScaledText as Text } from '@basalt/ui';
import { writeThroughOutbox } from '../../lib/outbox';
import { supabase } from '../../lib/supabase';
import { bodyScanStage } from '../../lib/windDown';

// Wind-down (winddown Extra) — a 5-minute body scan and a 10-minute quiet
// timer. Box breathing is NOT duplicated here: the breath pacer below
// this card is the same tool, pointed at. Completed minutes land in the
// ledger as mindfulness sessions, like every other real practice.

type Mode = { kind: 'scan' | 'quiet'; totalSec: number } | null;

export function WindDownCard() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mode) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    // A gentle tick at each minute boundary — the scan changes stage there.
    if (elapsed > 0 && elapsed % 60 === 0) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (elapsed >= mode.totalSec) void stop(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const start = (kind: 'scan' | 'quiet') => {
    startedAtRef.current = new Date().toISOString();
    setElapsed(0);
    setMode({ kind, totalSec: kind === 'scan' ? 300 : 600 });
  };

  const stop = async (completed: boolean) => {
    const startedAt = startedAtRef.current;
    const seconds = elapsed;
    setMode(null);
    setElapsed(0);
    startedAtRef.current = null;
    // Same floor as the breath pacer: under 30 s is a false start.
    if (!startedAt || (!completed && seconds < 30)) return;
    const row = {
      user_id: (await supabase.auth.getUser()).data.user?.id,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      minutes: Math.round((seconds / 60) * 10) / 10,
      kind: 'unguided',
      source: 'manual',
    };
    await writeThroughOutbox(
      async () => {
        const { error } = await supabase.from('basalt_mindfulness_sessions').insert(row);
        return error ? { ok: false as const, error: error.message } : { ok: true as const, data: undefined };
      },
      { kind: 'mindfulness', row },
    );
  };

  return (
    <Card>
      <ReceiptHeader label="Wind-down" summary={mode ? 'running' : undefined} />
      {mode ? (
        <>
          <Text style={[styles.clock, { color: theme.text.ink }]}>{mmss(mode.totalSec - elapsed)}</Text>
          <Text style={[styles.stage, { color: theme.text.mute }]}>
            {mode.kind === 'scan' ? bodyScanStage(elapsed) : 'Nothing to do. The timer is doing it.'}
          </Text>
          <Pressable onPress={() => void stop(false)} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.btn, { color: theme.text.faint }]}>STOP — MINUTES STILL COUNT PAST 30 S</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={() => start('scan')} hitSlop={8}>
            <ReceiptRow name="Body scan" meta="five minutes, one plain instruction per minute, a light tick between them" value="5:00" unit="" />
          </Pressable>
          <Pressable onPress={() => start('quiet')} hitSlop={8}>
            <ReceiptRow name="Quiet timer" meta="ten minutes of nothing — no audio, no guidance, just an end" value="10:00" unit="" />
          </Pressable>
          <ReceiptRow
            name="Box breathing"
            meta="4-4-4-4 with the visual pacer and haptics — it lives in the breath card below, not duplicated here"
            value="below ↓"
            unit=""
            last
          />
        </>
      )}
      <SrcNote>Completed minutes land in your ledger as mindfulness sessions · offered by notification only when sleep debt passes 90 minutes, once, at your usual bedtime minus 30</SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  clock: { fontFamily: mono, fontSize: 40, textAlign: 'center', marginVertical: 10 },
  stage: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginBottom: 8 },
  btn: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, textAlign: 'center', paddingVertical: 12 },
});
