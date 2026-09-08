// Programme templates (programmes Extra) — registry-style data, no code
// per template. Each one states its length, week structure and nutrition
// stance in plain words; the numbers feed the plan engine's rate and the
// weekly check-in.

export type ProgrammeTemplate = {
  id: string;
  title: string;
  weeks: number;
  /** 0=Sun … 6=Sat, matching basalt_programs.training_days. */
  trainingDays: number[];
  /** Walks per week, stated — walking is structure here, not decoration. */
  walksPerWeek: number;
  /** Signed % of body weight per week the programme assumes. */
  ratePctPerWeek: number;
  oneLiner: string;
};

export const PROGRAMME_TEMPLATES: readonly ProgrammeTemplate[] = [
  {
    id: 'recomp8',
    title: '8-week recomposition',
    weeks: 8,
    trainingDays: [1, 3, 5],
    walksPerWeek: 2,
    ratePctPerWeek: -0.25,
    oneLiner: 'Three strength days, two walks, a gentle −0.25%/week — muscle up, fat down, slowly.',
  },
  {
    id: 'strength6',
    title: 'Strength block',
    weeks: 6,
    trainingDays: [1, 2, 4, 5],
    walksPerWeek: 0,
    ratePctPerWeek: 0,
    oneLiner: 'Four strength days at maintenance for six weeks — the plates go up, the scale holds.',
  },
  {
    id: 'walkbase4',
    title: 'Walking base',
    weeks: 4,
    trainingDays: [],
    walksPerWeek: 5,
    ratePctPerWeek: 0,
    oneLiner: 'Five walks a week for four weeks — a base, built honestly, before anything heavier.',
  },
] as const;

export function programmeTemplate(id: string): ProgrammeTemplate | null {
  return PROGRAMME_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Current 1-based week of a programme; null once it's done. */
export function programmeWeek(startedOn: string, weeks: number, now: Date): number | null {
  const days = Math.floor((now.getTime() - Date.parse(startedOn)) / 86_400_000);
  if (days < 0) return null;
  const week = Math.floor(days / 7) + 1;
  return week > weeks ? null : week;
}
