import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer } from 'expo-audio';
import { Card, ReceiptHeader, ReceiptRow, SrcNote, mono, mmss, useTheme, ScaledText as Text } from '@basalt/ui';
import { writeThroughOutbox } from '../../lib/outbox';
import { supabase } from '../../lib/supabase';

// Meditation timer (meditation Extra) — a quiet countdown with an
// interval bell every five minutes. Redesigned after the 2026-09-08
// device session: a health-type foreground service crashes on targetSDK
// 36 without granted health permissions, so the bells are SCHEDULED
// one-shot notifications instead (AlarmManager-backed — they fire with
// the phone locked, no service, no extra permission beyond notifications,
// which the schedule call asks for). Minutes land in the ledger as
// mindfulness sessions; that is the entire feature.

const CHANNEL_ID = 'basalt.meditation';
const BELL_ID_PREFIX = 'basalt.meditation.bell.';
const DURATIONS_MIN = [5, 10, 20] as const;
const BELL_EVERY_MIN = 5;

function bell(): void {
  try {
    const player = createAudioPlayer(require('../../../assets/sounds/tick.wav'));
    player.volume = 0.5;
    player.play();
    setTimeout(() => { try { player.release(); } catch { /* released */ } }, 1500);
  } catch { /* a missing bell is not an error */ }
}

async function cancelBells(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Notifications.cancelScheduledNotificationAsync(`${BELL_ID_PREFIX}${i}`).catch(() => {});
  }
}

async function scheduleBells(totalMin: number): Promise<boolean> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Meditation timer',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  const marks: number[] = [];
  for (let m = BELL_EVERY_MIN; m < totalMin; m += BELL_EVERY_MIN) marks.push(m);
  marks.push(totalMin);
  await Promise.all(
    marks.map((m, i) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${BELL_ID_PREFIX}${i}`,
        content: {
          title: m === totalMin ? 'Meditation — done' : 'Meditation',
          body: m === totalMin ? `${totalMin} minutes complete.` : `${m} of ${totalMin} minutes.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + m * 60_000),
          channelId: CHANNEL_ID,
        },
      }),
    ),
  );
  return true;
}

export function MeditationCard() {
  const { theme } = useTheme();
  const [totalSec, setTotalSec] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (totalSec === null) return;
    const iv = setInterval(() => {
      // Wall-clock elapsed, so a backgrounded JS timer can't drift the sit.
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - Date.parse(startedAtRef.current)) / 1000));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [totalSec]);

  useEffect(() => {
    if (totalSec === null) return;
    if (elapsed > 0 && elapsed % (BELL_EVERY_MIN * 60) === 0 && elapsed < totalSec) bell();
    if (elapsed >= totalSec) void stop(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const start = async (minutes: number) => {
    startedAtRef.current = new Date().toISOString();
    setElapsed(0);
    setTotalSec(minutes * 60);
    // Bells are scheduled up front — the phone can lock; they still ring.
    await scheduleBells(minutes).catch(() => {});
  };

  const stop = async (completed: boolean) => {
    const startedAt = startedAtRef.current;
    const seconds = elapsed;
    setTotalSec(null);
    setElapsed(0);
    startedAtRef.current = null;
    await cancelBells();
    if (completed) bell();
    // Same floor as every practice timer: under 30 s is a false start.
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
      <ReceiptHeader label="Meditation timer" summary={totalSec !== null ? 'running' : undefined} />
      {totalSec !== null ? (
        <>
          <Text style={[styles.clock, { color: theme.text.ink }]}>{mmss(Math.max(0, totalSec - elapsed))}</Text>
          <Text style={[styles.meta, { color: theme.text.mute }]}>
            Bells are scheduled — the screen can lock and they still ring.
          </Text>
          <Pressable onPress={() => void stop(false)} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.btn, { color: theme.text.faint }]}>END SIT — MINUTES STILL COUNT PAST 30 S</Text>
          </Pressable>
        </>
      ) : (
        DURATIONS_MIN.map((m, i) => (
          <Pressable key={m} onPress={() => void start(m)} hitSlop={8}>
            <ReceiptRow
              name={`${m} minutes`}
              meta={m === 5 ? 'one bell at the end' : 'a bell every five minutes'}
              value="start →"
              valueColor={theme.text.faint}
              last={i === DURATIONS_MIN.length - 1}
            />
          </Pressable>
        ))
      )}
      <SrcNote>Minutes land in your ledger as mindfulness sessions — no streaks, no scores, nothing else · bells ride scheduled notifications, so a locked phone finishes the sit</SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  clock: { fontFamily: mono, fontSize: 40, textAlign: 'center', marginVertical: 10 },
  meta: { fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  btn: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, textAlign: 'center', paddingVertical: 12 },
});
