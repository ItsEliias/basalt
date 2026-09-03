import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CTA, mono, mmss, paceText, groupInt, useTheme, ScaledText as Text, ObInput } from '@basalt/ui';
import {
  acceptFix, routeDistanceM, summarizeWalk, computeSplits, saveWalk, listRecentWalks,
  type GpsFix, type Split, type WalkRow,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { WalkMap } from './WalkMap';
import { fetchWeatherLine, WEATHER_ATTRIBUTION } from '../../lib/weather';
import { cacheRouteTiles, getRouteCacheInfo, deleteRoutePack, offlineTilesAvailable, type RouteCacheInfo } from '../../lib/tileCache';
import { tileCachePolicyNote, mbText } from '@basalt/training';
import { WALK_TILES } from '../../lib/tileCache';
import { ShareSheet, WalkShareCard } from '../../components/ShareCards';
import * as Speech from 'expo-speech';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  usualLoop, INTERVAL_WALKS, phaseAt, walkTotalSeconds, WALK_DONE_CUE,
  listShoesWithKm, addShoe, setShoeThreshold, retireShoe, shoeStatusLine, SHOE_GUIDANCE,
  distanceToRouteM, stepDeviation, DEVIATION_ALERT_M,
  type RouteCluster, type IntervalWalk, type ShoeWithKm, type DeviationState,
} from '@basalt/training';
import * as Haptics from 'expo-haptics';
import { startWalkTracking, updateWalkTracking, stopWalkTracking, walkTrackingServiceFailed, WALK_STOP_ACTION_ID } from '../../lib/walkTrackingService';
import notifee, { EventType } from '@notifee/react-native';

// Outdoor — the GPS walk recorder, ported state machine and filters, with
// the pieces the audit found missing built for real: Douglas-Peucker before
// save, per-km splits, elevation gain, and the map tile on summaries
// (dark OSM-data raster, single accent route, per the prototype).

type Mode =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'services_off' }
  | { kind: 'denied'; message: string }
  | { kind: 'ready'; last: GpsFix }
  | { kind: 'tracking'; started: number; points: GpsFix[]; last: GpsFix }
  | { kind: 'saving' }
  | { kind: 'summary'; distanceM: number; durationS: number; avgPace: number | null; elevation: number | null; splits: Split[]; route: { lat: number; lng: number; t: number }[]; saved: boolean }
  | { kind: 'error'; message: string };

export function OutdoorTab() {
  const { theme } = useTheme();
  const bumpToday = useAppStore((s) => s.bumpToday);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [now, setNow] = useState(Date.now());
  const [recent, setRecent] = useState<WalkRow[]>([]);
  const [openWalkId, setOpenWalkId] = useState<string | null>(null);
  const [shareWalk, setShareWalk] = useState<WalkRow | null>(null);
  const [loop, setLoop] = useState<{ points: { lat: number; lng: number }[]; lengthM: number; requestedM: number; note: string } | null>(null);
  const [loopBusy, setLoopBusy] = useState(false);
  const [loopError, setLoopError] = useState<string | null>(null);
  const [voiceSplits, setVoiceSplits] = useState(false);
  const [glance, setGlance] = useState(false);
  const [routeNudge, setRouteNudge] = useState(false);
  const deviationRef = useRef<DeviationState>({ off: false });
  const lastAnnouncedKm = useRef(0);
  const [guided, setGuided] = useState<IntervalWalk | null>(null);
  const [shoes, setShoes] = useState<ShoeWithKm[]>([]);
  const [activeShoeId, setActiveShoeId] = useState<string | null>(null);
  const [newShoe, setNewShoe] = useState('');
  const [weather, setWeather] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<Map<string, RouteCacheInfo>>(new Map());
  const guidedLastIndex = useRef(-1);
  const guidedDone = useRef(false);
  const [beacon, setBeacon] = useState<{ id: string; expiresAt: string } | null>(null);
  const beaconLastPush = useRef(0);
  const notifLastUpdate = useRef(0);

  const startBeacon = async () => {
    const { data, error } = await supabase.functions.invoke('beacon', { body: { action: 'start' } });
    if (error || !data?.id) return;
    setBeacon({ id: data.id, expiresAt: data.expiresAt });
    void Share.share({
      message: `I'm sharing my live position for this walk (expires automatically): https://basalt.itseliias.com/beacon/#${data.id}`,
    });
  };

  const stopBeacon = async () => {
    if (!beacon) return;
    await supabase.functions.invoke('beacon', { body: { action: 'stop', id: beacon.id } });
    setBeacon(null);
  };

  // Push the latest accepted fix at most every 20s while a beacon runs.
  useEffect(() => {
    if (!beacon || mode.kind !== 'tracking') return;
    if (Date.parse(beacon.expiresAt) < Date.now()) {
      setBeacon(null);
      return;
    }
    const nowMs = Date.now();
    if (nowMs - beaconLastPush.current < 20_000) return;
    beaconLastPush.current = nowMs;
    const last = mode.last;
    void supabase.functions.invoke('beacon', {
      body: { action: 'update', id: beacon.id, lat: last.lat, lng: last.lng, accuracyM: last.accuracy },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beacon, mode]);
  const usual: RouteCluster | null = usualLoop(
    recent.map((w) => ({ id: w.id, route: w.route, durationS: w.durationS })),
  );

  useEffect(() => {
    void AsyncStorage.getItem('basalt.voiceSplits').then((v) => setVoiceSplits(v === 'on'));
    void AsyncStorage.getItem('basalt.walkGlance').then((v) => setGlance(v === 'on'));
  }, []);

  const generateLoop = async (km: number) => {
    setLoopBusy(true);
    setLoopError(null);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { data, error } = await supabase.functions.invoke('route-loop', {
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude, km },
      });
      if (error) {
        let message = error.message ?? 'Could not generate a loop.';
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          }
        } catch { /* keep generic */ }
        setLoopError(message);
      } else {
        setLoop(data);
      }
    } catch (e: any) {
      setLoopError(e?.message ?? 'Location unavailable.');
    }
    setLoopBusy(false);
  };
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRecent = useCallback(() => {
    void listRecentWalks(supabase, 8).then((r) => {
      if (!r.ok) return;
      setRecent(r.data);
      for (const w of r.data) {
        void getRouteCacheInfo(w.id).then((info) =>
          setCacheInfo((m) => new Map(m).set(w.id, info)),
        );
      }
    });
  }, []);
  useEffect(() => loadRecent(), [loadRecent]);

  const loadShoes = useCallback(() => {
    void listShoesWithKm(supabase).then((r) => r.ok && setShoes(r.data));
    void AsyncStorage.getItem('basalt.activeShoe').then((v) => setActiveShoeId(v || null));
  }, []);
  useEffect(() => loadShoes(), [loadShoes]);

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
      void fetchWeatherLine(pos.coords.latitude, pos.coords.longitude).then(setWeather);
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
            const next = !acceptFix(lastKept, p) ? { ...m, last: p } : { ...m, last: p, points: [...m.points, p] };
            // Keep the ongoing notification's body current — throttled to
            // once every 30s, matching timerService's own "no spam" rule;
            // this is what actually keeps the walk logging with the screen
            // locked, so it's worth a little live-ness, just not per-fix.
            const nowMs = Date.now();
            if (nowMs - notifLastUpdate.current >= 30_000) {
              notifLastUpdate.current = nowMs;
              const distM = routeDistanceM(next.points);
              const secs = Math.max(1, Math.round((nowMs - next.started) / 1000));
              void updateWalkTracking(
                `${distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(2)} km`} · ${mmss(secs)}`,
              );
            }
            return next;
          });
        },
      );
      tickerRef.current = setInterval(() => setNow(Date.now()), 500);
      lastAnnouncedKm.current = 0;
      notifLastUpdate.current = 0;
      void startWalkTracking('0 m · 0:00');
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
    void stopBeacon();
    void stopWalkTracking();
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
      shoeId: activeShoeId,
    });
    loadShoes();
    // Offline corridor tiles — cached on save when the provider allows it
    // (Stadia key configured); the dev tiles refuse and the srcnote says so.
    if (saved.ok && offlineTilesAvailable()) {
      void cacheRouteTiles(saved.data.id, s.simplified).then((info) =>
        setCacheInfo((m) => new Map(m).set(saved.data.id, info)),
      );
    }

    setMode({
      kind: 'summary',
      distanceM: s.distanceM,
      durationS: s.durationS,
      avgPace: s.avgPaceSecPerKm,
      elevation: s.elevationGainM,
      splits: s.splits,
      route: s.simplified,
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
      void stopWalkTracking();
    },
    [],
  );

  const tracking = mode.kind === 'tracking';
  useEffect(() => {
    if (tracking) {
      guidedLastIndex.current = -1;
      guidedDone.current = false;
    }
  }, [tracking]);

  // Notification "Stop & save" (and its mirror on a paired watch) runs the
  // SAME stop path as the on-screen button — the app foregrounds first, so
  // nothing ever saves from a headless context.
  useEffect(() => {
    if (!tracking) return;
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === WALK_STOP_ACTION_ID) {
        void stop();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking]);
  const liveDistance = tracking ? routeDistanceM(mode.points) : 0;

  // Voice split announcements — OS text-to-speech, opt-in, on whole kms.
  useEffect(() => {
    if (!tracking || !voiceSplits) return;
    const km = Math.floor(liveDistance / 1000);
    if (km > lastAnnouncedKm.current && mode.kind === 'tracking') {
      lastAnnouncedKm.current = km;
      const seconds = Math.max(1, Math.round((Date.now() - mode.started) / 1000));
      const paceS = Math.round(seconds / (liveDistance / 1000));
      Speech.speak(`${km} kilometre${km === 1 ? '' : 's'}. Average pace ${Math.floor(paceS / 60)} ${paceS % 60} per kilometre.`);
    }
  }, [tracking, voiceSplits, liveDistance, mode]);
  const liveSeconds = tracking ? Math.max(1, Math.round((now - mode.started) / 1000)) : 0;
  const livePace = tracking && liveDistance > 50 ? liveSeconds / (liveDistance / 1000) : null;

  // Guided interval script — haptics are the PRIMARY signal (pocket, no
  // earbuds), speech the detail layer. Phase changes fire once each.
  const guidedPos = tracking && guided ? phaseAt(guided, liveSeconds) : null;
  useEffect(() => {
    if (!tracking || !guided) return;
    if (guidedPos === null) {
      if (!guidedDone.current) {
        guidedDone.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Speech.speak(WALK_DONE_CUE);
      }
      return;
    }
    if (guidedPos.index !== guidedLastIndex.current) {
      guidedLastIndex.current = guidedPos.index;
      const up = guidedPos.phase.effort === 'brisk';
      void (up
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            .then(() => new Promise((r) => setTimeout(r, 250)))
            .then(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      ).catch(() => {});
      Speech.speak(guidedPos.phase.cue);
    }
  }, [tracking, guided, guidedPos]);

  // Haptic route nudge — off by default, only meaningful with a generated
  // loop on screen. One buzz per excursion (published 50 m / 25 m
  // hysteresis in the engine); GPS keeps recording either way.
  useEffect(() => {
    if (!tracking || !routeNudge || !loop || mode.kind !== 'tracking') return;
    const d = distanceToRouteM({ lat: mode.last.lat, lng: mode.last.lng }, loop.points);
    if (stepDeviation(deviationRef.current, d)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking, routeNudge, loop, mode]);

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content}>
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
            <Pressable onPress={() => {
              const next = !voiceSplits;
              setVoiceSplits(next);
              void AsyncStorage.setItem('basalt.voiceSplits', next ? 'on' : 'off');
            }}>
              <Text style={[styles.shareLink, { color: theme.text.faint }]}>{voiceSplits ? 'VOICE SPLITS ON — EVERY KM · TAP TO TURN OFF' : 'VOICE SPLITS OFF · TAP TO ANNOUNCE EVERY KM'}</Text>
            </Pressable>
            {/* Guided interval scripts — a fixed set, not a library */}
            <View style={styles.loopRow}>
              <Text style={[styles.loopLabel, { color: theme.text.faint }]}>GUIDED…</Text>
              {INTERVAL_WALKS.map((w) => (
                <Pressable key={w.key} onPress={() => { setGuided(guided?.key === w.key ? null : w); }}>
                  <Text style={[styles.loopChip, { color: theme.text.ink2, borderColor: theme.surfaces.borderStrong }, guided?.key === w.key && [styles.loopChipOn, { color: theme.text.ink, borderBottomColor: theme.text.ink }]]}>
                    {w.name.replace(' · ', ' ').toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            {guided ? (
              <SrcNote>{`${guided.structure} — cues by vibration first, then voice · talk-test effort, never pace targets · deselect to walk unscripted`}</SrcNote>
            ) : null}
            {shoes.length > 0 ? (
              <View style={styles.loopRow}>
                <Text style={[styles.loopLabel, { color: theme.text.faint }]}>SHOE…</Text>
                {shoes.map((sh) => (
                  <Pressable
                    key={sh.id}
                    onPress={() => {
                      const next = activeShoeId === sh.id ? null : sh.id;
                      setActiveShoeId(next);
                      void AsyncStorage.setItem('basalt.activeShoe', next ?? '');
                    }}
                  >
                    <Text style={[styles.loopChip, { color: theme.text.ink2, borderColor: theme.surfaces.borderStrong }, activeShoeId === sh.id && [styles.loopChipOn, { color: theme.text.ink, borderBottomColor: theme.text.ink }]]}>{sh.name.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.loopRow}>
              <Text style={[styles.loopLabel, { color: theme.text.faint }]}>LOOP OF…</Text>
              {[2, 3, 5, 8].map((km) => (
                <Pressable key={km} disabled={loopBusy} onPress={() => void generateLoop(km)}>
                  <Text style={[styles.loopChip, { color: theme.text.ink2, borderColor: theme.surfaces.borderStrong }]}>{loopBusy ? '…' : `${km} KM`}</Text>
                </Pressable>
              ))}
            </View>
            {loopError ? <SrcNote>{loopError}</SrcNote> : null}
            {loop ? (
              <>
                <WalkMap route={loop.points.map((p, i) => ({ ...p, t: i }))} height={190} />
                <Text style={[styles.loopMeta, { color: theme.text.ink }]}>
                  {`${(loop.lengthM / 1000).toFixed(2)} km loop — you asked for ${(loop.requestedM / 1000).toFixed(0)} km`}
                </Text>
                <SrcNote>{loop.note}</SrcNote>
                <Pressable
                  onPress={() => {
                    deviationRef.current = { off: false };
                    setRouteNudge(!routeNudge);
                  }}
                >
                  <Text style={[styles.shareLink, { color: theme.text.faint }]}>
                    {routeNudge
                      ? `ROUTE NUDGE ON — ONE BUZZ WHEN >${DEVIATION_ALERT_M} M OFF THIS LOOP · TAP TO TURN OFF`
                      : `ROUTE NUDGE OFF · TAP TO BUZZ WHEN >${DEVIATION_ALERT_M} M OFF THIS LOOP`}
                  </Text>
                </Pressable>
                <Pressable onPress={() => { setLoop(null); setRouteNudge(false); }}>
                  <Text style={[styles.shareLink, { color: theme.text.faint }]}>DISMISS</Text>
                </Pressable>
              </>
            ) : null}
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
            {weather ? (
              <>
                <Text style={[styles.weatherLine, { color: theme.text.ink2 }]}>{weather}</Text>
                <SrcNote>{WEATHER_ATTRIBUTION}</SrcNote>
              </>
            ) : null}
            <CTA label="Start walk" onPress={() => void start()} />
          </>
        ) : null}

        {mode.kind === 'tracking' ? (
          <>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: theme.fill.carbs }]} />
              <Text style={[styles.liveText, { color: theme.text.carbs }]}>RECORDING · GPS ±{Math.round(mode.last.accuracy)} M</Text>
            </View>
            {glance ? (
              // Glance mode — the FIXED stat set (distance, time, pace) in
              // large type, readable at arm's length mid-walk. No config.
              <View style={styles.glanceBlock}>
                <Text style={[styles.glanceValue, { color: theme.text.ink }]}>
                  {liveDistance < 1000 ? `${Math.round(liveDistance)} m` : `${(liveDistance / 1000).toFixed(2)} km`}
                </Text>
                <Text style={[styles.glanceValue, { color: theme.text.ink }]}>{mmss(liveSeconds)}</Text>
                <Text style={[styles.glanceValue, { color: theme.text.ink }]}>{livePace ? `${paceText(livePace)} /km` : '— /km'}</Text>
              </View>
            ) : (
              <View style={styles.statRow}>
                <Stat k="Distance" v={liveDistance < 1000 ? `${Math.round(liveDistance)}` : (liveDistance / 1000).toFixed(2)} u={liveDistance < 1000 ? 'm' : 'km'} />
                <Stat k="Time" v={mmss(liveSeconds)} />
                <Stat k="Pace" v={livePace ? paceText(livePace) : '—'} u={livePace ? '/km' : undefined} />
                <Stat k="Points" v={String(mode.points.length)} />
              </View>
            )}
            <Pressable
              onPress={() => {
                const next = !glance;
                setGlance(next);
                void AsyncStorage.setItem('basalt.walkGlance', next ? 'on' : 'off');
              }}
              hitSlop={8}
            >
              <Text style={[styles.shareLink, { color: theme.text.faint }]}>{glance ? 'GLANCE TYPE ON · TAP FOR DETAIL' : 'LARGE GLANCE TYPE · TAP TO ENLARGE'}</Text>
            </Pressable>
            {guided ? (
              guidedPos ? (
                <View style={[styles.guidedRow, { borderTopColor: theme.surfaces.border }]}>
                  <Text style={[styles.guidedEffort, { color: theme.text.ink }]}>{guidedPos.phase.effort.toUpperCase()}</Text>
                  <Text style={[styles.guidedRemain, { color: theme.text.mute }]}>{mmss(guidedPos.phaseRemainS)} LEFT · {mmss(Math.max(0, walkTotalSeconds(guided) - liveSeconds))} IN SCRIPT</Text>
                </View>
              ) : (
                <Text style={[styles.shareLink, { color: theme.text.faint }]}>SCRIPT FINISHED — RECORDING CONTINUES UNTIL YOU STOP</Text>
              )
            ) : null}
            {beacon ? (
              <Pressable onPress={() => void stopBeacon()}>
                <View style={[styles.beaconRow, { borderColor: theme.fill.recovery }]}>
                  <View style={[styles.beaconDot, { backgroundColor: theme.fill.recovery }]} />
                  <Text style={[styles.beaconText, { color: theme.text.recovery }]}>
                    {`LIVE BEACON ACTIVE — ANYONE WITH THE LINK SEES YOUR POSITION · EXPIRES ${new Date(beacon.expiresAt).toTimeString().slice(0, 5)} · TAP TO STOP`}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Pressable onPress={() => void startBeacon()}>
                <Text style={[styles.shareLink, { color: theme.text.faint }]}>SHARE A LIVE BEACON → EXPLICIT START, EXPLICIT STOP, 2 H MAX</Text>
              </Pressable>
            )}
            <CTA label="Stop & save" onPress={() => void stop()} />
            <SrcNote>
              {Platform.OS === 'android' && !walkTrackingServiceFailed()
                ? 'Keeps recording if your phone locks or you switch apps · leaving this tab still stops it'
                : 'Keeps recording while this screen is open · screen stays awake'}
            </SrcNote>
          </>
        ) : null}

        {mode.kind === 'saving' ? <EmptyState>Saving…</EmptyState> : null}

        {mode.kind === 'summary' ? (
          <>
            <ReceiptHeader label="Walk saved" summary={mode.saved ? undefined : 'SAVE FAILED — shown locally only'} />
            <WalkMap route={mode.route} />
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

      {/* ── Shoes — mileage attribution, your threshold, no nagging ── */}
      <Card>
        <ReceiptHeader label="Shoes" summary={shoes.length > 0 ? 'walks wear down the picked shoe' : undefined} />
        {shoes.map((sh, i) => (
          <Pressable
            key={sh.id}
            onPress={() => {
              const t = sh.thresholdKm === null ? 500 : sh.thresholdKm >= 800 ? null : sh.thresholdKm + 100;
              void setShoeThreshold(supabase, sh.id, t).then(loadShoes);
            }}
            onLongPress={() => void retireShoe(supabase, sh.id).then(loadShoes)}
            hitSlop={8}
          >
            <ReceiptRow
              name={sh.name}
              meta={`${shoeStatusLine(sh.km, sh.thresholdKm)} · tap cycles threshold (500–800 or none) · hold to retire`}
              value={String(Math.round(sh.km))}
              unit="km"
              last={i === shoes.length - 1}
            />
          </Pressable>
        ))}
        {shoes.length === 0 ? (
          <EmptyState>Name a shoe and pick it before a walk — its lifetime distance accumulates here.</EmptyState>
        ) : null}
        <View style={styles.shoeAddRow}>
          <ObInput placeholder="Add a shoe — e.g. Pegasus 41" value={newShoe} onChangeText={setNewShoe} style={{ flex: 1 }} />
          <Pressable
            onPress={() => void addShoe(supabase, newShoe).then(() => { setNewShoe(''); loadShoes(); })}
            hitSlop={10}
            disabled={!newShoe.trim()}
          >
            <Text style={[styles.shareLink, { color: theme.text.faint }]}>ADD</Text>
          </Pressable>
        </View>
        <SrcNote>{SHOE_GUIDANCE}</SrcNote>
      </Card>

      {/* ── Recent walks ───────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Recent walks" />
        {recent.length > 0 ? (
          recent.map((w, i) => (
            <View key={w.id}>
              <Pressable
                onPress={() => setOpenWalkId((cur) => (cur === w.id ? null : w.id))}
                disabled={!w.route || w.route.length < 2}
              >
                <ReceiptRow
                  name={`${(w.distanceM / 1000).toFixed(2)} km walk`}
                  meta={[
                    new Date(w.startedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
                    w.avgPaceSecPerKm ? `${paceText(w.avgPaceSecPerKm)} /km` : null,
                    w.elevationGainM !== null ? `+${w.elevationGainM} m` : null,
                    usual?.walkIds.includes(w.id) ? `your usual loop · median ${mmss(usual.medianDurationS)} · ${usual.walkIds.length} walks` : null,
                    w.route && w.route.length >= 2 ? (openWalkId === w.id ? 'hide map' : 'map') : null,
                  ].filter(Boolean).join(' · ')}
                  value={mmss(w.durationS)}
                  unit="duration"
                  last={i === recent.length - 1}
                />
              </Pressable>
              {openWalkId === w.id && w.route ? (
                <>
                  <WalkMap route={w.route} height={170} />
                  {(() => {
                    const info = cacheInfo.get(w.id) ?? { state: 'none' as const };
                    if (!offlineTilesAvailable()) {
                      return <SrcNote>{tileCachePolicyNote(WALK_TILES.url)}</SrcNote>;
                    }
                    if (info.state === 'cached') {
                      return (
                        <Pressable onPress={() => void deleteRoutePack(w.id).then(loadRecent)} hitSlop={8}>
                          <SrcNote>{`Offline tiles cached for this route · ${mbText(info.bytes)} · tap to remove`}</SrcNote>
                        </Pressable>
                      );
                    }
                    if (info.state === 'downloading') return <SrcNote>Caching offline tiles for this route…</SrcNote>;
                    if (info.state === 'refused') return <SrcNote>{`Offline tiles not cached — ${info.reason}`}</SrcNote>;
                    return (
                      <Pressable
                        onPress={() => {
                          setCacheInfo((m) => new Map(m).set(w.id, { state: 'downloading' }));
                          void cacheRouteTiles(w.id, w.route!).then((res) =>
                            setCacheInfo((m) => new Map(m).set(w.id, res)),
                          );
                        }}
                        hitSlop={8}
                      >
                        <SrcNote>{`No offline tiles for this route · tap to cache (≤40 MB, zooms 13–15) · ${tileCachePolicyNote(WALK_TILES.url)}`}</SrcNote>
                      </Pressable>
                    );
                  })()}
                  <Pressable onPress={() => setShareWalk(w)}>
                    <Text style={[styles.shareLink, { color: theme.text.faint }]}>SHARE AS IMAGE →</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyState>No walks recorded yet. The first one starts the ledger.</EmptyState>
        )}
      </Card>
      {shareWalk ? (
        <ShareSheet open onClose={() => setShareWalk(null)} filename="basalt-walk.png">
          <WalkShareCard walk={shareWalk} />
        </ShareSheet>
      ) : null}
    </ScrollView>
  );
}

function Stat({ k, v, u }: { k: string; v: string; u?: string }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[styles.statK, { color: theme.text.faint }]}>{k.toUpperCase()}</Text>
      <Text style={[styles.statV, { color: theme.text.ink }]}>
        {v}
        {u ? <Text style={[styles.statU, { color: theme.text.mute }]}> {u}</Text> : null}
      </Text>
    </View>
  );
}

function SplitsBlock({ splits }: { splits: Split[] }) {
  const { theme } = useTheme();
  const fastest = Math.min(...splits.map((s) => s.paceSecPerKm));
  return (
    <View style={{ marginTop: 14 }}>
      <ReceiptHeader label="Splits" summary="longer bar = faster" />
      {splits.map((s) => (
        <View key={s.km} style={[styles.split, { borderBottomColor: theme.surfaces.border }]}>
          <Text style={[styles.splitKm, { color: theme.text.faint }]}>{s.distanceM < 1000 ? `.${Math.round(s.distanceM / 10) / 100}`.replace('0.', '.') : s.km}</Text>
          <View style={[styles.splitBar, { backgroundColor: theme.surfaces.border }]}>
            <View style={[styles.splitFill, { backgroundColor: theme.fill.carbs }, { width: `${Math.round((fastest / s.paceSecPerKm) * 100)}%` }]} />
          </View>
          <Text style={[styles.splitPace, { color: theme.text.ink }]}>{paceText(s.paceSecPerKm)}</Text>
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
  shareLink: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, textAlign: 'center', paddingVertical: 10 },
  loopChipOn: { borderBottomWidth: 1 },
  guidedRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  guidedEffort: { fontFamily: mono, fontSize: 13, letterSpacing: 1.2, fontWeight: '600' },
  guidedRemain: { fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  shoeAddRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glanceBlock: { paddingVertical: 10, gap: 6 },
  glanceValue: { fontFamily: mono, fontSize: 40, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  weatherLine: { fontFamily: mono, fontSize: 12, letterSpacing: 0.6, paddingVertical: 6 },
  loopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  loopLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9 },
  loopChip: {
    fontFamily: mono, fontSize: 11, letterSpacing: 0.7,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden',
  },
  loopMeta: { fontFamily: mono, fontSize: 11, marginTop: 8, fontVariant: ['tabular-nums'] },
  beaconRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  beaconDot: { width: 6, height: 6, borderRadius: 3 },
  beaconText: { fontFamily: mono, fontSize: 11, letterSpacing: 0.6, flexShrink: 1, lineHeight: 12 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: mono, fontSize: 11, letterSpacing: 1.26 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  statK: { fontFamily: mono, fontSize: 11, letterSpacing: 1.08 },
  statV: { fontFamily: mono, fontSize: 17, fontWeight: '500', marginTop: 5, fontVariant: ['tabular-nums'] },
  statU: { fontSize: 11 },
  split: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  splitKm: { fontFamily: mono, fontSize: 11, width: 26 },
  splitBar: { flex: 1, height: 4, borderRadius: 2 },
  splitFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  splitPace: { fontFamily: mono, fontSize: 12, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
