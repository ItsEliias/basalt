// Pebble Coach (coach Extra, requires Pebble) — the model layer. The hard
// limits live HERE, on the device, before any question reaches a server:
// no diagnosis, no dosing, disordered-eating signals end coaching and
// point to help, medical questions get "one for a doctor". The server
// prompt repeats them as the second line of defence, but these tests pin
// the first.
//
// The coach NEVER initiates: nothing in this module schedules, notifies,
// or generates unprompted text — it only answers `ask` calls made by a
// user tapping send. Answers must cite the exact stored numbers used.

export const COACH_DEFLECTIONS = {
  medical: 'That one is for a doctor, not a coach. Basalt can show your recorded numbers, and a clinician can read them with you — Settings › Your data › Doctor report.',
  dosing: 'Basalt never proposes doses or supplement amounts — that is between you and a professional. Your own supplements list stays your words.',
  disordered: 'This sounds heavier than food arithmetic, and a coach is the wrong tool for it. Talking to someone real helps: the Butterfly Foundation (1800 33 4673, AU) or your GP. Basalt will not coach restriction.',
} as const;

// Curated lists — deliberately over-broad. A false positive costs one
// deflected question; a false negative costs trust.
const MEDICAL = [
  'chest pain', 'heart palpitation', 'diagnos', 'blood pressure medication', 'diabete',
  'thyroid', 'pregnan', 'injur', 'sharp pain', 'dizzy', 'faint', 'blood in',
  'medication', 'prescription', 'symptom',
];
const DOSING = [
  'how much creatine', 'how many mg', 'what dose', 'dosage', 'how much caffeine',
  'how much melatonin', 'should i take', 'safe to take',
];
const DISORDERED = [
  'stop eating', 'skip meals to', 'punish myself', 'purge', 'burn off everything',
  'hate my body', 'hide my eating', 'not eat for', 'deserve to eat', 'fast for days',
  'lowest calories i can survive',
];

export type CoachGuard = { kind: 'medical' | 'dosing' | 'disordered'; reply: string };

/** Device-side guard, run before ANY network call. Null = safe to ask. */
export function coachLocalGuard(question: string): CoachGuard | null {
  const q = question.toLowerCase();
  // Disordered-eating outranks the other two — the reply must point to help.
  if (DISORDERED.some((p) => q.includes(p))) return { kind: 'disordered', reply: COACH_DEFLECTIONS.disordered };
  if (DOSING.some((p) => q.includes(p))) return { kind: 'dosing', reply: COACH_DEFLECTIONS.dosing };
  if (MEDICAL.some((p) => q.includes(p))) return { kind: 'medical', reply: COACH_DEFLECTIONS.medical };
  return null;
}

/** The numbers block sent with a question — each one named, nothing extra. */
export type CoachNumbers = {
  todayKcal: number | null;
  targetKcal: number | null;
  proteinG: number | null;
  proteinTargetG: number | null;
  trendWeightKg: number | null;
  sleepDebtMin: number | null;
  readiness: number | null;
  sessionsThisWeek: number | null;
};

export type CoachAction = { label: string; kind: 'open-recover' | 'open-plan' | 'open-train' };

export type CoachReply = {
  answer: string;
  citedNumbers: string[];
  action: CoachAction | null;
};

/** Parse the edge function's reply defensively — a bad shape becomes null. */
export function parseCoachReply(data: unknown): CoachReply | null {
  const d = data as any;
  if (!d || typeof d.answer !== 'string' || !Array.isArray(d.citedNumbers)) return null;
  const kinds = ['open-recover', 'open-plan', 'open-train'];
  const action =
    d.action && typeof d.action.label === 'string' && kinds.includes(d.action.kind)
      ? { label: d.action.label, kind: d.action.kind as CoachAction['kind'] }
      : null;
  return { answer: d.answer, citedNumbers: d.citedNumbers.map(String), action };
}

export const COACH_SUBLABEL =
  'Answers use only your stored numbers, named below each reply · proposes at most one action, never edits anything · only speaks when asked';
