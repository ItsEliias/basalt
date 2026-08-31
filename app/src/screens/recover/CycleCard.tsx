import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, ChipGroup, ChipRow, ObChipLabel,
  color, mono, ScaledText as Text,
} from '@basalt/ui';
import {
  loadCycle, saveCycleDay, CYCLE_SYMPTOMS,
  type CycleReport, type CycleEntry,
} from '@basalt/analytics';
import { isoDay } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';

// Cycle — facts and labelled estimates, strictly apart (engine-pinned).
// The card itself is opt-in: nothing renders until the user turns it on,
// and the data stays out of every score and out of sharing unless the
// 'cycle' domain is granted by itself.

const CARD_KEY = 'basalt.cycleCard';
const FLOWS = ['spotting', 'light', 'medium', 'heavy'] as const;

export function CycleCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [report, setReport] = useState<(CycleReport & { today: CycleEntry | null }) | null>(null);

  const refresh = useCallback(() => {
    void loadCycle(supabase).then((r) => r.ok && setReport(r.data));
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(CARD_KEY).then((v) => {
      const on = v === 'on';
      setEnabled(on);
      if (on) refresh();
    });
  }, [refresh]);

  if (enabled === null) return null;

  if (!enabled) {
    return (
      <Pressable
        onPress={() => {
          setEnabled(true);
          void AsyncStorage.setItem(CARD_KEY, 'on');
          refresh();
        }}
        hitSlop={8}
      >
        <Text style={styles.optIn}>TRACK CYCLE — OPT-IN, PRIVATE, NEVER IN ANY SCORE</Text>
      </Pressable>
    );
  }

  const today = isoDay(new Date());
  const flow = report?.today?.flow ?? null;
  const symptoms = report?.today?.symptoms ?? [];

  const setFlow = (f: (typeof FLOWS)[number]) => {
    const next = flow === f ? null : f;
    void saveCycleDay(supabase, today, next, symptoms).then(refresh);
  };
  const toggleSymptom = (s: string) => {
    const next = symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s];
    void saveCycleDay(supabase, today, flow, next).then(refresh);
  };

  const fmt = (iso: string) => iso.slice(5).replace('-', '/');

  return (
    <Card>
      <ReceiptHeader
        label="Cycle"
        summary={report?.cycleDay ? `day ${report.cycleDay}` : undefined}
      />

      <ObChipLabel>Today's flow — tap again to clear</ObChipLabel>
      <ChipRow
        options={FLOWS.map((f) => f.toUpperCase())}
        value={flow ? flow.toUpperCase() : undefined}
        onChange={(v) => setFlow(v.toLowerCase() as (typeof FLOWS)[number])}
      />
      <ObChipLabel>Symptoms</ObChipLabel>
      <ChipGroup
        options={[...CYCLE_SYMPTOMS]}
        values={symptoms}
        onToggle={toggleSymptom}
      />

      {report?.lastPeriod ? (
        <ReceiptRow
          name="Last period"
          meta="a fact — the days you logged"
          value={`${fmt(report.lastPeriod.start)}–${fmt(report.lastPeriod.end)}`}
          unit={`${report.lastPeriod.days}d`}
        />
      ) : null}
      {report?.estimate ? (
        <>
          <ReceiptRow
            name="Next period window"
            meta={`median ${report.estimate.medianLen} days over your last ${report.estimate.basedOnCycles} cycles`}
            value={`~${fmt(report.estimate.windowStart)}–${fmt(report.estimate.windowEnd)}`}
            unit=""
            last
          />
          <SrcNote>{report.estimate.label}</SrcNote>
        </>
      ) : report && report.periods.length > 0 ? (
        <SrcNote>No estimate yet — it appears after two complete cycles, from your own spread, never a population average</SrcNote>
      ) : (
        <EmptyState>Log flow days as they happen — periods, cycle day and (after two cycles) an estimate window build from them.</EmptyState>
      )}

      {report ? <SrcNote>{report.srcnote}</SrcNote> : null}
      <Pressable
        onPress={() => {
          setEnabled(false);
          void AsyncStorage.setItem(CARD_KEY, 'off');
        }}
        hitSlop={8}
      >
        <Text style={styles.optIn}>HIDE THIS CARD — YOUR LOGGED DAYS STAY YOURS</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  optIn: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, color: color.faint, textAlign: 'center', paddingVertical: 12 },
});
