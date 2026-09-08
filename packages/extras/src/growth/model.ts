// Pebble grows — five stages from ONE published score: consistency over
// the rolling last 30 days across logging, training (rest-aware, from
// the core engine) and sleep records. Regression is allowed and visible:
// the stage is a pure function of the last 30 days, nothing is banked.

export const GROWTH_WINDOW_DAYS = 30;

export const GROWTH_RULES = [
  `Score = (logging days + training days + sleep-logged days) ÷ ${GROWTH_WINDOW_DAYS * 3}, over the rolling last ${GROWTH_WINDOW_DAYS} days. Rest days count as training days.`,
  'Stages: 1 from 0% · 2 from 20% · 3 from 40% · 4 from 60% · 5 from 80%.',
  'The stage falls when the score falls — nothing is banked, and the score is always shown next to the stage.',
] as const;

export const STAGE_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8] as const;

export type GrowthInputs = {
  loggingDays30: number;
  trainingDays30: number;
  sleepDays30: number;
};

export function growthScore(i: GrowthInputs): number {
  const clamp = (n: number) => Math.min(GROWTH_WINDOW_DAYS, Math.max(0, n));
  return (clamp(i.loggingDays30) + clamp(i.trainingDays30) + clamp(i.sleepDays30)) / (GROWTH_WINDOW_DAYS * 3);
}

export function stageFor(score: number): 1 | 2 | 3 | 4 | 5 {
  let stage = 1;
  STAGE_THRESHOLDS.forEach((t, idx) => {
    if (score >= t) stage = idx + 1;
  });
  return stage as 1 | 2 | 3 | 4 | 5;
}

export function scoreText(score: number): string {
  return `${Math.round(score * 100)}%`;
}
