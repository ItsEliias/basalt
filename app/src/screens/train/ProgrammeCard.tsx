import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, EmptyState, ReceiptHeader, ReceiptRow, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  CORRIDOR_EXPLAINER, PROGRAMME_TEMPLATES, corridorFor, fullWeeklyCheckin, programmeTemplate,
  programmeWeek, type FullCheckin,
} from '@basalt/extras';
import { getActiveProgram, startProgram, stopProgram, listRecentSessions, loadPainSummary, type Program } from '@basalt/training';
import { listWeightEntries, saveTargets, isoDay } from '@basalt/core-data';
import { loadPlanOutcomes, trendWeightKg } from '@basalt/nutrition';
import { loadVolumeProposals } from '../../lib/weeklyVolumeData';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { ExtraSlot } from '../../components/ExtrasProvider';
import { createChallenge } from '../../lib/socialData';
import { GenerateProgrammeSheet } from './GenerateProgrammeSheet';

// Programmes (programmes Extra) — template blocks over the core program
// machinery. Week strip, trend corridor, and a weekly check-in that
// proposes exactly ONE thing through the engine in @basalt/extras.

const CHECKIN_KEY = 'basalt.programmeCheckin';

export function ProgrammeCard() {
  const { theme } = useTheme();
  const targets = useAppStore((s) => s.targets);
  const refreshCore = useAppStore((s) => s.refreshCore);
  const [program, setProgram] = useState<Program | null>(null);
  const [startWeight, setStartWeight] = useState<number | null>(null);
  const [trendNow, setTrendNow] = useState<number | null>(null);
  const [checkin, setCheckin] = useState<FullCheckin | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      const p = await getActiveProgram(supabase);
      const prog = p.ok && p.data?.templateId ? p.data : null;
      setProgram(prog);
      if (!prog) return;

      const w = await listWeightEntries(supabase, 90);
      const weighIns = w.ok ? w.data.map((x) => ({ date: x.measuredAt.slice(0, 10), kg: x.weightKg })) : [];
      const atStart = weighIns.filter((x) => x.date <= prog.startedOn);
      setStartWeight(atStart.length > 0 ? atStart[atStart.length - 1]!.kg : (weighIns[0]?.kg ?? null));
      const nowTrend = trendWeightKg(weighIns);
      setTrendNow(nowTrend?.kg ?? null);

      // Weekly check-in: at most once every 7 days, from week 2.
      const template = programmeTemplate(prog.templateId!);
      const week = template ? programmeWeek(prog.startedOn, template.weeks, new Date()) : null;
      const lastRaw = await AsyncStorage.getItem(CHECKIN_KEY);
      const daysSince = lastRaw ? (Date.now() - Date.parse(lastRaw)) / 86_400_000 : Infinity;
      if (!template || !week || week < 2 || daysSince < 7) {
        setCheckin(null);
        return;
      }
      const weekAgo = weighIns.filter((x) => Date.parse(x.date) <= Date.now() - 7 * 86_400_000);
      const prevTrend = trendWeightKg(weekAgo);
      const observedRatePct =
        nowTrend && prevTrend && prevTrend.kg > 0
          ? Math.round(((nowTrend.kg - prevTrend.kg) / prevTrend.kg) * 10000) / 100
          : null;
      const sessions = await listRecentSessions(supabase, 20);
      const cut = Date.now() - 7 * 86_400_000;
      const done = (sessions.ok ? sessions.data : []).filter((s) => Date.parse(s.startedAt) >= cut).length;

      // Facts for the full check-in: meal adherence, RIR trend, pain, volume.
      const weekAgoIso = new Date(cut).toISOString().slice(0, 10);
      const todayIso = new Date().toISOString().slice(0, 10);
      const outcomes = await loadPlanOutcomes(supabase, weekAgoIso, todayIso, todayIso);
      const settled = outcomes.ok ? outcomes.data.filter((o) => o.outcome !== 'pending') : [];
      const mealAdherencePct = settled.length > 0
        ? (settled.filter((o) => o.outcome === 'as_planned').length / settled.length) * 100
        : null;
      const rirAvg = async (fromDaysAgo: number, toDaysAgo: number) => {
        const from = new Date(Date.now() - fromDaysAgo * 86_400_000).toISOString();
        const to = new Date(Date.now() - toDaysAgo * 86_400_000).toISOString();
        const r = await supabase
          .from('basalt_set_entries')
          .select('rir')
          .not('rir', 'is', null)
          .gte('completed_at', from)
          .lt('completed_at', to);
        const vals = (r.data ?? []).map((x: any) => Number(x.rir));
        return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
      };
      const [thisWeekAvg, lastWeekAvg, pain, volume] = await Promise.all([
        rirAvg(7, 0), rirAvg(14, 7), loadPainSummary(supabase), loadVolumeProposals(supabase),
      ]);
      setCheckin(
        fullWeeklyCheckin({
          targetRatePct: template.ratePctPerWeek,
          observedRatePct,
          currentCalories: targets?.calories ?? 0,
          sessionsPlanned: template.trainingDays.length,
          sessionsDone: done,
          mealAdherencePct,
          rirTrend: { thisWeekAvg, lastWeekAvg },
          painFlags: pain.ok ? pain.data.totalFlags : 0,
          waistCm: null,
          volumeProposalReason: volume[0]?.reason ?? null,
        }),
      );
    })();
  }, [targets?.calories]);
  useEffect(refresh, [refresh]);

  const start = async (id: string) => {
    const t = programmeTemplate(id);
    if (!t) return;
    const r = await startProgram(supabase, t.trainingDays, isoDay(new Date()), {
      id: t.id, weeks: t.weeks, ratePct: t.ratePctPerWeek,
    });
    if (r.ok) refresh();
    else Alert.alert('Not started', r.error);
  };

  const answer = async (accept: boolean) => {
    await AsyncStorage.setItem(CHECKIN_KEY, new Date().toISOString());
    const p = checkin?.proposal;
    if (accept && p && p.kind === 'adjust' && 'deltaKcal' in p && targets) {
      const saved = await saveTargets(supabase, {
        ...targets,
        calories: targets.calories + p.deltaKcal,
        reason: `Programme check-in — ${p.reason}`,
      });
      if (saved.ok) await refreshCore();
    }
    setCheckin(null);
  };

  const template = program?.templateId ? programmeTemplate(program.templateId) : null;
  const week = program && template ? programmeWeek(program.startedOn, template.weeks, new Date()) : null;
  const corridor = template && startWeight && week ? corridorFor(startWeight, template.ratePctPerWeek, week) : null;

  return (
    <Card>
      <ReceiptHeader
        label="Programme"
        summary={template && week ? `${template.title} · week ${week} of ${template.weeks}` : undefined}
      />
      {!program || !template ? (
        <>
          <EmptyState>
            A programme is a stated block: structure, length, and a nutrition stance — with a weekly
            check-in that proposes exactly one thing.
          </EmptyState>
          <Pressable onPress={() => setGenerating(true)} hitSlop={8}>
            <ReceiptRow
              name="Build my programme"
              meta="generated from your intake — equipment, days, minutes, limitations; every rule shown, every slot swappable"
              value="build →"
              valueColor={theme.text.carbs}
            />
          </Pressable>
          {PROGRAMME_TEMPLATES.map((t, i) => (
            <Pressable key={t.id} onPress={() => void start(t.id)} hitSlop={8}>
              <ReceiptRow name={t.title} meta={t.oneLiner} value="start →" valueColor={theme.text.faint} last={i === PROGRAMME_TEMPLATES.length - 1} />
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <View style={styles.weekStrip}>
            {Array.from({ length: template.weeks }, (_, i) => i + 1).map((w) => (
              <Text
                key={w}
                style={[
                  styles.weekCell,
                  { color: week === w ? theme.text.carbs : w < (week ?? 0) ? theme.text.mute : theme.text.faint },
                ]}
              >
                {`W${w}`}
              </Text>
            ))}
          </View>
          {corridor ? (
            <ReceiptRow
              name="Trend corridor"
              meta={
                trendNow
                  ? `trend ${trendNow} kg — ${trendNow >= corridor.low && trendNow <= corridor.high ? 'inside' : trendNow > corridor.high ? 'above' : 'below'} this week's band`
                  : 'weigh in 3+ times for a trend'
              }
              value={`${corridor.low}–${corridor.high}`}
              unit="kg"
            />
          ) : null}
          {checkin ? (
            <View style={[styles.proposal, { borderColor: theme.surfaces.border }]}>
              <Text style={[styles.proposalKind, { color: theme.text.mute }]}>
                {`WEEKLY CHECK-IN — ${checkin.proposal.kind.replace(/-/g, ' ').toUpperCase()}`}
              </Text>
              {checkin.report.map((line) => (
                <Text key={line.slice(0, 28)} style={[styles.reportLine, { color: theme.text.faint }]}>{line}</Text>
              ))}
              <Text style={[styles.proposalText, { color: theme.text.ink2 }]}>{checkin.proposal.reason}</Text>
              <View style={styles.proposalRow}>
                <Pressable onPress={() => void answer(true)} hitSlop={10} accessibilityRole="button">
                  <Text style={[styles.proposalBtn, { color: theme.text.carbs }]}>
                    {checkin.proposal.kind === 'adjust' ? 'ACCEPT' : 'NOTED'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void answer(false)} hitSlop={10} accessibilityRole="button">
                  <Text style={[styles.proposalBtn, { color: theme.text.faint }]}>IGNORE</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <ExtraSlot id="social">
            <Pressable
              onPress={() => {
                const remainingDays = Math.min(31, (template.weeks - (week ?? 1) + 1) * 7);
                void createChallenge(supabase, {
                  kind: 'sessions',
                  startsOn: isoDay(new Date()),
                  endsOn: isoDay(new Date(Date.now() + remainingDays * 86_400_000)),
                  displayName: 'me',
                }).then((r) =>
                  Alert.alert(
                    'Share as challenge',
                    r.ok ? 'Created — friends can join from Trends. Only session counts are shared, never food or weight.' : r.message ?? 'Could not create it.',
                  ),
                );
              }}
              hitSlop={8}
            >
              <Text style={[styles.share, { color: theme.text.faint }]}>SHARE AS A SESSIONS CHALLENGE →</Text>
            </Pressable>
          </ExtraSlot>
          <Pressable onPress={() => void stopProgram(supabase).then(refresh)} hitSlop={8}>
            <Text style={[styles.share, { color: theme.text.faint }]}>STOP PROGRAMME</Text>
          </Pressable>
          <SrcNote>{`${template.oneLiner} · ${CORRIDOR_EXPLAINER}`}</SrcNote>
        </>
      )}
      <GenerateProgrammeSheet
        open={generating}
        onClose={() => setGenerating(false)}
        onKept={() => {
          setGenerating(false);
          refresh();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  weekStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 6 },
  weekCell: { fontFamily: mono, fontSize: 12 },
  proposal: { borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 8 },
  proposalKind: { fontFamily: mono, fontSize: 10.5, letterSpacing: 1, marginBottom: 6 },
  proposalText: { fontSize: 13, lineHeight: 19 },
  reportLine: { fontSize: 11.5, lineHeight: 16, marginBottom: 2 },
  proposalRow: { flexDirection: 'row', gap: 22, marginTop: 8 },
  proposalBtn: { fontFamily: mono, fontSize: 12, letterSpacing: 1, paddingVertical: 10 },
  share: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, textAlign: 'center', paddingVertical: 10 },
});
