// Monthly challenge — computed from the user's OWN baseline, private,
// optional, no leaderboards, no badges. The rules, in full:
//
//   · With 14+ baseline days of steps: the target is your 60-day median
//     ×1.1, rounded to 500, on 20 days this month.
//   · Otherwise, with session history: one more session per week than
//     your recent median, capped at 5/week, counted over the month.
//   · No baseline → no challenge. Nothing is invented to fill the card.

export type ChallengeInput = {
  monthLabel: string;
  daysInMonth: number;
  stepsBaseline: number[];
  stepsThisMonth: number[];
  sessionsPerWeekMedian: number;
  sessionsThisMonth: number;
};

export type MonthlyChallenge = {
  kind: 'steps' | 'sessions';
  statement: string;
  targetText: string;
  progress: number;
  goal: number;
  basis: string;
} | null;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

export function computeMonthlyChallenge(input: ChallengeInput): MonthlyChallenge {
  if (input.stepsBaseline.length >= 14) {
    const target = Math.round((median(input.stepsBaseline) * 1.1) / 500) * 500;
    const goal = 20;
    const progress = input.stepsThisMonth.filter((s) => s >= target).length;
    return {
      kind: 'steps',
      statement: `${input.monthLabel}: ${target.toLocaleString('en-US')}+ steps on ${goal} days`,
      targetText: `${target.toLocaleString('en-US')} steps`,
      progress,
      goal,
      basis: `your 60-day median ×1.1, rounded to 500 — computed from your own baseline, nobody else's`,
    };
  }
  if (input.sessionsPerWeekMedian > 0) {
    const perWeek = Math.min(5, Math.ceil(input.sessionsPerWeekMedian) + 1);
    const goal = perWeek * Math.round(input.daysInMonth / 7);
    return {
      kind: 'sessions',
      statement: `${input.monthLabel}: ${goal} training sessions`,
      targetText: `${perWeek}/week`,
      progress: input.sessionsThisMonth,
      goal,
      basis: `one more session per week than your recent median, capped at 5 — from your own history`,
    };
  }
  return null;
}
