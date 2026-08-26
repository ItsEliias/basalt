import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  color, mono, CTA, ObDots, ObQuestion, ObSub, ObOption, ObInput, ObInRow,
  ObChipLabel, ObNote, ChipRow, ChipGroup, useTheme,
} from '@basalt/ui';
import { saveProfile, saveTargets, addWeightEntry } from '@basalt/core-data';
import { computeTargets } from '@basalt/nutrition';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import {
  initialState, nextStep, prevStep, buildProfile, buildTargetInput, weightKgFrom,
  TOTAL_STEPS, GOAL_OPTIONS, SEX_OPTIONS, UNIT_OPTIONS, CONDITION_OPTIONS,
  MEDICATION_OPTIONS, HABIT_ROWS, ALLERGY_OPTIONS, DIET_OPTIONS, PLACE_OPTIONS,
  EQUIPMENT_OPTIONS, JOB_OPTIONS, EXERCISE_OPTIONS, SLEEP_OPTIONS, STRESS_OPTIONS,
  MOTIVATION_OPTIONS, CHECKIN_OPTIONS, isImperial, type OnboardingState,
} from './model';

// The 8-step intake (prototype v11.1). Every step skippable, everything
// editable later, no paywall anywhere near here. The CTA is a fixed footer —
// its reachability contract lives in layout.ts and is regression-tested.

export function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const refreshCore = useAppStore((s) => s.refreshCore);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<OnboardingState>) => setState((s) => ({ ...s, ...p }));
  const toggle = (key: 'goals' | 'conditions' | 'medications' | 'allergies' | 'diets' | 'equipment' | 'motivations', value: string) =>
    setState((s) => {
      const list = s[key] as string[];
      return { ...s, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] } as OnboardingState;
    });

  const finish = async (skipped: boolean) => {
    setBusy(true);
    setError(null);
    const profile = skipped ? { useMetric: true } : buildProfile(state);
    const saved = await saveProfile(supabase, profile);
    if (!saved.ok) {
      setError(saved.error);
      setBusy(false);
      return;
    }
    if (!skipped) {
      const targetInput = buildTargetInput(state);
      if (targetInput) {
        const t = computeTargets(targetInput);
        const st = await saveTargets(supabase, {
          calories: t.calories, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG,
          fiberG: t.fiberG, sugarCapG: t.sugarCapG, sodiumCapMg: t.sodiumCapMg,
          waterMl: t.waterMl, steps: t.steps, sleepMin: t.sleepMin,
          reason: t.explanation,
        });
        if (!st.ok) {
          setError(st.error);
          setBusy(false);
          return;
        }
        const kg = weightKgFrom(state);
        if (kg) await addWeightEntry(supabase, kg, { source: 'onboarding' });
      }
    }
    await refreshCore();
    setBusy(false);
  };

  const single = (value: string | null, onChange: (v: string) => void, options: readonly string[]) => (
    <ChipRow options={[...options]} value={value ?? undefined} onChange={onChange} />
  );

  const stepBody = () => {
    switch (step) {
      case 1:
        return (
          <>
            <ObQuestion>First, the basics.</ObQuestion>
            <ObSub>Everything here has one job: making your targets and plans actually fit you. Every answer is editable later, and any question can be skipped.</ObSub>
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              <ObInput placeholder="Name" value={state.name} onChangeText={(name) => patch({ name })} />
              <ObInRow>
                <ObInput placeholder="Age" keyboardType="number-pad" value={state.age} onChangeText={(age) => patch({ age })} />
                <ObInput placeholder={isImperial(state) ? 'Height (in)' : 'Height (cm)'} keyboardType="decimal-pad" value={state.height} onChangeText={(height) => patch({ height })} />
              </ObInRow>
              <ObInRow>
                <ObInput placeholder={isImperial(state) ? 'Weight (lb)' : 'Weight (kg)'} keyboardType="decimal-pad" value={state.weight} onChangeText={(weight) => patch({ weight })} />
                <ObInput placeholder="Goal weight (optional)" keyboardType="decimal-pad" value={state.goalWeight} onChangeText={(goalWeight) => patch({ goalWeight })} />
              </ObInRow>
              <ObChipLabel>Sex — used only for the energy formula</ObChipLabel>
              {single(state.sex, (sex) => patch({ sex }), SEX_OPTIONS)}
              <ObChipLabel>Units</ObChipLabel>
              {single(state.units, (units) => patch({ units }), UNIT_OPTIONS)}
            </ScrollView>
          </>
        );
      case 2:
        return (
          <>
            <ObQuestion>What are you here for?</ObQuestion>
            <ObSub>Pick as many as apply — the targets balance them. Some pairs pull in opposite directions (lose weight + build muscle leans the plan toward recomposition; we'll say so, not hide it).</ObSub>
            <ScrollView style={styles.scroll}>
              {GOAL_OPTIONS.map((g) => (
                <ObOption
                  key={g.key}
                  title={g.title}
                  subtitle={g.sub}
                  multi
                  on={state.goals.includes(g.key)}
                  onPress={() => toggle('goals', g.key)}
                />
              ))}
            </ScrollView>
          </>
        );
      case 3:
        return (
          <>
            <ObQuestion>Anything we should work around?</ObQuestion>
            <ObSub>Not medical advice — this biases exercise selection and flags, nothing more. Skip freely.</ObSub>
            <ScrollView style={styles.scroll}>
              <ChipGroup options={CONDITION_OPTIONS} values={state.conditions} onToggle={(v) => toggle('conditions', v)} />
              <ObChipLabel>Medication that affects weight or appetite — optional</ObChipLabel>
              <ChipGroup options={MEDICATION_OPTIONS} values={state.medications} onToggle={(v) => toggle('medications', v)} />
              <ObNote>Injuries bias the exercise library · conditions & medications enable relevant logging and adjust target expectations — never shown unless you enable them · stored privately, never shared</ObNote>
            </ScrollView>
          </>
        );
      case 4:
        return (
          <>
            <ObQuestion>Eating & drinking, honestly.</ObQuestion>
            <ObSub>No judgement — the targets only work if they're built on your real week, not your ideal one.</ObSub>
            <ScrollView style={styles.scroll}>
              {HABIT_ROWS.map((row) => (
                <View key={row.key}>
                  <ObChipLabel>{row.label}</ObChipLabel>
                  {single(state.habits[row.key] ?? null, (v) => patch({ habits: { ...state.habits, [row.key]: v } }), row.options)}
                </View>
              ))}
            </ScrollView>
          </>
        );
      case 5:
        return (
          <>
            <ObQuestion>Dietary requirements</ObQuestion>
            <ObSub>Scanned products and imported recipes get checked against these, ingredient by ingredient. Conflicts are flagged with a swap — never hidden.</ObSub>
            <ScrollView style={styles.scroll}>
              <ObChipLabel>Allergies & intolerances</ObChipLabel>
              <ChipGroup options={ALLERGY_OPTIONS} values={state.allergies} onToggle={(v) => toggle('allergies', v)} />
              <ObChipLabel>Diet & belief</ObChipLabel>
              <ChipGroup options={DIET_OPTIONS} values={state.diets} onToggle={(v) => toggle('diets', v)} />
            </ScrollView>
          </>
        );
      case 6:
        return (
          <>
            <ObQuestion>Where do you train?</ObQuestion>
            <ObSub>Plans and the exercise library are built around what's actually available to you.</ObSub>
            <ScrollView style={styles.scroll}>
              {PLACE_OPTIONS.map((p) => (
                <ObOption
                  key={p.key}
                  title={p.title}
                  subtitle={p.sub}
                  on={state.place === p.key}
                  onPress={() => patch({ place: p.key })}
                />
              ))}
            </ScrollView>
          </>
        );
      case 7:
        return (
          <>
            <ObQuestion>What's at home?</ObQuestion>
            <ObSub>Home sessions will only ever prescribe movements you can actually do. Change this any time — or add a second location later.</ObSub>
            <ScrollView style={styles.scroll}>
              <ChipGroup options={EQUIPMENT_OPTIONS} values={state.equipment} onToggle={(v) => toggle('equipment', v)} />
              <ObNote>873-movement library filters to this automatically · gym days ignore it · "train quietly" (no jumps) available per session</ObNote>
            </ScrollView>
          </>
        );
      case 8:
        return (
          <>
            <ObQuestion>Your life, roughly.</ObQuestion>
            <ObSub>Last one. Activity outside training changes your energy needs more than most workouts do.</ObSub>
            <ScrollView style={styles.scroll}>
              <ObChipLabel>Your days are mostly…</ObChipLabel>
              {single(state.job, (job) => patch({ job }), JOB_OPTIONS)}
              <ObChipLabel>Currently exercising</ObChipLabel>
              {single(state.exercising, (exercising) => patch({ exercising }), EXERCISE_OPTIONS)}
              <ObChipLabel>Usual sleep</ObChipLabel>
              {single(state.sleep, (sleep) => patch({ sleep }), SLEEP_OPTIONS)}
              <ObChipLabel>Stress lately</ObChipLabel>
              {single(state.stress, (stress) => patch({ stress }), STRESS_OPTIONS)}
              <ObChipLabel>What's driving this? — helps us talk to you right</ObChipLabel>
              <ChipGroup options={MOTIVATION_OPTIONS} values={state.motivations} onToggle={(v) => toggle('motivations', v)} />
              <ObChipLabel>How should we check in?</ObChipLabel>
              {single(state.checkin, (checkin) => patch({ checkin }), CHECKIN_OPTIONS)}
              <ObNote>Output · daily targets for energy, protein, carbs, fat, fibre, sugar cap, sodium cap, water, steps & sleep · seeded from all of the above, then recalibrated weekly from your actual weight trend</ObNote>
            </ScrollView>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topRow}>
        <Pressable onPress={() => step > 1 && setStep(prevStep(step, state))} hitSlop={10}>
          <Text style={styles.brand}>{step > 1 ? '← BASALT' : 'BASALT'}</Text>
        </Pressable>
        <Pressable onPress={() => finish(true)} hitSlop={10} disabled={busy}>
          <Text style={styles.skip}>SKIP — SET UP LATER</Text>
        </Pressable>
      </View>
      <ObDots total={TOTAL_STEPS} current={step} />

      <View style={styles.step}>{stepBody()}</View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={[styles.footer, { paddingBottom: Math.max(34, insets.bottom + 12) }]}>
        <CTA
          label={busy ? '…' : step === TOTAL_STEPS ? 'Build my targets' : 'Continue'}
          disabled={busy}
          onPress={() => (step === TOTAL_STEPS ? void finish(false) : setStep(nextStep(step, state)))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42, color: color.ink },
  skip: { fontFamily: mono, fontSize: 11, letterSpacing: 1, color: color.faint },
  step: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, marginTop: 16, marginBottom: 10 },
  error: { fontSize: 12.5, color: color.fat, lineHeight: 18 },
  footer: {},
});
