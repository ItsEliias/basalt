import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CalGrid, CalDays,
  color, mono, useTheme,
  ScaledText as Text,
} from '@basalt/ui';
import {
  activeDaysFor, currentAndLongest, monthCells, loadWeekReview, loadDailySeries, computeCorrelations,
  loadMonthlyBehavior, type MonthlyBehaviorReport,
  loadYearAndChallenge,
  type WeekReview, type CorrelationResult, type YearReview, type MonthlyChallenge,
} from '@basalt/analytics';
import { e1rm, bigThree, type BigThree } from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { ShareSheet, WeekShareCard } from '../../components/ShareCards';
import { CoopCard } from './CoopCard';
import { loadWeeklyVolume, type WeeklyVolumeReport } from '../../lib/weeklyVolumeData';
import { volumeLine } from '@basalt/training';

// Trends — everything here is computed from the ledger or absent. Gaps stay
// gray, streak resets don't shame, and there are no charts until there is
// history to chart.

type Records = { name: string; e1rm: number; date: string }[];

export function TrendsScreen() {
  const { theme } = useTheme();
  const [fullDays, setFullDays] = useState<Set<string> | null>(null);
  const [weeklyVol, setWeeklyVol] = useState<WeeklyVolumeReport | null>(null);
  const [anyDays, setAnyDays] = useState<Set<string> | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [big3, setBig3] = useState<BigThree | null>(null);
  const [review, setReview] = useState<WeekReview | null>(null);
  const hideNumbers = useAppStore((s) => s.profile?.hideNumbers ?? false);
  const [correlations, setCorrelations] = useState<{ shown: CorrelationResult[]; checkedNotShown: CorrelationResult[] } | null>(null);
  const [shareWeek, setShareWeek] = useState(false);
  const [year, setYear] = useState<YearReview | null>(null);
  const [challenge, setChallenge] = useState<MonthlyChallenge>(null);
  const challengeEnabled = useAppStore((s) => s.profile?.challengeEnabled ?? false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [monthly, setMonthly] = useState<MonthlyBehaviorReport | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    void (async () => {
      try {
        const [full, any, wr] = await Promise.all([
          activeDaysFor(supabase, 'full', { restAware: true }),
          activeDaysFor(supabase, 'any', { restAware: true }),
          loadWeekReview(supabase, new Date(), { hideNumbers }),
        ]);
        if (wr.ok) setReview(wr.data);
        else setLoadFailed(true);
        const series = await loadDailySeries(supabase, new Date());
        if (series.ok) setCorrelations(computeCorrelations(series.data));
        else setLoadFailed(true);
        void loadMonthlyBehavior(supabase).then((r) => r.ok && setMonthly(r.data));
        const yc = await loadYearAndChallenge(supabase, new Date());
        if (yc.ok) {
          setYear(yc.data.year);
          setChallenge(yc.data.challenge);
        }
        setFullDays(full.ok ? full.data : new Set());
        setAnyDays(any.ok ? any.data : new Set());

        // Records: best e1RM per exercise from real set history.
        const { data: sets } = await supabase
          .from('basalt_set_entries')
          .select('weight_kg, reps, set_type, completed_at, session_exercise_id')
          .not('weight_kg', 'is', null)
          .limit(2000);
        const { data: exs } = await supabase
          .from('basalt_session_exercises')
          .select('id, exercise_name')
          .limit(1000);
        const nameFor = new Map<string, string>((exs ?? []).map((r: any) => [r.id, r.exercise_name]));
        const best = new Map<string, { e1rm: number; date: string }>();
        for (const s of sets ?? []) {
          if ((s as any).set_type === 'warmup') continue;
          const v = e1rm(Number((s as any).weight_kg), (s as any).reps ?? null);
          if (v === null) continue;
          const name = nameFor.get((s as any).session_exercise_id);
          if (!name) continue;
          const cur = best.get(name);
          if (!cur || v > cur.e1rm) best.set(name, { e1rm: v, date: (s as any).completed_at });
        }
        const allRecords = Array.from(best.entries()).map(([name, v]) => ({ name, e1rm: v.e1rm, date: v.date }));
        setRecords([...allRecords].sort((a, b) => b.e1rm - a.e1rm).slice(0, 5));
        setBig3(bigThree(allRecords));
      } catch (e) {
        console.error('Trends load failed:', e);
        setLoadFailed(true);
      }
    })();
  }, [hideNumbers]);
  useEffect(() => {
    void loadWeeklyVolume(supabase).then((r) => r.ok && setWeeklyVol(r.data));
  }, []);

  useEffect(() => load(), [load]);

  const today = new Date();
  const partial = new Set<string>();
  if (anyDays && fullDays) {
    anyDays.forEach((d) => {
      if (!fullDays.has(d)) partial.add(d);
    });
  }
  const streak = anyDays ? currentAndLongest(anyDays, today) : null;
  const fullStreak = fullDays ? currentAndLongest(fullDays, today) : null;
  const loggedThisMonth = anyDays
    ? Array.from(anyDays).filter((d) => d.startsWith(today.toISOString().slice(0, 7))).length
    : 0;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content}>
      {/* ── Week in review — composed, never cheered ───────────────── */}
      <Card>
        <ReceiptHeader label="Week in review" summary={review?.rangeLabel} />
        {loadFailed && review === null ? (
          <Pressable onPress={load} hitSlop={8}>
            <EmptyState>Couldn't read last week — tap to retry.</EmptyState>
          </Pressable>
        ) : review === null ? (
          <EmptyState>Reading last week…</EmptyState>
        ) : review.lede === null ? (
          <EmptyState>
            Not enough logged last week to review honestly — it needs at least a couple of logged
            days or a session.
          </EmptyState>
        ) : (
          <>
            <Text style={styles.lede}>{review.lede}</Text>
            {review.stats.length > 0 ? (
              <View style={styles.wstatRow}>
                {/* Hide-numbers quieting happens in the composer itself, not here. */}
                {review.stats.map((s) => (
                  <View key={s.k} style={styles.wstat}>
                    <Text style={styles.wstatK}>{s.k}</Text>
                    <Text style={styles.wstatV}>{s.v}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
        {review?.lede ? (
          <Pressable onPress={() => setShareWeek(true)}>
            <Text style={styles.shareLink}>SHARE AS IMAGE →</Text>
          </Pressable>
        ) : null}
        <SrcNote>Written from your data · no cheerleading · one gap named per week</SrcNote>
      </Card>
      {review && shareWeek ? (
        <ShareSheet open onClose={() => setShareWeek(false)} filename="basalt-week.png">
          <WeekShareCard review={review} />
        </ShareSheet>
      ) : null}

      {/* ── Consistency calendar ───────────────────────────────────── */}
      <Card>
        <ReceiptHeader
          label={`${today.toLocaleDateString('en-AU', { month: 'long' })} · days logged`}
          summary={anyDays ? `${loggedThisMonth} of ${today.getDate()} so far` : undefined}
        />
        <CalDays />
        {fullDays && anyDays ? (
          <CalGrid cells={monthCells(today.getFullYear(), today.getMonth(), fullDays, partial, today)} />
        ) : null}
        <SrcNote>Filled = food + training · dim = partial · gaps stay gray — no flames, no guilt, no resetting counters</SrcNote>
      </Card>

      {/* ── Streaks — dual milestones ──────────────────────────────── */}
      {streak && (streak.current > 0 || streak.longest > 0) ? (
        <Card>
          <ReceiptHeader label="Consistency" summary="computed, never stored" />
          <ReceiptRow name="Current run — any logging" meta="days in a row with anything logged" value={String(streak.current)} unit="days" />
          <ReceiptRow name="Longest run — any logging" meta="within the last 180 days" value={String(streak.longest)} unit="days" />
          {fullStreak ? (
            <ReceiptRow name="Longest full-log run" meta="food logged + trained or rested properly" value={String(fullStreak.longest)} unit="days" last />
          ) : null}
          <SrcNote>
            Rest doesn't break a training run — a day with readiness below 40 (when a number existed) counts as rest · rest maintains a run, only sessions start one
          </SrcNote>
        </Card>
      ) : null}

      {/* ── Records — from real set history ────────────────────────── */}
      <Card>
        <ReceiptHeader label="Records" summary={records && records.length > 0 ? 'all-time · e1RM' : undefined} />
        {records === null ? (
          <EmptyState>Reading your set history…</EmptyState>
        ) : records.length > 0 ? (
          records.map((r, i) => (
            <ReceiptRow
              key={r.name}
              name={r.name}
              meta={new Date(r.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              value={String(r.e1rm)}
              unit="kg e1RM"
              valueColor={i === 0 ? color.carbs : undefined}
              last={i === records.length - 1}
            />
          ))
        ) : (
          <EmptyState>
            No records yet — they appear when weighted sets do. Epley e1RM, published formula, from
            your own history only.
          </EmptyState>
        )}
      </Card>

      {/* ── Big Three — only when the competition lifts exist ─────── */}
      {big3 && (big3.squat || big3.bench || big3.deadlift) ? (
        <Card>
          <ReceiptHeader label="Big three" summary="e1RM · published matcher, competition lifts only" />
          {big3.squat ? <ReceiptRow name="Squat" meta={big3.squat.name} value={String(big3.squat.e1rm)} unit="kg" /> : null}
          {big3.bench ? <ReceiptRow name="Bench" meta={big3.bench.name} value={String(big3.bench.e1rm)} unit="kg" /> : null}
          {big3.deadlift ? <ReceiptRow name="Deadlift" meta={big3.deadlift.name} value={String(big3.deadlift.e1rm)} unit="kg" /> : null}
          {big3.total !== null ? (
            <ReceiptRow name="Total" meta="all three present — no partial totals" value={String(big3.total)} unit="kg" valueColor={color.carbs} last />
          ) : (
            <SrcNote>No total until all three lifts have history — partial totals are fiction</SrcNote>
          )}
        </Card>
      ) : null}

      {/* ── Correlations — gated, disclaimed, checked-not-shown named ── */}
      <Card>
        <ReceiptHeader label="Correlations" summary={correlations ? `${correlations.shown.length} past the gates` : undefined} />
        {loadFailed && correlations === null ? (
          <Pressable onPress={load} hitSlop={8}>
            <EmptyState>Couldn't read your daily series — tap to retry.</EmptyState>
          </Pressable>
        ) : correlations === null ? (
          <EmptyState>Reading your daily series…</EmptyState>
        ) : (
          <>
            {correlations.shown.map((c, i) => (
              <ReceiptRow
                key={`${c.pair.aKey}-${c.pair.bKey}`}
                name={c.statement ?? ''}
                value={c.r !== null ? c.r.toFixed(2) : '—'}
                unit="r"
                last={i === correlations.shown.length - 1}
              />
            ))}
            {correlations.shown.length === 0 ? (
              <EmptyState>
                Nothing to show yet — a correlation appears only past |r| ≥ 0.45 over ≥ 30 overlapping
                days. That takes weeks of real data, and the bar doesn't bend.
              </EmptyState>
            ) : null}
            {correlations.checkedNotShown.length > 0 ? (
              <View style={{ marginTop: 6, gap: 3 }}>
                <SrcNote>Checked, not shown</SrcNote>
                {correlations.checkedNotShown.map((c) => (
                  <SrcNote key={`${c.pair.aKey}-${c.pair.bKey}`} style={{ opacity: 0.75 }}>
                    {`${c.pair.aLabel} × ${c.pair.bLabel}${c.pair.lag ? ' (next day)' : ''} — ${c.r === null ? 'no signal' : `r ${c.r.toFixed(2)}`}, ${c.n} d`}
                  </SrcNote>
                ))}
                <SrcNote>|r| ≥ 0.45 and ≥ 30 days required · correlation, never cause</SrcNote>
              </View>
            ) : null}
          </>
        )}
      </Card>

      {/* ── Monthly behavior impact — facts + gated correlations ───── */}
      {monthly ? (
        <Card>
          <ReceiptHeader label="Behavior impact" summary={monthly.rangeLabel} />
          {monthly.lede === null ? (
            <EmptyState>
              Not enough evening check-ins last month to report honestly — it needs 8+. Nothing is
              invented to fill this card.
            </EmptyState>
          ) : (
            <>
              <Text style={styles.lede}>{monthly.lede}</Text>
              {monthly.factorLines.map((line) => (
                <SrcNote key={line}>{line}</SrcNote>
              ))}
              {monthly.impactLines.length > 0 ? (
                monthly.impactLines.map((line) => (
                  <ReceiptRow key={line} name={line} value="" unit="" />
                ))
              ) : (
                <EmptyState>
                  No behavior–outcome pair passed the gates (|r| ≥ 0.45 over ≥ 30 days). The bar
                  doesn't bend for a monthly report.
                </EmptyState>
              )}
              {monthly.checkedNotShownLines.length > 0 ? (
                <View style={{ marginTop: 6, gap: 3 }}>
                  <SrcNote>Checked, not shown</SrcNote>
                  {monthly.checkedNotShownLines.map((line) => (
                    <SrcNote key={line} style={{ opacity: 0.75 }}>{line}</SrcNote>
                  ))}
                </View>
              ) : null}
              <SrcNote>Correlation, never cause · same gates as the card above · check-ins feed this</SrcNote>
            </>
          )}
        </Card>
      ) : null}

      {/* ── Monthly challenge — private, optional, your own baseline ── */}
      {challengeEnabled && challenge ? (
        <Card>
          <ReceiptHeader label="Monthly challenge" summary="yours alone — no leaderboards" />
          <ReceiptRow
            name={challenge.statement}
            meta={challenge.basis}
            value={`${challenge.progress} / ${challenge.goal}`}
            unit={challenge.kind === 'steps' ? 'days' : 'sessions'}
            last
          />
          <SrcNote>Computed from your own baseline · private · switch it off any time in Settings</SrcNote>
        </Card>
      ) : null}
      {challengeEnabled && challenge === null ? (
        <Card>
          <ReceiptHeader label="Monthly challenge" />
          <EmptyState>
            No challenge yet — it needs a baseline (14+ days of steps or some session history).
            Nothing is invented to fill this card.
          </EmptyState>
        </Card>
      ) : null}

      {/* ── Year in review — same honesty, year scale ──────────────── */}
      {year && year.lede ? (
        <Card>
          <ReceiptHeader label="Year in review" summary="composed from your ledger" />
          <Text style={styles.lede}>{year.lede}</Text>
          <View style={styles.wstatRow}>
            {year.stats.map((s) => (
              <View key={s.k} style={styles.wstat}>
                <Text style={styles.wstatK}>{s.k}</Text>
                <Text style={styles.wstatV}>{s.v}</Text>
              </View>
            ))}
          </View>
          <SrcNote>Needs 90+ logged days or 45+ sessions to compose · one gap named · no cheerleading</SrcNote>
        </Card>
      ) : null}

      <Text style={styles.footer}>
        EVERYTHING ON THIS SCREEN IS COMPUTED FROM YOUR LEDGER OR ABSENT — NOTHING HERE
        WILL EVER BE A MOCK
      </Text>
      {/* ── Weekly muscle volume — position vs a published band ───── */}
      {weeklyVol && weeklyVol.regions.length > 0 ? (
        <Card>
          <ReceiptHeader
            label="Weekly muscle volume"
            summary={`last 7 days${weeklyVol.phase === 'deload' ? ' · deload band' : ''}`}
          />
          {weeklyVol.regions.map((v, i) => (
            <ReceiptRow
              key={v.region}
              name={v.region.charAt(0).toUpperCase() + v.region.slice(1)}
              meta={volumeLine(v)}
              value={Number.isInteger(v.sets) ? String(v.sets) : v.sets.toFixed(1)}
              unit="sets"
              last={i === weeklyVol.regions.length - 1}
            />
          ))}
          <SrcNote>
            {`Published band: 10–20 hard sets per muscle per week (a deload halves it) · primary sets count 1, secondary ½ · warmups excluded · a position, never a prescription` +
              (weeklyVol.unlinkedExercises > 0
                ? ` · ${weeklyVol.unlinkedExercises} ${weeklyVol.unlinkedExercises === 1 ? 'exercise' : 'exercises'} without a library link not counted`
                : '')}
          </SrcNote>
        </Card>
      ) : null}

      {/* ── One friend — dots only, engine-pinned copy ────────────── */}
      <CoopCard />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  footer: {
    fontFamily: mono, fontSize: 10.5, color: color.faint, letterSpacing: 0.38,
    lineHeight: 16, marginTop: 14, paddingHorizontal: 4,
  },
  lede: { fontSize: 13.5, color: color.ink, lineHeight: 20, marginBottom: 12 },
  wstatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  wstat: { minWidth: 68 },
  wstatK: {
    fontFamily: mono, fontSize: 11, color: color.ink2, letterSpacing: 0.38,
    textTransform: 'uppercase', marginBottom: 2,
  },
  wstatV: { fontFamily: mono, fontSize: 15, color: color.ink, fontVariant: ['tabular-nums'] },
  shareLink: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, color: color.faint, paddingTop: 8 },
});
