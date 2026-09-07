import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, EmptyState, ReceiptHeader, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  PLAN_DISCLAIMER, computePlan, trendWeightKg, type BiologicalSex, type NutritionPlan, type PlanRange,
} from '@basalt/nutrition';
import { listWeightEntries, saveTargets, type ProfileRecord, type TargetsRecord } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';

// Profile & Targets — the Nutrition plan card (V4 Phase 6a, core).
// Placement decision (recorded in V4-REPORT): directly under the Profile
// card in Settings, where every input it reads is edited.
//
// Every number is a range from a published formula; the active target sits
// beside its computed range and can be overridden — the range never
// disappears. Rails render in words. Under-18 sees the gate, not a plan.

export const PLAN_RATE_KEY = 'basalt.planRatePct';
const RATE_CHOICES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5] as const;

function ageFrom(profile: ProfileRecord): number | null {
  if (profile.birthdate) {
    const b = new Date(profile.birthdate);
    if (!Number.isNaN(b.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age -= 1;
      return age;
    }
  }
  return profile.ageYears;
}

const fmtRange = (r: PlanRange, unit: string) =>
  `${r.low.toLocaleString('en-US')}–${r.high.toLocaleString('en-US')} ${unit}`;

export function PlanCard() {
  const { theme } = useTheme();
  const profile = useAppStore((s) => s.profile);
  const targets = useAppStore((s) => s.targets);
  const refreshCore = useAppStore((s) => s.refreshCore);
  const [ratePct, setRatePct] = useState(0);
  const [weightUsed, setWeightUsed] = useState<{ kg: number; label: string } | null>(null);
  const [editing, setEditing] = useState<null | { field: 'calories' | 'proteinG' | 'carbsG' | 'fatG'; value: string }>(null);

  useEffect(() => {
    void AsyncStorage.getItem(PLAN_RATE_KEY).then((raw) => {
      const n = Number(raw);
      if (raw !== null && (RATE_CHOICES as readonly number[]).includes(n)) setRatePct(n);
    });
  }, []);

  const loadWeight = useCallback(() => {
    void listWeightEntries(supabase, 30).then((r) => {
      if (!r.ok || r.data.length === 0) {
        setWeightUsed(null);
        return;
      }
      const trend = trendWeightKg(r.data.map((w) => ({ date: w.measuredAt.slice(0, 10), kg: w.weightKg })));
      if (trend) {
        setWeightUsed({ kg: trend.kg, label: `7-day trend of ${trend.readings} weigh-ins` });
      } else {
        const latest = r.data[r.data.length - 1]!;
        setWeightUsed({ kg: latest.weightKg, label: 'latest weigh-in — weigh in 3+ times in a week for a trend' });
      }
    });
  }, []);
  useEffect(loadWeight, [loadWeight]);

  if (!profile) return null;
  const age = ageFrom(profile);
  const sex = (profile.biologicalSex ?? 'prefer_not_to_say') as BiologicalSex;
  const ready = weightUsed && profile.heightCm && age !== null && profile.activityLevel;

  const plan: NutritionPlan | null = ready
    ? computePlan({
        sex,
        weightKg: weightUsed.kg,
        heightCm: profile.heightCm!,
        age: age!,
        activityLevel: profile.activityLevel!,
        ratePctPerWeek: ratePct,
      })
    : null;

  const pickRate = async (pct: number) => {
    setRatePct(pct);
    await AsyncStorage.setItem(PLAN_RATE_KEY, String(pct));
  };

  const applyPlan = async () => {
    if (!plan || plan.gated) return;
    const mid = (r: PlanRange) => Math.round((r.low + r.high) / 2);
    const saved = await saveTargets(supabase, {
      calories: mid(plan.energy),
      proteinG: mid(plan.proteinG),
      carbsG: mid(plan.carbsG),
      fatG: mid(plan.fatG),
      fiberG: plan.fiberG,
      sugarCapG: plan.sugarCapG,
      sodiumCapMg: plan.sodiumCapMg,
      waterMl: plan.waterMl,
      steps: targets?.steps ?? null,
      sleepMin: targets?.sleepMin ?? null,
      reason: `Plan midpoints — Mifflin-St Jeor ±10% × activity, ${ratePct === 0 ? 'maintain' : `${ratePct > 0 ? '+' : ''}${ratePct}%/wk`}, protein 1.6–2.2 g/kg, fat 20–35%`,
    });
    if (saved.ok) {
      await refreshCore();
      Alert.alert('Plan applied', 'Targets set to the range midpoints — the ranges stay visible here.');
    } else {
      Alert.alert('Not applied', saved.error);
    }
  };

  const saveOverride = async () => {
    if (!editing || !targets) return;
    const n = Number(editing.value);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Not saved', 'Give it a positive number.');
      return;
    }
    const next: Omit<TargetsRecord, 'effectiveDate'> = {
      ...targets,
      [editing.field]: Math.round(n),
      reason: `Custom override — computed ranges stay visible in the Nutrition plan`,
    };
    const saved = await saveTargets(supabase, next);
    if (saved.ok) await refreshCore();
    setEditing(null);
  };

  const row = (
    name: string,
    range: string,
    field: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | null,
    active?: number | null,
    unit?: string,
  ) => (
    <Pressable
      key={name}
      disabled={!field || !targets}
      onPress={() => field && targets && setEditing({ field, value: String(targets[field]) })}
      hitSlop={6}
    >
      <View style={styles.row}>
        <Text style={[styles.rowName, { color: theme.text.ink2 }]}>{name}</Text>
        <View style={styles.rowRight}>
          <Text style={[styles.rowRange, { color: theme.text.mute }]}>{range}</Text>
          {active !== null && active !== undefined ? (
            <Text style={[styles.rowActive, { color: theme.text.carbs }]}>{`now ${active.toLocaleString('en-US')}${unit ?? ''}`}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  return (
    <Card>
      <ReceiptHeader label="Nutrition plan" summary="every number a range · published formulas" />
      {!ready ? (
        <EmptyState>
          {weightUsed
            ? 'Needs height, age and activity level from your profile above.'
            : 'Needs a weigh-in — the plan uses your 7-day trend weight, never a single reading.'}
        </EmptyState>
      ) : plan && plan.gated ? (
        <EmptyState>{plan.reason}</EmptyState>
      ) : plan ? (
        <>
          <View style={styles.rateRow}>
            <Text style={[styles.rateLabel, { color: theme.text.faint }]}>RATE</Text>
            {RATE_CHOICES.map((pct) => (
              <Pressable key={pct} onPress={() => void pickRate(pct)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.rateChip, { color: ratePct === pct ? theme.text.carbs : theme.text.faint }]}>
                  {pct === 0 ? 'hold' : `${pct > 0 ? '+' : ''}${pct}%`}
                </Text>
              </Pressable>
            ))}
          </View>
          {plan.rate.capped && plan.rate.capReason ? (
            <Text style={[styles.rail, { color: theme.text.fat }]}>{plan.rate.capReason}</Text>
          ) : null}
          {row('Energy', fmtRange(plan.energy, 'kcal'), 'calories', targets?.calories, ' kcal')}
          {plan.floor.applied ? <Text style={[styles.rail, { color: theme.text.fat }]}>{plan.floor.reason}</Text> : null}
          {row('Protein', fmtRange(plan.proteinG, 'g'), 'proteinG', targets?.proteinG, ' g')}
          {row('Fat', fmtRange(plan.fatG, 'g'), 'fatG', targets?.fatG, ' g')}
          {row('Carbohydrate', fmtRange(plan.carbsG, 'g'), 'carbsG', targets?.carbsG, ' g')}
          {row('Fibre', `${plan.fiberG} g`, null)}
          {row('Sugar cap', `${plan.sugarCapG} g`, null)}
          {row('Sodium cap', `${plan.sodiumCapMg.toLocaleString('en-US')} mg`, null)}
          {row('Water', `${plan.waterMl.toLocaleString('en-US')} ml`, null)}
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                value={editing.value}
                onChangeText={(v) => setEditing({ ...editing, value: v })}
                keyboardType="numeric"
                autoFocus
                style={[styles.editInput, { color: theme.text.ink, borderColor: theme.surfaces.border }]}
                accessibilityLabel="Custom target value"
              />
              <Pressable onPress={() => void saveOverride()} hitSlop={10}>
                <Text style={[styles.editBtn, { color: theme.text.carbs }]}>SET CUSTOM</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(null)} hitSlop={10}>
                <Text style={[styles.editBtn, { color: theme.text.faint }]}>CANCEL</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={() => void applyPlan()} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.apply, { color: theme.text.carbs }]}>APPLY MIDPOINTS AS TARGETS →</Text>
          </Pressable>
          <SrcNote>
            {`Weight: ${weightUsed.kg} kg (${weightUsed.label}) · Mifflin-St Jeor ±10% × activity · protein 1.6–2.2 g/kg · fat 20–35% · carbs the remainder · fibre 14 g/1,000 kcal · sugar <10% · sodium <2,300 mg · water by weight · tap a row for a custom value — the range stays. ${PLAN_DISCLAIMER}`}
          </SrcNote>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 10, minHeight: 40 },
  rowName: { fontSize: 13.5 },
  rowRight: { alignItems: 'flex-end' },
  rowRange: { fontFamily: mono, fontSize: 12.5 },
  rowActive: { fontFamily: mono, fontSize: 10.5, marginTop: 1 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 4, minHeight: 40 },
  rateLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.1 },
  rateChip: { fontFamily: mono, fontSize: 12.5, paddingVertical: 10 },
  rail: { fontSize: 11.5, lineHeight: 16, marginVertical: 4 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  editInput: { flex: 1, borderBottomWidth: 1, paddingVertical: 6, fontFamily: mono, fontSize: 13.5 },
  editBtn: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, paddingVertical: 12 },
  apply: { fontFamily: mono, fontSize: 12, letterSpacing: 0.9, textAlign: 'center', paddingVertical: 12 },
});
