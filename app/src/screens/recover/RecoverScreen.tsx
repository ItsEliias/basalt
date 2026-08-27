import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, KV, HeroNumeral, SubNav,
  TileGrid, StatTile, EmptyTile, Sparkline, StageBar, StageKey, TimeScale, CTA, ChipRow,
  color, mono, kgText, hoursMinutes, groupInt,
  ChipGroup, useTheme,
} from '@basalt/ui';
import { healthService, labelForPackage, type SleepSessionSummary } from '@basalt/health-connect';
import { listWeightEntries, type WeightEntry } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { runHealthSync } from '../../lib/healthSync';
import { loadReadiness, saveCheckin, getCheckin, CHECKIN_FACTORS } from '@basalt/analytics';
import { ProgressPhotosCard } from './ProgressPhotos';
import {
  getActiveFast, startFast, endFast, listRecentFasts, stageFor, fastElapsed,
  FASTING_DISCLAIMER, type Fast,
} from '@basalt/nutrition';
import { isoDay } from '@basalt/core-data';
import { useAppStore } from '../../state/appStore';
import { PROTOCOLS, phaseAt, cycleSeconds, weeklyWeightRate, sparkPoints, type BreathProtocol } from './model';

// Recover — Vitals (real-or-hidden, sources named) and Mind (breathing
// pacer that logs real mindfulness sessions).

type Vitals = {
  sleep: SleepSessionSummary | null;
  hrv: number | null;
  rhr: number | null;
  spo2: number | null;
  granted: string[];
  available: boolean;
};

export function RecoverScreen() {
  const [sub, setSub] = useState('Vitals');
  return (
    <View style={{ flex: 1 }}>
      <SubNav items={['Vitals', 'Mind']} active={sub} onChange={setSub} />
      {sub === 'Vitals' ? <VitalsTab /> : <MindTab />}
    </View>
  );
}

function VitalsTab() {
  const { theme } = useTheme();
  const profile = useAppStore((s) => s.profile);
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof loadReadiness>> | null>(null);
  const [mathOpen, setMathOpen] = useState(false);
  const [checkinFactors, setCheckinFactors] = useState<string[]>([]);
  const [checkinMood, setCheckinMood] = useState<number | null>(null);
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [activeFast, setActiveFast] = useState<Fast | null>(null);
  const [recentFasts, setRecentFasts] = useState<Fast[]>([]);
  const [fastNow, setFastNow] = useState(Date.now());
  const fastingEnabled = profile?.fastingEnabled ?? false;

  useEffect(() => {
    if (!fastingEnabled) return;
    void getActiveFast(supabase).then((r) => r.ok && setActiveFast(r.data));
    void listRecentFasts(supabase).then((r) => r.ok && setRecentFasts(r.data));
    const iv = setInterval(() => setFastNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [fastingEnabled]);

  useEffect(() => {
    void (async () => {
      void runHealthSync();
      const w = await listWeightEntries(supabase, 14);
      if (w.ok) setWeights(w.data);
      setReadiness(await loadReadiness(supabase, new Date()));
      const c = await getCheckin(supabase, isoDay(new Date()));
      if (c.ok && c.data) {
        setCheckinFactors(c.data.factors);
        setCheckinMood(c.data.mood);
        setCheckinSaved(true);
      }

      const out: Vitals = { sleep: null, hrv: null, rhr: null, spo2: null, granted: [], available: false };

      // Persisted sleep first — the sync job writes sessions + stages into
      // the ledger; a live HC read is only the fallback.
      const persisted = await supabase
        .from('basalt_sleep_sessions')
        .select('id, bedtime, waketime, source, ext_id, date')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (persisted.data?.bedtime && persisted.data?.waketime) {
        const stagesQ = await supabase
          .from('basalt_sleep_stages')
          .select('stage, start_time, end_time')
          .eq('session_id', persisted.data.id)
          .order('start_time', { ascending: true });
        const stages = (stagesQ.data ?? []).map((s: any) => ({
          stage: s.stage,
          startTime: s.start_time,
          endTime: s.end_time,
          minutes: (Date.parse(s.end_time) - Date.parse(s.start_time)) / 60000,
        }));
        out.sleep = {
          id: persisted.data.ext_id ?? persisted.data.id,
          startTime: persisted.data.bedtime,
          endTime: persisted.data.waketime,
          hours: (Date.parse(persisted.data.waketime) - Date.parse(persisted.data.bedtime)) / 3_600_000,
          stages,
          hasRealStages: stages.length > 0,
          dataOrigin: String(persisted.data.source ?? '').replace(/^health_connect:?/, ''),
        };
      }

      const avail = await healthService.isAvailable();
      if (avail.ok && avail.data === 'available') {
        out.available = true;
        const granted = await healthService.getGrantedPermissions();
        out.granted = granted.ok ? granted.data : [];
        if (!out.sleep && out.granted.includes('sleep')) {
          const s = await healthService.getSleepSessionForNight();
          if (s.ok) out.sleep = s.data;
        }
        if (out.granted.includes('hrv')) {
          const h = await healthService.getHrvForDay();
          if (h.ok && h.data.length > 0) out.hrv = Math.round(h.data.reduce((a, b) => a + b.ms, 0) / h.data.length);
        }
        if (out.granted.includes('restingHeartRate')) {
          const r = await healthService.getRestingHeartRate();
          if (r.ok) out.rhr = r.data;
        }
        if (out.granted.includes('spo2')) {
          const s = await healthService.getSpO2ForDay();
          if (s.ok && s.data.length > 0) out.spo2 = Math.round(s.data.reduce((a, b) => a + b, 0) / s.data.length);
        }
      }
      setVitals(out);
    })();
  }, []);

  const rate = weeklyWeightRate(weights);
  const latest = weights.length > 0 ? weights[weights.length - 1] : null;
  const losing = (profile?.goalTypes ?? []).includes('lose');
  const onPace = rate !== null && losing && rate < 0;

  const ready = readiness?.ok ? readiness.data.readiness : null;
  const bands = readiness?.ok ? readiness.data.bands : null;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content}>
      {/* ── Readiness — published formula, math one tap away ───────── */}
      <Card>
        <ReceiptHeader label="Readiness" summary={ready?.score !== null && ready ? 'tap for the math' : undefined} />
        {ready === null ? (
          <EmptyState>Reading your vitals…</EmptyState>
        ) : ready.score === null ? (
          <EmptyState>
            {`No readiness number: ${ready.note}. No wearable data, no number — it will appear when the components exist.`}
          </EmptyState>
        ) : (
          <Pressable onPress={() => setMathOpen(true)}>
            <HeroNumeral value={String(ready.score)} unit="/ 100" />
            <SrcNote>{`${ready.note} · HRV + RHR vs your 30-day medians · sleep vs target · prior-day load vs your P75 · published formula, tap to see every input`}</SrcNote>
          </Pressable>
        )}
      </Card>
      {ready ? (
        <Modal visible={mathOpen} transparent animationType="fade" onRequestClose={() => setMathOpen(false)}>
          <Pressable style={styles.dim} onPress={() => setMathOpen(false)} />
          <View style={styles.mathSheet}>
            <Text style={styles.mathTitle}>THE MATH</Text>
            {ready.components.map((c, i) => (
              <ReceiptRow
                key={c.key}
                name={c.label}
                meta={c.detail}
                value={c.points === null ? '—' : String(c.points)}
                unit={c.points === null ? undefined : '/ 25'}
                valueColor={c.points === null ? color.faint : undefined}
                last={i === ready.components.length - 1}
              />
            ))}
            <SrcNote>{ready.note} · components without data score nothing and hide nothing</SrcNote>
          </View>
        </Modal>
      ) : null}

      {/* ── Vitals baselines — your own 30-day band ────────────────── */}
      {bands && (bands.hrv.band || bands.rhr.band) ? (
        <Card>
          <ReceiptHeader label="Baselines" summary="your 30-day band" />
          {bands.hrv.band ? (
            <ReceiptRow
              name="HRV (rMSSD)"
              meta={`band ${Math.round(bands.hrv.band.min)}–${Math.round(bands.hrv.band.max)} ms · median ${Math.round(bands.hrv.band.median)}`}
              value={bands.hrv.today !== null ? String(Math.round(bands.hrv.today)) : '—'}
              unit={bands.hrv.today !== null ? 'ms today' : undefined}
            />
          ) : null}
          {bands.rhr.band ? (
            <ReceiptRow
              name="Resting HR"
              meta={`band ${Math.round(bands.rhr.band.min)}–${Math.round(bands.rhr.band.max)} bpm · median ${Math.round(bands.rhr.band.median)}`}
              value={bands.rhr.today !== null ? String(Math.round(bands.rhr.today)) : '—'}
              unit={bands.rhr.today !== null ? 'bpm today' : undefined}
              last
            />
          ) : null}
          <SrcNote>Bands need 7+ persisted days · from Health Connect rollups, source named · no band from thin air</SrcNote>
        </Card>
      ) : null}

      <ProgressPhotosCard />

      {/* ── Fasting — opt-in window timer, information not advice ──── */}
      {fastingEnabled ? (
        <Card>
          <ReceiptHeader label="Fasting" summary={activeFast ? stageFor(fastElapsed(activeFast.startedAt, fastNow).hours).label : undefined} />
          {activeFast ? (
            <>
              <HeroNumeral value={fastElapsed(activeFast.startedAt, fastNow).text} unit="h fasted" />
              <SrcNote>{`${stageFor(fastElapsed(activeFast.startedAt, fastNow).hours).detail} · ${FASTING_DISCLAIMER}`}</SrcNote>
              <CTA
                label="End fast"
                onPress={() => {
                  void endFast(supabase, activeFast.id, new Date().toISOString()).then(() => {
                    setActiveFast(null);
                    void listRecentFasts(supabase).then((r) => r.ok && setRecentFasts(r.data));
                  });
                }}
              />
            </>
          ) : (
            <>
              {recentFasts.length > 0 ? (
                recentFasts.map((f, i) => (
                  <ReceiptRow
                    key={f.id}
                    name={new Date(f.startedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    value={fastElapsed(f.startedAt, Date.parse(f.endedAt!)).text}
                    unit="h"
                    last={i === recentFasts.length - 1}
                  />
                ))
              ) : (
                <EmptyState>No fasts recorded. Start one when a window begins — the stages are documented, not promised.</EmptyState>
              )}
              <CTA label="Start fast" onPress={() => {
                void startFast(supabase, new Date().toISOString()).then((r) => r.ok && setActiveFast(r.data));
              }} />
            </>
          )}
        </Card>
      ) : null}

      {/* ── Evening check-in — facts for your own correlations ─────── */}
      <Card>
        <ReceiptHeader label="Evening check-in" summary={checkinSaved ? 'saved for today' : undefined} />
        <ChipGroup
          options={CHECKIN_FACTORS.map((f) => f.label)}
          values={checkinFactors.map((k) => CHECKIN_FACTORS.find((f) => f.key === k)?.label ?? k)}
          onToggle={(label) => {
            const key = CHECKIN_FACTORS.find((f) => f.label === label)?.key;
            if (!key) return;
            const next = checkinFactors.includes(key)
              ? checkinFactors.filter((k) => k !== key)
              : [...checkinFactors, key];
            setCheckinFactors(next);
            setCheckinSaved(true);
            void saveCheckin(supabase, { date: isoDay(new Date()), factors: next, mood: checkinMood });
          }}
        />
        <ChipRow
          options={['1', '2', '3', '4', '5']}
          value={checkinMood !== null ? String(checkinMood) : undefined}
          onChange={(v) => {
            const mood = parseInt(v, 10);
            setCheckinMood(mood);
            setCheckinSaved(true);
            void saveCheckin(supabase, { date: isoDay(new Date()), factors: checkinFactors, mood });
          }}
        />
        <SrcNote>Facts about today, one row per day · they feed Trends' correlations through the same gates (|r| ≥ 0.45, 30+ days) · never scored, never judged · mood 1–5 optional</SrcNote>
      </Card>

      {/* ── Sleep ──────────────────────────────────────────────────── */}
      <Card>
        {vitals?.sleep ? (
          <>
            <KV
              label="Sleep · last night"
              right={`${hhmm(vitals.sleep.startTime)} → ${hhmm(vitals.sleep.endTime)}`}
            />
            {(() => {
              const { h, m } = hoursMinutes(vitals.sleep!.hours * 60);
              return <HeroNumeral value={`${h} h ${m} m`} />;
            })()}
            {vitals.sleep.hasRealStages && vitals.sleep.stages.length > 0 ? (
              <>
                <StageBar
                  segments={vitals.sleep.stages.map((s) => ({
                    stage: s.stage as any,
                    fraction: s.minutes / Math.max(1, vitals.sleep!.hours * 60),
                  }))}
                />
                <TimeScale labels={[hhmm(vitals.sleep.startTime), hhmm(vitals.sleep.endTime)]} />
                <StageKey
                  items={['deep', 'rem', 'light', 'awake'].map((stage) => ({
                    stage: stage as any,
                    label: `${stage[0]!.toUpperCase()}${stage.slice(1)} ${stageMinutes(vitals.sleep!, stage)}m`,
                  }))}
                />
              </>
            ) : null}
            <SrcNote>{`Source · ${labelForPackage(vitals.sleep.dataOrigin)} via Health Connect${vitals.sleep.hasRealStages ? ' — measured stages' : ' — session only, no stage data'}`}</SrcNote>
          </>
        ) : (
          <>
            <KV label="Sleep" />
            <EmptyState>
              {vitals === null
                ? 'Checking sources…'
                : vitals.available
                  ? 'No sleep recorded for last night. Synced sessions appear here with their measured stages.'
                  : 'No sleep source connected. Connect Health Connect in Settings and last night appears here — measured, never fabricated.'}
            </EmptyState>
          </>
        )}
      </Card>

      {/* ── Vitals tiles — real-or-hidden ──────────────────────────── */}
      <TileGrid>
        {vitals?.hrv != null ? (
          <StatTile label="HRV" source="rMSSD" value={String(vitals.hrv)} unit="ms" />
        ) : (
          <EmptyTile label="HRV" message="No HRV source. Connect a watch via Health Connect." />
        )}
        {vitals?.rhr != null ? (
          <StatTile label="Resting HR" value={String(vitals.rhr)} unit="bpm" />
        ) : (
          <EmptyTile label="Resting HR" message="No resting-heart-rate source connected." />
        )}
        {vitals?.spo2 != null ? (
          <StatTile label="SpO₂" value={String(vitals.spo2)} unit="%" />
        ) : (
          <EmptyTile label="SpO₂" message="No blood-oxygen source connected." />
        )}
        <EmptyTile label="Blood glucose" message="No glucose data recorded for this period. Connect a source to begin." />
      </TileGrid>

      {/* ── Bodyweight ─────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Bodyweight" summary={weights.length > 1 ? '14-day trend' : undefined} />
        {latest ? (
          <>
            <View style={styles.weightRow}>
              <Text style={styles.weightValue}>
                {kgText(latest.weightKg)} <Text style={styles.weightUnit}>kg</Text>
              </Text>
              {rate !== null ? (
                <Text style={[styles.weightRate, onPace && { color: color.carbs }]}>
                  {rate > 0 ? '+' : ''}{rate} kg / wk{onPace ? ' · on pace' : ''}
                </Text>
              ) : (
                <Text style={styles.weightRateFaint}>trend needs a few more weigh-ins</Text>
              )}
            </View>
            {weights.length >= 2 ? (
              <Sparkline points={sparkPoints(weights)} stroke={color.carbs} />
            ) : null}
            <SrcNote>Weigh-ins from your log · trend is a least-squares fit, not wishful smoothing</SrcNote>
          </>
        ) : (
          <EmptyState>No weigh-ins yet. Log one from the + sheet — the weekly recalibration feeds on them.</EmptyState>
        )}
      </Card>
    </ScrollView>
  );
}

function stageMinutes(sleep: SleepSessionSummary, stage: string): number {
  return Math.round(sleep.stages.filter((s) => s.stage === stage).reduce((a, b) => a + b.minutes, 0));
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Mind ───────────────────────────────────────────────────────────────────

function MindTab() {
  const { theme } = useTheme();
  const bumpToday = useAppStore((s) => s.bumpToday);
  const [protocol, setProtocol] = useState<BreathProtocol>(PROTOCOLS[0]!);
  const [minutes, setMinutes] = useState(5);
  const [running, setRunning] = useState(false);
  const [clock, setClock] = useState(0);
  const [recent, setRecent] = useState<{ kind: string; minutes: number; startedAt: string }[]>([]);
  const startRef = useRef<string | null>(null);
  const scale = useRef(new Animated.Value(0.62)).current;
  const lastLabel = useRef('');

  const loadRecent = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data } = await supabase
      .from('basalt_mindfulness_sessions')
      .select('kind, minutes, started_at')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false })
      .limit(10);
    setRecent((data ?? []).map((r: any) => ({ kind: r.kind, minutes: Number(r.minutes), startedAt: r.started_at })));
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const phase = phaseAt(protocol, clock);

  useEffect(() => {
    if (!running) return;
    // Haptic pulse on phase change — sounds stay off unless you turn them on.
    if (phase.label !== lastLabel.current) {
      lastLabel.current = phase.label;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(scale, {
        toValue: phase.label === 'Inhale' ? 1 : phase.label === 'Exhale' ? 0.62 : (scale as any)._value ?? 0.8,
        duration: phase.remaining * 1000,
        useNativeDriver: true,
      }).start();
    }
  }, [phase.label, phase.remaining, running, scale]);

  useEffect(() => {
    if (running && clock >= minutes * 60) {
      void stop(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  const start = () => {
    startRef.current = new Date().toISOString();
    setClock(0);
    lastLabel.current = '';
    setRunning(true);
  };

  const stop = async (completed: boolean) => {
    setRunning(false);
    const startedAt = startRef.current;
    const elapsedMin = Math.round((clock / 60) * 10) / 10;
    startRef.current = null;
    setClock(0);
    // Log only real practice — under 30 seconds is a false start, not a session.
    if (startedAt && (completed || clock >= 30)) {
      await supabase.from('basalt_mindfulness_sessions').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        minutes: completed ? minutes : elapsedMin,
        kind: protocol.key,
        source: 'manual',
      });
      bumpToday();
      void loadRecent();
    }
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content}>
      <Card>
        <KV label={protocol.name} right={protocol.phases.filter((p) => p > 0).join(' · ')} />
        <View style={styles.pacer}>
          <View style={styles.pacerRing}>
            <Animated.View style={[styles.pacerFill, { transform: [{ scale }] }]} />
            <Text style={styles.pacerLabel}>{running ? phase.label.toUpperCase() : 'READY'}</Text>
          </View>
          <Text style={styles.pacerCount}>
            {running ? `${phase.remaining} · FOLLOW THE RING` : `${cycleSeconds(protocol)} S CYCLE`}
          </Text>
        </View>
        <ChipRow
          options={['5 min', '10 min', '15 min', '20 min']}
          value={`${minutes} min`}
          onChange={(v) => setMinutes(parseInt(v, 10))}
        />
        <CTA label={running ? 'Stop' : 'Begin'} onPress={() => (running ? void stop(false) : start())} />
        <SrcNote center>Haptic pulse on phase change · no sounds unless you turn them on · logs as a mindfulness session</SrcNote>
      </Card>

      <Card>
        <ReceiptHeader label="Protocols" summary="structured breathing" />
        {PROTOCOLS.map((p, i) => (
          <ReceiptRow
            key={p.key}
            name={p.name}
            meta={p.meta}
            value={p.key === protocol.key ? 'active' : 'use'}
            valueColor={p.key === protocol.key ? color.carbs : color.faint}
            last={i === PROTOCOLS.length - 1}
            {...{ onPress: undefined }}
          />
        ))}
        <View style={styles.protocolTap}>
          <ChipRow
            options={PROTOCOLS.map((p) => p.name)}
            value={protocol.name}
            onChange={(name) => !running && setProtocol(PROTOCOLS.find((p) => p.name === name)!)}
          />
        </View>
      </Card>

      <Card>
        <ReceiptHeader
          label="This week"
          summary={
            recent.length > 0
              ? `${recent.length} sessions · ${groupInt(recent.reduce((s, r) => s + r.minutes, 0))} min`
              : undefined
          }
        />
        {recent.length > 0 ? (
          recent.map((r, i) => (
            <ReceiptRow
              key={i}
              name={PROTOCOLS.find((p) => p.key === r.kind)?.name ?? 'Unguided'}
              meta={new Date(r.startedAt).toLocaleDateString('en-AU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              value={String(r.minutes)}
              unit="min"
              last={i === recent.length - 1}
            />
          ))
        ) : (
          <EmptyState>No sessions this week. The first one starts the record.</EmptyState>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  mathSheet: {
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  mathTitle: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.mute },
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 },
  weightValue: { ...({ fontFamily: mono } as object), fontSize: 23, fontWeight: '600', color: color.ink },
  weightUnit: { fontSize: 12, color: color.mute, fontWeight: '400' },
  weightRate: { fontFamily: mono, fontSize: 12, color: color.ink2 },
  weightRateFaint: { fontFamily: mono, fontSize: 11, color: color.faint },
  pacer: { alignItems: 'center', paddingVertical: 26 },
  pacerRing: {
    width: 150, height: 150, borderRadius: 75,
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  pacerFill: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(94,114,228,.10)',
    borderWidth: 1.5, borderColor: color.recovery,
  },
  pacerLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.98, color: color.ink2 },
  pacerCount: { fontFamily: mono, fontSize: 11, color: color.faint, marginTop: 18, letterSpacing: 1 },
  protocolTap: { marginTop: 4 },
});
