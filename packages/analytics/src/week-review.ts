// Week in Review — composed from the ledger, never from wishes. The rules
// are product law: factual sentences, exactly one gap named, no cheerleading
// vocabulary, stats only for dimensions that actually have data, and a week
// with too little data says so instead of composing fiction.

export type ReviewDay = {
  date: string;
  /** kcal eaten, or null when nothing was logged that day. */
  calories: number | null;
  proteinG: number | null;
  loggedFood: boolean;
  loggedTraining: boolean;
  steps: number | null;
  sleepMin: number | null;
};

export type WeekReviewInput = {
  weekStartLabel: string;
  weekEndLabel: string;
  days: ReviewDay[];
  sessionCount: number;
  volumeKg: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
};

export type WeekReview = {
  /** null when the week has too little data to review honestly. */
  lede: string | null;
  gap: string | null;
  stats: { k: string; v: string }[];
  rangeLabel: string;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Pick exactly one gap — the worst adherence dimension, deterministically. */
export function pickGap(input: WeekReviewInput): string | null {
  const loggedDays = input.days.filter((d) => d.loggedFood).length;
  const unlogged = input.days.length - loggedDays;

  type Candidate = { severity: number; text: string };
  const candidates: Candidate[] = [];

  if (unlogged > 0) {
    candidates.push({
      severity: unlogged / input.days.length,
      text:
        unlogged === 1
          ? 'one day went unlogged, so the week’s numbers are missing a piece'
          : `${unlogged} days went unlogged, so the week’s numbers are missing pieces`,
    });
  }

  if (input.proteinTarget !== null && loggedDays > 0) {
    const under = input.days.filter(
      (d) => d.loggedFood && d.proteinG !== null && d.proteinG < input.proteinTarget! * 0.9,
    ).length;
    if (under > 0) {
      candidates.push({
        severity: (under / Math.max(1, loggedDays)) * 0.9,
        text: `protein landed under target on ${under} of ${loggedDays} logged days`,
      });
    }
  }

  if (input.sessionCount === 0) {
    candidates.push({ severity: 0.85, text: 'no training sessions were logged' });
  }

  if (input.calorieTarget !== null && loggedDays > 0) {
    const over = input.days.filter(
      (d) => d.loggedFood && d.calories !== null && d.calories > input.calorieTarget! * 1.1,
    ).length;
    if (over >= 2) {
      candidates.push({
        severity: (over / Math.max(1, loggedDays)) * 0.7,
        text: `${over} logged days ran more than 10% over the energy target`,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.severity - a.severity);
  return candidates[0]!.text;
}

export function composeWeekReview(input: WeekReviewInput): WeekReview {
  const rangeLabel = `${input.weekStartLabel} – ${input.weekEndLabel}`;
  const loggedDays = input.days.filter((d) => d.loggedFood).length;

  // Too little data → say so, compose nothing.
  if (loggedDays < 2 && input.sessionCount === 0) {
    return {
      lede: null,
      gap: null,
      stats: [],
      rangeLabel,
    };
  }

  // Stats — only dimensions with data.
  const stats: { k: string; v: string }[] = [];
  if (input.volumeKg > 0) {
    stats.push({ k: 'Volume', v: input.volumeKg >= 1000 ? `${(input.volumeKg / 1000).toFixed(1)} t` : `${fmt(input.volumeKg)} kg` });
  }
  const calMeans = input.days.filter((d) => d.loggedFood && d.calories !== null).map((d) => d.calories!);
  const calMean = mean(calMeans);
  if (calMean !== null && input.calorieTarget !== null) {
    const delta = Math.round(calMean - input.calorieTarget);
    stats.push({ k: delta <= 0 ? 'Deficit' : 'Surplus', v: `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}/d` });
  }
  const sleepMean = mean(input.days.filter((d) => d.sleepMin !== null).map((d) => d.sleepMin!));
  if (sleepMean !== null) {
    const h = Math.floor(sleepMean / 60);
    const m = Math.round(sleepMean % 60);
    stats.push({ k: 'Sleep', v: `${h}:${String(m).padStart(2, '0')} avg` });
  }
  const stepsMean = mean(input.days.filter((d) => d.steps !== null).map((d) => d.steps!));
  if (stepsMean !== null) {
    stats.push({ k: 'Steps', v: `${fmt(stepsMean)} avg` });
  }

  // Lede — factual clauses, no adjectives of praise.
  const clauses: string[] = [];
  if (input.sessionCount > 0) {
    clauses.push(`${input.sessionCount} training ${input.sessionCount === 1 ? 'session' : 'sessions'}`);
  }
  clauses.push(`food logged on ${loggedDays} of ${input.days.length} days`);
  if (input.proteinTarget !== null && loggedDays > 0) {
    const onTarget = input.days.filter(
      (d) => d.loggedFood && d.proteinG !== null && d.proteinG >= input.proteinTarget! * 0.9,
    ).length;
    clauses.push(`protein on target ${onTarget} of ${loggedDays}`);
  }

  const gap = pickGap(input);
  const lede =
    `${clauses.join(' · ')}.` + (gap ? ` The one gap: ${gap}.` : '');

  return { lede, gap, stats, rangeLabel };
}
