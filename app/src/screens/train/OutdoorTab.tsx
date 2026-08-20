import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CTA,
  color, mono, mmss, paceText, groupInt,
} from '@basalt/ui';
import {
  acceptFix, routeDistanceM, summarizeWalk, computeSplits, saveWalk, listRecentWalks,
  type GpsFix, type Split, type WalkRow,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';

// Outdoor — the GPS walk recorder, ported state machine and filters, with
// the pieces the audit found missing built for real: Douglas-Peucker before
// save, per-km splits, elevation gain. No map tile yet (honest absence —
// the stats ARE the recording); the map card lands with a tile dependency.

type Mode =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'services_off' }
  | { kind: 'denied'; message: string }
  | { kind: 'ready'; last: GpsFix }
  | { kind: 'tracking'; started: number; points: GpsFix[]; last: GpsFix }
  | { kind: 'saving' }
  | { kind: 'summary'; distanceM: number; durationS: number; avgPace: number | null; elevation: number | null; splits: Split[]; saved: boolean }
  | { kind: 'error'; message: string };

export function OutdoorTab() {
  const bumpToday = useAppStore((s) => s.bumpToday);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [now, setNow] = useState(Date.now());
  const [recent, setRecent] = useState<WalkRow[]>([]);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRecent = useCallback(() => {
    void listRecentWalks(supabase, 8).then((r) => r.ok && setRecent(r.data));
  }, []);
  useEffect(() => loadRecent(), [loadRecent]);

  const boot = useCallback(async () => {
    setMode({ kind: 'checking' });
    try {
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        setMode({ kind: 'services_off' });
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setMode({
          kind: 'denied',
          message: perm.canAskAgain
            ? 'Location permission denied. Grant it to record a walk.'
            : 'Location is turned off for Basalt in system settings.',
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      setMode({
        kind: 'ready',
        last: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          time: pos.timestamp,
          accuracy: pos.coords.accuracy ?? 0,
          altitude: pos.coords.altitude,
        },
      });
    } catch (e: any) {
      setMode({ kind: 'error', message: e?.message ?? 'Location error.' });
    }
  }, []);

  const start = useCallback(async () => {
    if (mode.kind !== 'ready') return;
    try {
      const started = Date.now();
      setMode({ kind: 'tracking', started, points: [mode.last], last: mode.last });

      watcherRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (pos) => {
          const p: GpsFix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            time: pos.timestamp,
            accuracy: pos.coords.accuracy ?? 0,
            altitude: pos.coords.altitude,
          };
          setMode((m) => {
            if (m.kind !== 'tracking') return m;
            const lastKept = m.points[m.points.length - 1] ?? null;
            if (!acceptFix(lastKept, p)) return { ...m, last: p };
            return { ...m, last: p, points: [...m.points, p] };
          });
        },
      );
      tickerRef.current = setInterval(() => setNow(Date.now()), 500);
    } catch (e: any) {
      setMode({ kind: 'error', message: e?.message ?? 'Could not start tracking.' });
    }
  }, [mode]);

  const stop = useCallback(async () => {
    if (mode.kind !== 'tracking') return;
    watcherRef.current?.remove();
    watcherRef.current = null;
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    const ended = Date.now();
    const { points, started } = mode;
    setMode({ kind: 'saving' });

    const s = summarizeWalk(points, started, ended);
    const saved = await saveWalk(supabase, {
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      distanceM: s.distanceM,
      durationS: s.durationS,
      elevationGainM: s.elevationGainM,
      avgPaceSecPerKm: s.avgPaceSecPerKm,
      route: s.simplified,
    });

    setMode({
      kind: 'summary',
      distanceM: s.distanceM,
      durationS: s.durationS,
      avgPace: s.avgPaceSecPerKm,
      elevation: s.elevationGainM,
      splits: s.splits,
      saved: saved.ok,
    });
    if (saved.ok) {
      bumpToday();
      loadRecent();
    }
  }, [mode, bumpToday, loadRecent]);

  useEffect(
    () => () => {
      watcherRef.current?.remove();
      if (tickerRef.current) clearInterval(tickerRef.current);
    },
    [],
  );

  const tracking = mode.kind === 'tracking';
  const liveDistance = tracking ? routeDistanceM(mode.points) : 0;
  const liveSeconds = tracking ? Math.max(1, Math.round((now - mode.started) / 1000)) : 0;
  const livePace = tracking && liveDistance > 50 ? liveSeconds / (liveDistance / 1000) : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {tracking ? <KeepAwakeWhileTracking /> : null}

      {/* ── Recorder ───────────────────────────────────────────────── */}
      <Card>
        {mode.kind === 'idle' ? (
          <>
            <ReceiptHeader label="Record a walk" />
            <EmptyState>
              GPS recording with honest filters: fixes worse than 30 m are rejected, standing-still
              jitter doesn't inflate distance, and the route is simplified before it's stored.
            </EmptyState>
            <CTA label="Check GPS" onPress={() => void boot()} />
          </>
        ) : null}

        {mode.kind === 'checking' ? <EmptyState>Checking location services…</EmptyState> : null}

        {mode.kind === 'services_off' ? (
          <>
            <EmptyState>Location services are off. Turn them on to record a walk.</EmptyState>
            <CTA label="Try again" onPress={() => void boot()} />
          </>
        ) : null}

        {mode.kind === 'denied' ? (
          <>
            <EmptyState>{mode.message}</EmptyState>
            <CTA label="Open settings" onPress={() => void Linking.openSettings().catch(() => {})} />
          </>
        ) : null}

        {mode.kind === 'ready' ? (
          <>
            <ReceiptHeader label="Ready" summary={`GPS ±${Math.round(mode.last.accuracy)} m`} />
            <CTA label="Start walk" onPress={() => void start()} />
          </>
        ) : null}

        {mode.kind === 'tracking' ? (
          <>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>RECORDING · GPS ±{Math.round(mode.last.accuracy)} M</Text>
            </View>
            <View style={styles.statRow}>
              <Stat k="Distance" v={liveDistance < 1000 ? `${Math.round(liveDistance)}` : (liveDistance / 1000).toFixed(2)} u={liveDistance < 1000 ? 'm' : 'km'} />
              <Stat k="Time" v={mmss(liveSeconds)} />
              <Stat k="Pace" v={livePace ? paceText(livePace) : '—'} u={livePace ? '/km' : undefined} />
              <Stat k="Points" v={String(mode.points.length)} />
            </View>
            <CTA label="Stop & save" onPress={() => void stop()} />
            <SrcNote>Keeps recording while this screen is open · screen stays awake</SrcNote>
          </>
        ) : null}

        {mode.kind === 'saving' ? <EmptyState>Saving…</EmptyState> : null}

        {mode.kind === 'summary' ? (
          <>
            <ReceiptHeader label="Walk saved" summary={mode.saved ? undefined : 'SAVE FAILED — shown locally only'} />
            <View style={styles.statRow}>
              <Stat k="Distance" v={(mode.distanceM / 1000).toFixed(2)} u="km" />
              <Stat k="Time" v={mmss(mode.durationS)} />
              <Stat k="Pace" v={mode.avgPace ? paceText(mode.avgPace) : '—'} u={mode.avgPace ? '/km' : undefined} />
              <Stat k="Elev" v={mode.elevation !== null ? `+${mode.elevation}` : '—'} u={mode.elevation !== null ? 'm' : undefined} />
            </View>
            {mode.splits.length > 0 ? <SplitsBlock splits={mode.splits} /> : null}
            <CTA label="Done" onPress={() => setMode({ kind: 'idle' })} />
            <SrcNote>Route simplified (Douglas-Peucker) before storing · elevation only when the GPS supplied altitude</SrcNote>
          </>
        ) : null}

        {mode.kind === 'error' ? (
          <>
            <EmptyState>{mode.message}</EmptyState>
            <CTA label="Try again" onPress={() => void boot()} />
          </>
        ) : null}
      </Card>

      {/* ── Recent walks ───────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Recent walks" />
        {recent.length > 0 ? (
          recent.map((w, i) => (
            <ReceiptRow
              key={w.id}
              name={`${(w.distanceM / 1000).toFixed(2)} km walk`}
              meta={[
                new Date(w.startedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
                w.avgPaceSecPerKm ? `${paceText(w.avgPaceSecPerKm)} /km` : null,
                w.elevationGainM !== null ? `+${w.elevationGainM} m` : null,
              ].filter(Boolean).join(' · ')}
              value={mmss(w.durationS)}
              unit="duration"
              last={i === recent.length - 1}
            />
          ))
        ) : (
          <EmptyState>No walks recorded yet. The first one starts the ledger.</EmptyState>
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ k, v, u }: { k: string; v: string; u?: string }) {
  return (
    <View>
      <Text style={styles.statK}>{k.toUpperCase()}</Text>
      <Text style={styles.statV}>
        {v}
        {u ? <Text style={styles.statU}> {u}</Text> : null}
      </Text>
    </View>
  );
}

function SplitsBlock({ splits }: { splits: Split[] }) {
  const fastest = Math.min(...splits.map((s) => s.paceSecPerKm));
  return (
    <View style={{ marginTop: 14 }}>
      <ReceiptHeader label="Splits" summary="longer bar = faster" />
      {splits.map((s) => (
        <View key={s.km} style={styles.split}>
          <Text style={styles.splitKm}>{s.distanceM < 1000 ? `.${Math.round(s.distanceM / 10) / 100}`.replace('0.', '.') : s.km}</Text>
          <View style={styles.splitBar}>
            <View style={[styles.splitFill, { width: `${Math.round((fastest / s.paceSecPerKm) * 100)}%` }]} />
          </View>
          <Text style={styles.splitPace}>{paceText(s.paceSecPerKm)}</Text>
        </View>
      ))}
    </View>
  );
}

function KeepAwakeWhileTracking() {
  useKeepAwake();
  return null;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.carbs },
  liveText: { fontFamily: mono, fontSize: 9, letterSpacing: 1.26, color: color.carbs },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  statK: { fontFamily: mono, fontSize: 9, letterSpacing: 1.08, color: color.faint },
  statV: { fontFamily: mono, fontSize: 17, fontWeight: '500', color: color.ink, marginTop: 5, fontVariant: ['tabular-nums'] },
  statU: { fontSize: 10, color: color.mute },
  split: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  splitKm: { fontFamily: mono, fontSize: 10, color: color.faint, width: 26 },
  splitBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.border },
  splitFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: color.carbs },
  splitPace: { fontFamily: mono, fontSize: 12, color: color.ink, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
