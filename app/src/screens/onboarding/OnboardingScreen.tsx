import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mono, CTA, ObDots, ObQuestion, ObSub, ObOption, ObInput, ObInRow, ObChipLabel, ObNote, ChipRow, ChipGroup, useTheme, ScaledText as Text, type ThemeId } from '@basalt/ui';
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
  CORE_STEPS, extraScreenAt,
  EXPERIENCE_OPTIONS, DAYS_PER_WEEK_OPTIONS, SESSION_MINUTES_OPTIONS, WEEKDAY_LABELS,
  MEALS_PER_DAY_OPTIONS, COOKING_OPTIONS, MEDICAL_LINE,
} from './model';
import { DETAIL_OPTIONS } from '../../lib/detailModel';
import { ExtrasStep } from '../../components/ExtrasIntro';
import { markExtrasIntroSeen } from '../../lib/extras';
import { ThemePickerList, TodayMiniPreview } from '../settings/ThemePicker';
import { PromiseScreen } from '../../components/PromiseScreen';
import { selectTheme, SAMPLE_PREVIEW, type PickerState } from '../settings/themePickerModel';
import { loadExpressiveFonts } from '../../lib/expressiveFonts';
import { THEME_IDS } from '@basalt/ui';

// The 11-step PT intake (prototype v11.1 + V3.4 theme + V4 Phase 8a
// experience/schedule/inventory-with-weights additions). Every step
// skippable, everything editable later, no paywall anywhere near here. The
// CTA is a fixed footer — its reachability contract lives in layout.ts and
// is regression-tested.

export function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const refreshCore = useAppStore((s) => s.refreshCore);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promiseOpen, setPromiseOpen] = useState(false);

  // The theme step's previews need the expressive typefaces registered.
  useEffect(() => {
    if (step === CORE_STEPS - 1) for (const id of THEME_IDS) void loadExpressiveFonts(id);
  }, [step]);

  const patch = (p: Partial<OnboardingState>) => setState((s) => ({ ...s, ...p }));
  const toggle = (key: 'goals' | 'conditions' | 'medications' | 'allergies' | 'diets' | 'equipment' | 'motivations', value: string) =>
    setState((s) => {
      const list = s[key] as string[];
      return { ...s, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] } as OnboardingState;
    });

  const finishWithExtras = async () => {
    await finish(false);
  };

  const finish = async (skipped: boolean) => {
    setBusy(true);
    // Either way the extras were offered (or deliberately skipped) — the
    // returning-user "New in Basalt" flow must never replay after this.
    await markExtrasIntroSeen();
    setError(null);
    const profile = skipped ? { useMetric: true } : buildProfile(state);
    const saved = await saveProfile(supabase, profile);
    if (!saved.ok) {
      console.error('saveProfile failed:', saved.error);
      setError("Couldn't save your profile — check your connection and try again.");
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
          console.error('saveTargets failed:', st.error);
          setError("Couldn't save your targets — check your connection and try again.");
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
              <ObInput placeholder={isImperial(state) ? 'Waist (in) — optional' : 'Waist (cm) — optional'} keyboardType="decimal-pad" value={state.waist} onChangeText={(waist) => patch({ waist })} />
              <ObChipLabel>Sex — used only for the energy formula</ObChipLabel>
              {single(state.sex, (sex) => patch({ sex }), SEX_OPTIONS)}
              <ObChipLabel>Units</ObChipLabel>
              {single(state.units, (units) => patch({ units }), UNIT_OPTIONS)}
              <Pressable onPress={() => setPromiseOpen(true)} hitSlop={10} accessibilityRole="button">
                <Text style={[styles.promiseLink, { color: theme.text.faint }]}>WHAT BASALT DOES AND DOESN'T DO →</Text>
              </Pressable>
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
            <ObQuestion>How long have you trained?</ObQuestion>
            <ObSub>This sets rep ranges, how conservative the starting loads are, and how much the app explains along the way. No wrong answer.</ObSub>
            <ScrollView style={styles.scroll}>
              {EXPERIENCE_OPTIONS.map((e) => (
                <ObOption
                  key={e.key}
                  title={e.title}
                  subtitle={e.sub}
                  on={state.experience === e.key}
                  onPress={() => patch({ experience: e.key })}
                />
              ))}
            </ScrollView>
          </>
        );
      case 4:
        return (
          <>
            <ObQuestion>Anything we should work around?</ObQuestion>
            <ObSub>Not medical advice — this biases exercise selection and flags, nothing more. Skip freely.</ObSub>
            <ScrollView style={styles.scroll}>
              <ChipGroup options={CONDITION_OPTIONS} values={state.conditions} onToggle={(v) => toggle('conditions', v)} />
              <ObChipLabel>Medication that affects weight or appetite — optional</ObChipLabel>
              <ChipGroup options={MEDICATION_OPTIONS} values={state.medications} onToggle={(v) => toggle('medications', v)} />
              <ObChipLabel>Anything else, in your own words — optional</ObChipLabel>
              <ObInput placeholder="e.g. left knee dislikes deep squats" value={state.limitationNote} onChangeText={(limitationNote) => patch({ limitationNote })} />
              <ObNote>{MEDICAL_LINE}</ObNote>
              <ObNote>Injuries bias the exercise library · conditions & medications enable relevant logging and adjust target expectations — never shown unless you enable them · stored privately, never shared</ObNote>
            </ScrollView>
          </>
        );
      case 5:
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
      case 6:
        return (
          <>
            <ObQuestion>Dietary requirements</ObQuestion>
            <ObSub>Scanned products and imported recipes get checked against these, ingredient by ingredient. Conflicts are flagged with a swap — never hidden.</ObSub>
            <ScrollView style={styles.scroll}>
              <ObChipLabel>Allergies & intolerances</ObChipLabel>
              <ChipGroup options={ALLERGY_OPTIONS} values={state.allergies} onToggle={(v) => toggle('allergies', v)} />
              <ObChipLabel>Diet & belief</ObChipLabel>
              <ChipGroup options={DIET_OPTIONS} values={state.diets} onToggle={(v) => toggle('diets', v)} />
              <ObChipLabel>Foods you just don't want — comma-separated</ObChipLabel>
              <ObInput placeholder="e.g. mushrooms, olives" value={state.dislikes} onChangeText={(dislikes) => patch({ dislikes })} />
              <ObChipLabel>Meals a day</ObChipLabel>
              {single(state.mealsPerDay, (mealsPerDay) => patch({ mealsPerDay }), MEALS_PER_DAY_OPTIONS)}
              <ObChipLabel>Cooking time</ObChipLabel>
              <ChipRow
                options={COOKING_OPTIONS.map((c) => c.label)}
                value={COOKING_OPTIONS.find((c) => c.key === state.cookingTime)?.label}
                onChange={(label) => patch({ cookingTime: COOKING_OPTIONS.find((c) => c.label === label)?.key ?? null })}
              />
            </ScrollView>
          </>
        );
      case 7:
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
      case 8:
        return (
          <>
            <ObQuestion>What's at home?</ObQuestion>
            <ObSub>Home sessions will only ever prescribe movements you can actually do. Change this any time — or add a second location later.</ObSub>
            <ScrollView style={styles.scroll}>
              <ChipGroup options={EQUIPMENT_OPTIONS} values={state.equipment} onToggle={(v) => toggle('equipment', v)} />
              {state.equipment.some((e) => e.toLowerCase().includes('dumbbell')) ? (
                <ObInput placeholder="Heaviest dumbbell pair (kg) — needed to pick loads" keyboardType="decimal-pad" value={state.dumbbellMaxKg} onChangeText={(dumbbellMaxKg) => patch({ dumbbellMaxKg })} />
              ) : null}
              {state.equipment.includes('Kettlebell') ? (
                <ObInput placeholder="Kettlebell weight (kg)" keyboardType="decimal-pad" value={state.kettlebellKg} onChangeText={(kettlebellKg) => patch({ kettlebellKg })} />
              ) : null}
              <ObNote>873-movement library filters to this automatically · gym days ignore it · "train quietly" (no jumps) available per session · "dumbbells" without a weight can't pick a load — that's why we ask</ObNote>
            </ScrollView>
          </>
        );
      case 9:
        return (
          <>
            <ObQuestion>When can you actually train?</ObQuestion>
            <ObSub>The programme is built for the week you have, not the week you wish you had. Fewer honest days beat six imaginary ones.</ObSub>
            <ScrollView style={styles.scroll}>
              <ObChipLabel>Days a week</ObChipLabel>
              {single(state.daysPerWeek, (daysPerWeek) => patch({ daysPerWeek }), DAYS_PER_WEEK_OPTIONS)}
              <ObChipLabel>Minutes a session</ObChipLabel>
              {single(state.sessionMinutes, (sessionMinutes) => patch({ sessionMinutes }), SESSION_MINUTES_OPTIONS)}
              <ObChipLabel>Which days — optional</ObChipLabel>
              <ChipGroup
                options={WEEKDAY_LABELS}
                values={state.weekdays.map((d) => WEEKDAY_LABELS[d]!)}
                onToggle={(label) => {
                  const idx = WEEKDAY_LABELS.indexOf(label);
                  patch({ weekdays: state.weekdays.includes(idx) ? state.weekdays.filter((d) => d !== idx) : [...state.weekdays, idx] });
                }}
              />
              <ObNote>Sessions are trimmed to fit the minutes you pick — rest times are published, accessories go first</ObNote>
            </ScrollView>
          </>
        );
      case 10:
        return (
          <>
            <ObQuestion>Your life, roughly.</ObQuestion>
            <ObSub>Activity outside training changes your energy needs more than most workouts do.</ObSub>
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
      case 12: {
        // Detail level — three live previews from the theme picker's own
        // preview component, at three information densities.
        const chosen = (state.theme as ThemeId | null) ?? 'minimal';
        const detailPreview = (level: 'simple' | 'standard' | 'full'): typeof SAMPLE_PREVIEW => {
          if (level === 'simple') return { ...SAMPLE_PREVIEW, remaining: Math.round(SAMPLE_PREVIEW.remaining / 10) * 10, rows: SAMPLE_PREVIEW.rows.slice(0, 1) };
          return SAMPLE_PREVIEW;
        };
        return (
          <>
            <ObQuestion>How much detail?</ObQuestion>
            <ObSub>Same numbers underneath at every level — this only changes what's shown. Everything hidden stays one tap away, and you can change it any time in Settings › Display.</ObSub>
            <ScrollView style={styles.scroll}>
              {DETAIL_OPTIONS.map((o) => (
                <View key={o.key}>
                  <ObOption
                    title={`${o.title} — ${o.quote}`}
                    subtitle={o.key === 'simple' ? 'Energy left, protein, what you ate. The maths waits behind a tap.' : o.key === 'standard' ? 'The app as designed — every number with its source.' : 'Ranges inline, formulas printed, every component expanded.'}
                    on={state.detail === o.key}
                    onPress={() => patch({ detail: o.key })}
                  />
                  {state.detail === o.key ? <TodayMiniPreview id={chosen} data={detailPreview(o.key)} /> : null}
                </View>
              ))}
            </ScrollView>
          </>
        );
      }
      case 11: {
        const pickerState: PickerState = { selected: (state.theme as ThemeId | null) ?? null };
        return (
          <>
            <ObQuestion>How should it look?</ObQuestion>
            <ObSub>Previews use sample numbers. Minimal is the default — leave it, or pick one now. You can change this any time in Settings.</ObSub>
            <View style={styles.pickerWrap}>
              <ThemePickerList
                current="minimal"
                state={pickerState}
                data={SAMPLE_PREVIEW}
                onSelect={(id) => patch({ theme: selectTheme(pickerState, id, 'minimal').selected })}
              />
            </View>
          </>
        );
      }
      default: {
        const extra = extraScreenAt(step);
        if (extra) {
          return (
            <ExtrasStep
              screen={extra}
              onAnswered={() => (step === TOTAL_STEPS ? void finishWithExtras() : setStep(step + 1))}
            />
          );
        }
        return null;
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topRow}>
        <Pressable onPress={() => step > 1 && setStep(prevStep(step, state))} hitSlop={10}>
          <Text style={[styles.brand, { color: theme.text.ink }]}>{step > 1 ? '← BASALT' : 'BASALT'}</Text>
        </Pressable>
        <Pressable onPress={() => finish(true)} hitSlop={10} disabled={busy}>
          <Text style={[styles.skip, { color: theme.text.faint }]}>SKIP — SET UP LATER</Text>
        </Pressable>
      </View>
      <ObDots total={TOTAL_STEPS} current={step} />

      <View style={styles.step}>{stepBody()}</View>
      <PromiseScreen open={promiseOpen} onClose={() => setPromiseOpen(false)} />

      {error ? <Text style={[styles.error, { color: theme.text.fat }]}>{error}</Text> : null}
      <View style={[styles.footer, { paddingBottom: Math.max(34, insets.bottom + 12) }]}>
        <CTA
          label={busy ? '…'
            : step > CORE_STEPS ? 'Skip the extras — build my targets'
            : step === CORE_STEPS && TOTAL_STEPS === CORE_STEPS ? 'Build my targets'
            : 'Continue'}
          disabled={busy}
          onPress={() => {
            if (step > CORE_STEPS) { void finishWithExtras(); return; }
            if (step === CORE_STEPS && TOTAL_STEPS === CORE_STEPS) { void finish(false); return; }
            setStep(nextStep(step, state));
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42 },
  skip: { fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  step: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, marginTop: 16, marginBottom: 10 },
  pickerWrap: { flex: 1, marginTop: 12, marginHorizontal: -12 },
  error: { fontSize: 12.5, lineHeight: 18 },
  promiseLink: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, paddingVertical: 12 },
  footer: {},
});
