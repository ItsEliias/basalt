import type { ProfileRecord, PtIntake } from '@basalt/core-data';
import { onboardingExtraScreens } from '@basalt/core-data';
import type { GoalKey, TargetInput, ActivityLevel, BiologicalSex } from '@basalt/nutrition';

// Onboarding view-model — pure. Options are verbatim from the prototype
// (v11.1); mapping turns answers into the profile row + target-engine input.
// Every step is skippable and every answer is editable later in Settings.

export const GOAL_OPTIONS: { key: GoalKey; title: string; sub: string }[] = [
  { key: 'lose', title: 'Lose weight', sub: 'Steady deficit · protein protected' },
  { key: 'build', title: 'Build muscle', sub: 'Surplus · training-day emphasis' },
  { key: 'health', title: 'General health', sub: 'Fibre, sugar cap & movement focus' },
  { key: 'fitness', title: 'Fitness & endurance', sub: 'Cardio load + step targets' },
  { key: 'sleep', title: 'Sleep & recovery', sub: 'Sleep targets · recovery emphasis' },
  { key: 'refine', title: 'Refine · recomp', sub: 'Maintenance · tighter macro bands' },
];

export const SEX_OPTIONS = ['Female', 'Male', 'Intersex', 'Prefer not to say'] as const;
export const UNIT_OPTIONS = ['Metric — kg · cm', 'Imperial — lb · in'] as const;

export const CONDITION_OPTIONS = [
  'Nothing to note', 'High blood pressure', 'Type 1 diabetes', 'Type 2 diabetes',
  'Heart condition', 'Asthma', 'Pregnant', 'Postpartum', 'Shoulder injury',
  'Knee injury', 'Lower-back issues', 'Wrist issues', 'Hip issues',
  'Limited mobility', 'Recovering from surgery',
];
export const MEDICATION_OPTIONS = [
  'GLP-1 (Ozempic, Wegovy…)', 'Insulin', 'Thyroid medication', 'Other appetite-affecting', 'None / skip',
];

export const HABIT_ROWS: { key: HabitKey; label: string; options: string[] }[] = [
  { key: 'takeaway', label: 'Takeaway / eating out, per week', options: ['0–1', '2–3', '4–6', 'Most days'] },
  { key: 'alcohol', label: 'Alcohol', options: ['None', 'Social', 'Few nights a week', 'Daily'] },
  { key: 'sugaryDrinks', label: 'Sugary drinks', options: ['Rarely', 'Few a week', 'Daily'] },
  { key: 'cooks', label: 'Who cooks, mostly?', options: ['I do', 'Shared', 'Someone else', 'Mostly bought'] },
  { key: 'breakfast', label: 'Breakfast', options: ['Most days', 'Sometimes', 'Skip it'] },
  { key: 'smoking', label: 'Smoking / vaping', options: ['Neither', 'Vape', 'Smoke', 'Both', 'Quitting'] },
  { key: 'caffeine', label: 'Caffeine', options: ['None', '1–2 a day', '3–4', '5+'] },
];
export type HabitKey = 'takeaway' | 'alcohol' | 'sugaryDrinks' | 'cooks' | 'breakfast' | 'smoking' | 'caffeine';

export const ALLERGY_OPTIONS = [
  'Coeliac (strict GF)', 'Gluten sensitivity', 'Dairy free', 'Lactose intolerant',
  'Nut allergy', 'Peanut allergy', 'Shellfish', 'Fish', 'Egg', 'Soy', 'Sesame', 'Sulphites',
];
export const DIET_OPTIONS = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'Low FODMAP',
  'Keto / low carb', 'Diabetic-friendly', 'Low sodium',
];

export const PLACE_OPTIONS: { key: 'gym' | 'home' | 'both'; title: string; sub: string }[] = [
  { key: 'gym', title: 'Gym', sub: "Full equipment assumed — we'll skip the next step" },
  { key: 'home', title: 'Home', sub: "You'll pick your equipment next" },
  { key: 'both', title: 'Both', sub: 'Plans can mix gym and home days' },
];

export const EQUIPMENT_OPTIONS = [
  'Dumbbells', 'Adjustable dumbbells', 'Barbell + plates', 'Squat rack', 'Bench',
  'Resistance bands', 'Pull-up bar', 'Kettlebell', 'Cable tower', 'TRX / suspension',
  'Skipping rope', 'Yoga mat', 'Treadmill', 'Exercise bike', 'Rower', 'Bodyweight only',
];

export const JOB_OPTIONS = ['At a desk', 'On your feet', 'Physical work', 'Mixed'];
export const EXERCISE_OPTIONS = ['Not yet', '1–2× a week', '3–4×', '5+'];
export const SLEEP_OPTIONS = ['Under 6 h', '6–7 h', '7–8 h', '8 h+'];
export const STRESS_OPTIONS = ['Low', 'Medium', 'High'];
export const MOTIVATION_OPTIONS = [
  'Energy & feeling better', 'Health scare / doctor’s advice', 'Event coming up',
  'Confidence', 'Strength / performance', 'Just time',
];
export const CHECKIN_OPTIONS = ["Quiet — I'll open it", 'Weekly digest only', 'Daily reminder'];

// ── V4 Phase 8a — the PT-intake additions ──────────────────────────────

export const EXPERIENCE_OPTIONS: { key: NonNullable<PtIntake['experience']>; title: string; sub: string }[] = [
  { key: 'new', title: 'New to training', sub: 'Higher reps to learn movement · conservative loads · the app explains more' },
  { key: 'under1y', title: 'Under a year', sub: 'Building the base · steady double progression' },
  { key: '1to3y', title: '1–3 years', sub: 'Standard programming · fewer explanations' },
  { key: '3plus', title: '3+ years', sub: 'You know what RIR means · the app stays out of the way' },
];
export const DAYS_PER_WEEK_OPTIONS = ['1', '2', '3', '4', '5', '6'];
export const SESSION_MINUTES_OPTIONS = ['30', '45', '60', '75'];
export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const MEALS_PER_DAY_OPTIONS = ['2', '3', '4', '5'];
export const COOKING_OPTIONS: { key: NonNullable<NonNullable<PtIntake['diet']>['cookingTime']>; label: string }[] = [
  { key: 'quick', label: 'Quick — 15 min tops' },
  { key: 'normal', label: 'Normal' },
  { key: 'happy_to_cook', label: 'Happy to cook' },
];
export const MEDICAL_LINE =
  'If you have a medical condition, check with a doctor before starting a new training programme.';

export type OnboardingState = {
  name: string;
  age: string;
  height: string;
  weight: string;
  goalWeight: string;
  sex: string | null;
  units: string;
  goals: GoalKey[];
  conditions: string[];
  medications: string[];
  habits: Partial<Record<HabitKey, string>>;
  allergies: string[];
  diets: string[];
  place: 'gym' | 'home' | 'both' | null;
  equipment: string[];
  job: string | null;
  exercising: string | null;
  sleep: string | null;
  stress: string | null;
  motivations: string[];
  checkin: string | null;
  /** V3.4: the theme picked on the final step; null keeps the default. */
  theme: string | null;
  // V4 Phase 8a — PT intake
  experience: NonNullable<PtIntake['experience']> | null;
  daysPerWeek: string | null;
  sessionMinutes: string | null;
  weekdays: number[];
  limitationNote: string;
  dislikes: string;
  mealsPerDay: string | null;
  cookingTime: NonNullable<NonNullable<PtIntake['diet']>['cookingTime']> | null;
  dumbbellMaxKg: string;
  kettlebellKg: string;
  waist: string;
  /** V4 Phase 8h — null keeps the default (standard). */
  detail: 'simple' | 'standard' | 'full' | null;
};

export const initialState: OnboardingState = {
  name: '', age: '', height: '', weight: '', goalWeight: '',
  sex: null, units: UNIT_OPTIONS[0],
  goals: [], conditions: [], medications: [], habits: {},
  allergies: [], diets: [], place: null, equipment: [],
  job: null, exercising: null, sleep: null, stress: null,
  motivations: [], checkin: null, theme: null,
  experience: null, daysPerWeek: null, sessionMinutes: null, weekdays: [],
  limitationNote: '', dislikes: '', mealsPerDay: null, cookingTime: null,
  dumbbellMaxKg: '', kettlebellKg: '', waist: '', detail: null,
};

// V4: after the theme step, one screen per onboarding-flagged Extra (or
// group) — derived from the registry, never hand-counted here.
export const EXTRA_SCREENS = onboardingExtraScreens();
export const CORE_STEPS = 12;
export const TOTAL_STEPS = CORE_STEPS + EXTRA_SCREENS.length;

/** The extras screen shown at `step`, or null on a core step. */
export function extraScreenAt(step: number) {
  return step > CORE_STEPS ? EXTRA_SCREENS[step - CORE_STEPS - 1] ?? null : null;
}

/** Gym-only skips the home-equipment step (now 8). */
export function nextStep(current: number, state: OnboardingState): number {
  if (current === 7 && state.place === 'gym') return 9;
  return Math.min(current + 1, TOTAL_STEPS);
}
export function prevStep(current: number, state: OnboardingState): number {
  if (current === 9 && state.place === 'gym') return 7;
  return Math.max(current - 1, 1);
}

export function isImperial(state: OnboardingState): boolean {
  return state.units.startsWith('Imperial');
}

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

function num(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return isFinite(n) && n > 0 ? n : null;
}

export function weightKgFrom(state: OnboardingState): number | null {
  const n = num(state.weight);
  if (n === null) return null;
  return isImperial(state) ? Math.round((n / LB_PER_KG) * 10) / 10 : n;
}
export function goalWeightKgFrom(state: OnboardingState): number | null {
  const n = num(state.goalWeight);
  if (n === null) return null;
  return isImperial(state) ? Math.round((n / LB_PER_KG) * 10) / 10 : n;
}
export function heightCmFrom(state: OnboardingState): number | null {
  const n = num(state.height);
  if (n === null) return null;
  return isImperial(state) ? Math.round(n * CM_PER_IN * 10) / 10 : n;
}

export function sexKey(label: string | null): BiologicalSex | null {
  switch (label) {
    case 'Female': return 'female';
    case 'Male': return 'male';
    case 'Intersex': return 'intersex';
    case 'Prefer not to say': return 'prefer_not_to_say';
    default: return null;
  }
}

/** Ported bracket mapping: current exercise frequency → activity multiplier. */
export function activityLevelFrom(exercising: string | null): ActivityLevel {
  switch (exercising) {
    case '1–2× a week': return 'light';
    case '3–4×': return 'moderate';
    case '5+': return 'very';
    default: return 'sedentary';
  }
}

export function jobKey(job: string | null): 'desk' | 'feet' | 'physical' | 'mixed' | undefined {
  switch (job) {
    case 'At a desk': return 'desk';
    case 'On your feet': return 'feet';
    case 'Physical work': return 'physical';
    case 'Mixed': return 'mixed';
    default: return undefined;
  }
}

function sugaryDrinksKey(v: string | undefined): 'rarely' | 'few_week' | 'daily' | undefined {
  if (!v) return undefined;
  if (v === 'Daily') return 'daily';
  if (v === 'Rarely') return 'rarely';
  return 'few_week';
}

function alcoholKey(v: string | undefined): 'none' | 'social' | 'few_week' | 'daily' | undefined {
  switch (v) {
    case 'None': return 'none';
    case 'Social': return 'social';
    case 'Few nights a week': return 'few_week';
    case 'Daily': return 'daily';
    default: return undefined;
  }
}

export function checkinKey(label: string | null): 'quiet' | 'weekly' | 'daily' | null {
  if (!label) return null;
  if (label.startsWith('Quiet')) return 'quiet';
  if (label.startsWith('Weekly')) return 'weekly';
  return 'daily';
}

/** The pt_intake blob — only what was actually answered lands. */
export function buildPtIntake(state: OnboardingState): PtIntake | null {
  const intake: PtIntake = {};
  if (state.experience) intake.experience = state.experience;
  const schedule: NonNullable<PtIntake['schedule']> = {};
  if (state.daysPerWeek) schedule.daysPerWeek = parseInt(state.daysPerWeek, 10);
  if (state.sessionMinutes) schedule.sessionMinutes = parseInt(state.sessionMinutes, 10);
  if (state.weekdays.length > 0) schedule.weekdays = [...state.weekdays].sort();
  if (Object.keys(schedule).length > 0) intake.schedule = schedule;
  const inventory: NonNullable<PtIntake['inventory']> = {};
  const db = num(state.dumbbellMaxKg);
  if (db) inventory.dumbbellMaxKg = db;
  const kb = num(state.kettlebellKg);
  if (kb) inventory.kettlebellKg = kb;
  if (state.equipment.includes('Adjustable dumbbells')) inventory.adjustableDumbbells = true;
  if (Object.keys(inventory).length > 0) intake.inventory = inventory;
  if (state.limitationNote.trim()) intake.limitations = { note: state.limitationNote.trim() };
  const diet: NonNullable<PtIntake['diet']> = {};
  const dislikes = state.dislikes.split(',').map((d) => d.trim()).filter(Boolean);
  if (dislikes.length > 0) diet.dislikes = dislikes;
  if (state.mealsPerDay) diet.mealsPerDay = parseInt(state.mealsPerDay, 10);
  if (state.cookingTime) diet.cookingTime = state.cookingTime;
  if (Object.keys(diet).length > 0) intake.diet = diet;
  const waist = num(state.waist);
  if (waist) intake.measurements = { waistCm: isImperial(state) ? Math.round(waist * CM_PER_IN * 10) / 10 : waist };
  return Object.keys(intake).length > 0 ? intake : null;
}

/** The profile row this intake produces — everything editable in Settings. */
export function buildProfile(state: OnboardingState): Partial<ProfileRecord> {
  const conditions = state.conditions.filter((c) => c !== 'Nothing to note');
  const medications = state.medications.filter((m) => m !== 'None / skip');
  return {
    name: state.name.trim() || null,
    biologicalSex: sexKey(state.sex),
    ageYears: num(state.age) ? Math.round(num(state.age)!) : null,
    heightCm: heightCmFrom(state),
    activityLevel: activityLevelFrom(state.exercising),
    goalTypes: state.goals,
    goalWeightKg: goalWeightKgFrom(state),
    conditions,
    medications,
    habits: Object.fromEntries(
      Object.entries(state.habits).filter(([, v]) => v !== undefined),
    ) as Record<string, string>,
    ...(state.theme ? { theme: state.theme as ProfileRecord['theme'] } : {}),
    dietaryFlags: state.allergies,
    dietPatterns: state.diets,
    trainLocation: state.place,
    equipment: state.place === 'gym' ? [] : state.equipment,
    jobActivity: jobKey(state.job) ?? null,
    exerciseFrequency: state.exercising,
    typicalSleep: state.sleep,
    stressLevel: state.stress,
    motivations: state.motivations,
    checkinPreference: checkinKey(state.checkin),
    useMetric: !isImperial(state),
    ptIntake: buildPtIntake(state),
    ...(state.detail ? { detail: state.detail } : {}),
  };
}

/**
 * Target-engine input — null when the essentials are missing (skipped), in
 * which case no targets row is written: an honest absence, not a guess.
 */
export function buildTargetInput(state: OnboardingState): TargetInput | null {
  const age = num(state.age);
  const heightCm = heightCmFrom(state);
  const weightKg = weightKgFrom(state);
  const sex = sexKey(state.sex);
  if (!age || !heightCm || !weightKg || !sex) return null;

  return {
    biologicalSex: sex,
    age: Math.round(age),
    heightCm,
    weightKg,
    activityLevel: activityLevelFrom(state.exercising),
    goals: state.goals,
    habits: {
      sugaryDrinks: sugaryDrinksKey(state.habits.sugaryDrinks),
      alcohol: alcoholKey(state.habits.alcohol),
    },
    dietPatterns: state.diets,
    jobActivity: jobKey(state.job),
  };
}
