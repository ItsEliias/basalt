import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CalGrid, CalDays,
  color, mono,
} from '@basalt/ui';
import { activeDaysFor, currentAndLongest, monthCells } from '@basalt/analytics';
import { e1rm } from '@basalt/training';
import { supabase } from '../../lib/supabase';

// Trends — everything here is computed from the ledger or absent. Gaps stay
// gray, streak resets don't shame, and there are no charts until there is
// history to chart.

type Records = { name: string; e1rm: number; date: string }[];

export function TrendsScreen() {
  const [fullDays, setFullDays] = useState<Set<string> | null>(null);
  const [anyDays, setAnyDays] = useState<Set<string> | null>(null);
  const [records, setRecords] = useState<Records | null>(null);

  useEffect(() => {
    void (async () => {
      const [full, any] = await Promise.all([
        activeDaysFor(supabase, 'full'),
        activeDaysFor(supabase, 'any'),
      ]);
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
      setRecords(
        Array.from(best.entries())
          .map(([name, v]) => ({ name, e1rm: v.e1rm, date: v.date }))
          .sort((a, b) => b.e1rm - a.e1rm)
          .slice(0, 5),
      );
    })();
  }, []);

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
            <ReceiptRow name="Longest full-log run" meta="food and training on the same day" value={String(fullStreak.longest)} unit="days" last />
          ) : null}
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

      <Text style={styles.footer}>
        ROLLING TRENDS, WEEK IN REVIEW AND CORRELATIONS ARRIVE AS HISTORY ACCUMULATES — NOTHING HERE
        WILL EVER BE A MOCK
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  footer: {
    fontFamily: mono, fontSize: 9.5, color: color.faint, letterSpacing: 0.38,
    lineHeight: 16, marginTop: 14, paddingHorizontal: 4,
  },
});
