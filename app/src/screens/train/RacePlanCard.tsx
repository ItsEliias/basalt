import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CTA, ObInput, ObChipLabel, ChipRow,
  color, mono, ScaledText as Text,
} from '@basalt/ui';
import {
  riegelPredict, trainingPaces, buildRacePlan, rampBack, raceTimeText,
  getActiveRacePlan, startRacePlan, setRaceSessionDone, stopRacePlan,
  RACE_DISTANCES_M, PLAN_WEEKS_MIN, PLAN_WEEKS_MAX,
  type RaceKey, type RacePlanRecord,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';

// Race plan — one knob (a recent result), one named model (Riegel 1977,
// T2 = T1 × (D2/D1)^1.06), a tick-box week view, and a published
// ramp-back rule when life happens. The plan recomputes from its inputs
// every render; nothing here is a stored coach's opinion.

const RACE_LABELS: Record<RaceKey, string> = { '5k': '5K', '10k': '10K', half: 'HALF', marathon: 'MARATHON' };
const WEEK_OPTIONS = [6, 8, 10, 12, 16];

function parseTimeText(t: string): number | null {
  const parts = t.trim().split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

function paceText(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RacePlanCard() {
  const [plan, setPlan] = useState<RacePlanRecord | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [race, setRace] = useState<RaceKey>('10k');
  const [weeks, setWeeks] = useState(8);
  const [basisRace, setBasisRace] = useState<'5k' | '10k'>('5k');
  const [basisTime, setBasisTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewWeek, setViewWeek] = useState<number | null>(null);

  const refresh = useCallback(() => {
    void getActiveRacePlan(supabase).then((r) => {
      if (r.ok) setPlan(r.data);
      setLoadedOnce(true);
    });
  }, []);
  useEffect(() => refresh(), [refresh]);

  const start = async () => {
    const basisS = parseTimeText(basisTime);
    if (basisS === null || basisS < 600) {
      setError('Enter your recent time as mm:ss (or h:mm:ss).');
      return;
    }
    setError(null);
    const raceDate = new Date();
    raceDate.setDate(raceDate.getDate() + weeks * 7);
    const r = await startRacePlan(supabase, {
      raceKey: race,
      raceDate: raceDate.toISOString().slice(0, 10),
      basisDistM: RACE_DISTANCES_M[basisRace],
      basisSeconds: basisS,
    });
    if (r.ok) {
      setPlan(r.data);
      setViewWeek(null);
    } else {
      setError(r.error);
    }
  };

  if (!loadedOnce) return null;

  if (!plan) {
    return (
      <Card>
        <ReceiptHeader label="Race plan" />
        <EmptyState>
          One recent result is the only input — the Riegel model (1977) derives your predicted time
          and paces, and a 3-session week builds to race day.
        </EmptyState>
        <ObChipLabel>Race</ObChipLabel>
        <ChipRow options={Object.values(RACE_LABELS)} value={RACE_LABELS[race]}
          onChange={(v) => setRace((Object.keys(RACE_LABELS) as RaceKey[]).find((k) => RACE_LABELS[k] === v)!)} />
        <ObChipLabel>Race in…</ObChipLabel>
        <ChipRow options={WEEK_OPTIONS.map((w) => `${w} wk`)} value={`${weeks} wk`}
          onChange={(v) => setWeeks(Number(v.split(' ')[0]))} />
        <ObChipLabel>A recent result</ObChipLabel>
        <ChipRow options={['5K', '10K']} value={basisRace === '5k' ? '5K' : '10K'}
          onChange={(v) => setBasisRace(v === '5K' ? '5k' : '10k')} />
        <ObInput placeholder="Your time — e.g. 25:00" value={basisTime} onChangeText={setBasisTime} />
        <CTA label="Start the plan" disabled={!basisTime.trim()} onPress={() => void start()} />
        {error ? <SrcNote>{error}</SrcNote> : null}
        <SrcNote>{`Riegel: T2 = T1 × (D2/D1)^1.06 · plans run ${PLAN_WEEKS_MIN}–${PLAN_WEEKS_MAX} weeks · easy pace = 1.30 × race pace, steady = 1.12 × — published multipliers, not magic`}</SrcNote>
      </Card>
    );
  }

  // Derived, never stored: predicted time, paces, the plan, where you are.
  const paces = trainingPaces(plan.basisDistM, plan.basisSeconds, plan.raceKey);
  const predicted = riegelPredict(plan.basisDistM, plan.basisSeconds, RACE_DISTANCES_M[plan.raceKey]);
  const totalWeeks = Math.max(
    PLAN_WEEKS_MIN,
    Math.min(PLAN_WEEKS_MAX, Math.round((Date.parse(plan.raceDate) - Date.parse(plan.createdAt)) / (7 * 86400000))),
  );
  const planWeeks = buildRacePlan(plan.raceKey, totalWeeks, paces);
  const done = new Set(plan.done);
  const calendarWeek = Math.min(
    planWeeks.length - 1,
    Math.max(0, Math.floor((Date.now() - Date.parse(plan.createdAt)) / (7 * 86400000))),
  );
  let lastCompleted = -1;
  for (const w of planWeeks) {
    if (w.sessions.every((s) => done.has(s.key))) lastCompleted = w.index;
    else break;
  }
  const ramp = rampBack(calendarWeek, lastCompleted);
  const focusWeek = viewWeek ?? (ramp.action === 'continue' ? calendarWeek : ramp.week);
  const week = planWeeks[focusWeek]!;

  const toggle = async (key: string) => {
    const next = await setRaceSessionDone(supabase, plan.id, key, !done.has(key));
    if (next.ok) setPlan({ ...plan, done: next.data });
  };

  const basisKm = Math.round(plan.basisDistM / 1000);
  return (
    <Card>
      <ReceiptHeader
        label="Race plan"
        summary={`${RACE_LABELS[plan.raceKey]} · ${plan.raceDate}`}
      />
      <ReceiptRow
        name={`Predicted ${RACE_LABELS[plan.raceKey]}`}
        meta={`Riegel (1977) from your ${basisKm} km in ${raceTimeText(plan.basisSeconds)} · retime anytime by starting a new plan`}
        value={`~${raceTimeText(predicted)}`}
        unit=""
      />
      <ReceiptRow
        name="Paces"
        meta="easy · steady · race — published multiples of predicted race pace"
        value={`${paceText(paces.easySecPerKm)} · ${paceText(paces.steadySecPerKm)} · ${paceText(paces.raceSecPerKm)}`}
        unit="/km"
      />
      {ramp.action !== 'continue' ? (
        <SrcNote>{ramp.note}</SrcNote>
      ) : null}

      {/* Week dots — each week's completion at a glance, tap to view */}
      <View style={styles.dotsRow}>
        {planWeeks.map((w) => {
          const n = w.sessions.filter((s) => done.has(s.key)).length;
          return (
            <Pressable key={w.index} onPress={() => setViewWeek(w.index)} hitSlop={6}>
              <Text style={[styles.weekDot, w.index === focusWeek && styles.weekDotOn]}>
                {n === 3 ? '●' : n > 0 ? '◐' : '○'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ObChipLabel>{`Week ${focusWeek + 1} of ${planWeeks.length}${week.taper ? ' — taper' : ''}${focusWeek === calendarWeek ? ' · this week' : ''}`}</ObChipLabel>
      {week.sessions.map((s, i) => (
        <Pressable key={s.key} onPress={() => void toggle(s.key)} hitSlop={8}>
          <ReceiptRow
            name={s.label}
            meta={`${s.detail} · tap to ${done.has(s.key) ? 'untick' : 'tick'}`}
            value={done.has(s.key) ? '✓' : '—'}
            unit=""
            last={i === week.sessions.length - 1}
          />
        </Pressable>
      ))}

      <Pressable onPress={() => void stopRacePlan(supabase, plan.id).then(refresh)} hitSlop={8}>
        <Text style={styles.stopLink}>STOP PLAN</Text>
      </Pressable>
      <SrcNote>
        Catch-up rule, published: ≤1 week behind → repeat your last completed week · more → step back two weeks and rebuild · paces wear ~ because the model is a formula, not a promise
      </SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  weekDot: { fontFamily: mono, fontSize: 12, color: color.faint },
  weekDotOn: { color: color.ink },
  stopLink: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.faint, paddingVertical: 10, textAlign: 'center' },
});
