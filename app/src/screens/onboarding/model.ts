import type { ProfileRecord } from '@basalt/core-data';
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
  'Knee injury', 'Lower-back issues', 'Limited mobility', 'Recovering from surgery',
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
};

export const initialState: OnboardingState = {
  name: '', age: '', height: '', weight: '', goalWeight: '',
  sex: null, units: UNIT_OPTIONS[0],
  goals: [], conditions: [], medications: [], habits: {},
  allergies: [], diets: [], place: null, equipment: [],
  job: null, exercising: null, sleep: null, stress: null,
  motivations: [], checkin: null,
};

export const TOTAL_STEPS = 8;

/** Gym-only skips the home-equipment step (7). */
export function nextStep(current: number, state: OnboardingState): number {
  if (current === 6 && state.place === 'gym') return 8;
  return Math.min(current + 1, TOTAL_STEPS);
}
export function prevStep(current: number, state: OnboardingState): number {
  if (current === 8 && state.place === 'gym') return 6;
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
