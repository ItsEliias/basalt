import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import notifee, { AndroidImportance, AndroidForegroundServiceType } from '@notifee/react-native';
import { createAudioPlayer } from 'expo-audio';
import { Card, ReceiptHeader, ReceiptRow, SrcNote, mono, mmss, useTheme, ScaledText as Text } from '@basalt/ui';
import { acquireForegroundService, releaseForegroundService } from '../../lib/foregroundServiceCoordinator';
import { writeThroughOutbox } from '../../lib/outbox';
import { supabase } from '../../lib/supabase';

// Meditation timer (meditation Extra) — a quiet countdown with an interval
// bell every five minutes, held alive by a foreground service so a locked
// phone finishes the sit. Minutes land in the ledger as mindfulness
// sessions; that is the entire feature.

const CHANNEL_ID = 'basalt.meditation';
const NOTIF_ID = 'basalt.meditation.running';
const DURATIONS_MIN = [5, 10, 20] as const;
const BELL_EVERY_SEC = 300;

function bell(): void {
  try {
    const player = createAudioPlayer(require('../../../assets/sounds/tick.wav'));
    player.volume = 0.5;
    player.play();
    setTimeout(() => { try { player.release(); } catch { /* released */ } }, 1500);
  } catch { /* a missing bell is not an error */ }
}

export function MeditationCard() {
  const { theme } = useTheme();
  const [totalSec, setTotalSec] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (totalSec === null) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [totalSec]);

  useEffect(() => {
    if (totalSec === null) return;
    if (elapsed > 0 && elapsed % BELL_EVERY_SEC === 0 && elapsed < totalSec) bell();
    if (elapsed >= totalSec) void stop(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const start = async (minutes: number) => {
    startedAtRef.current = new Date().toISOString();
    setElapsed(0);
    setTotalSec(minutes * 60);
    try {
      await notifee.createChannel({ id: CHANNEL_ID, name: 'Meditation timer', importance: AndroidImportance.LOW });
      await notifee.requestPermission();
      acquireForegroundService();
      await notifee.displayNotification({
        id: NOTIF_ID,
        title: 'Basalt — meditation running',
        body: `${minutes} minutes · a soft bell every five`,
        android: {
          channelId: CHANNEL_ID,
          asForegroundService: true,
          foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_HEALTH],
          ongoing: true,
          onlyAlertOnce: true,
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
        },
      });
    } catch { /* the in-app timer still runs without the notification */ }
  };

  const stop = async (completed: boolean) => {
    const startedAt = startedAtRef.current;
    const seconds = elapsed;
    setTotalSec(null);
    setElapsed(0);
    startedAtRef.current = null;
    try {
      await notifee.cancelNotification(NOTIF_ID);
      await releaseForegroundService();
    } catch { /* already gone */ }
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
          <Text style={[styles.clock, { color: theme.text.ink }]}>{mmss(totalSec - elapsed)}</Text>
          <Text style={[styles.meta, { color: theme.text.mute }]}>A soft bell every five minutes. The screen can lock.</Text>
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
      <SrcNote>Minutes land in your ledger as mindfulness sessions — no streaks, no scores, nothing else · runs as a foreground service so a locked phone finishes the sit</SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  clock: { fontFamily: mono, fontSize: 40, textAlign: 'center', marginVertical: 10 },
  meta: { fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  btn: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, textAlign: 'center', paddingVertical: 12 },
});
