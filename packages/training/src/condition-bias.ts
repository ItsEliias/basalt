// Condition-based library biasing. The rules are mechanical, published and
// deliberately narrow: only conditions describing a physical load limit
// (shoulder, knee, lower back, mobility) reorder the list. Medical
// conditions (blood pressure, heart, diabetes, asthma, pregnancy) never
// do — choosing exercises around a medical condition is advice, and Basalt
// doesn't give advice. Biased-down exercises are NEVER hidden; they sort
// lower and state why, naming the user's own note as the source.

export type BiasableExercise = {
  name: string;
  category: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  difficulty: string | null;
};

export type ConditionBias = {
  /** Sorts below unbiased results. Never hides. */
  down: boolean;
  /** e.g. "loads the shoulder" — shown in the row, with the condition. */
  reason: string | null;
  /** The user's own onboarding note that triggered it. */
  condition: string | null;
};

const nameHas = (ex: BiasableExercise, words: string[]) => {
  const n = ex.name.toLowerCase();
  return words.some((w) => n.includes(w));
};
const hasMuscle = (ex: BiasableExercise, muscles: string[]) =>
  [...ex.primaryMuscles, ...ex.secondaryMuscles].some((m) => muscles.includes(m.toLowerCase()));

type Rule = { condition: string; reason: string; test: (ex: BiasableExercise) => boolean };

/** Published, inspectable — the whole ruleset, nothing hidden in weights. */
export const BIAS_RULES: Rule[] = [
  {
    condition: 'Shoulder injury',
    reason: 'loads the shoulder',
    test: (ex) =>
      hasMuscle(ex, ['shoulders']) ||
      nameHas(ex, ['overhead', 'press', 'snatch', 'jerk', 'upright row', 'lateral raise', 'handstand', 'dip']),
  },
  {
    condition: 'Knee injury',
    reason: 'knee-dominant',
    test: (ex) =>
      ex.category === 'plyometrics' ||
      nameHas(ex, ['squat', 'lunge', 'leg press', 'leg extension', 'pistol', 'step-up', 'step up', 'jump', 'bound']),
  },
  {
    condition: 'Lower-back issues',
    reason: 'loads the lower back',
    test: (ex) =>
      hasMuscle(ex, ['lower back']) ||
      ex.category === 'olympic weightlifting' ||
      nameHas(ex, ['deadlift', 'good morning', 'bent-over', 'bent over', 'hyperextension', 'clean', 'snatch', 'atlas']),
  },
  {
    condition: 'Limited mobility',
    reason: 'high mobility demand',
    test: (ex) => ex.category === 'plyometrics' || ex.difficulty === 'expert',
  },
];

export function conditionBiasFor(ex: BiasableExercise, conditions: string[]): ConditionBias {
  for (const rule of BIAS_RULES) {
    if (conditions.includes(rule.condition) && rule.test(ex)) {
      return { down: true, reason: rule.reason, condition: rule.condition };
    }
  }
  return { down: false, reason: null, condition: null };
}

/**
 * Stable partition: unbiased exercises keep their order first, biased-down
 * ones follow (also in original order), each annotated so the UI can state
 * the why inline.
 */
export function biasOrder<T extends BiasableExercise>(
  list: T[],
  conditions: string[],
): (T & { bias: ConditionBias })[] {
  const annotated = list.map((ex) => ({ ...ex, bias: conditionBiasFor(ex, conditions) }));
  return [...annotated.filter((e) => !e.bias.down), ...annotated.filter((e) => e.bias.down)];
}
