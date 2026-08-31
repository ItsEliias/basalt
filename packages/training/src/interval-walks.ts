// Guided interval walks — a FIXED set of RPE-scripted sessions, spoken
// over the existing walk recorder. Not a browsable library, deliberately:
// three published scripts, each phase cued in talk-test language (what
// the effort should feel like), never pace numbers — pace is terrain- and
// person-relative, breath is not.
//
// Haptics are the primary signal (usable with no earbuds and screen off);
// speech is the detail layer. Cues are factual instructions — the
// no-cheerleading law applies to spoken copy exactly as to printed copy.

export type WalkEffort = 'warmup' | 'easy' | 'brisk' | 'cooldown';

export type WalkPhase = {
  effort: WalkEffort;
  seconds: number;
  /** Spoken at phase start. Talk-test language, no numbers, no cheer. */
  cue: string;
};

export type IntervalWalk = {
  key: string;
  name: string;
  /** One line the picker shows — structure, stated plainly. */
  structure: string;
  phases: WalkPhase[];
};

const CUE: Record<WalkEffort, string> = {
  warmup: 'Warm up. Easy pace — settle in, full sentences come easily.',
  easy: 'Ease off. Recover — back to a pace where talking is comfortable.',
  brisk: 'Pick it up. Brisk — breathing harder, short sentences only.',
  cooldown: 'Cool down. Easy again — let your breathing come all the way back.',
};

function phase(effort: WalkEffort, minutes: number): WalkPhase {
  return { effort, seconds: Math.round(minutes * 60), cue: CUE[effort] };
}

function repeats(n: number, ...block: WalkPhase[]): WalkPhase[] {
  return Array.from({ length: n }, () => block).flat();
}

/** The whole catalogue. Three sessions; the picker shows these and nothing else. */
export const INTERVAL_WALKS: IntervalWalk[] = [
  {
    key: 'intervals_20',
    name: 'Intervals · 20 min',
    structure: '3 easy · 5 × (1 brisk / 2 easy) · 2 easy',
    phases: [phase('warmup', 3), ...repeats(5, phase('brisk', 1), phase('easy', 2)), phase('cooldown', 2)],
  },
  {
    key: 'brisk_build_30',
    name: 'Brisk blocks · 30 min',
    structure: '4 easy · 3 × (6 brisk / 2 easy) · 2 easy',
    phases: [phase('warmup', 4), ...repeats(3, phase('brisk', 6), phase('easy', 2)), phase('cooldown', 2)],
  },
  {
    key: 'steady_45',
    name: 'Long steady · 45 min',
    structure: '5 easy · 37 brisk · 3 easy',
    phases: [phase('warmup', 5), phase('brisk', 37), phase('cooldown', 3)],
  },
];

export function walkTotalSeconds(walk: IntervalWalk): number {
  return walk.phases.reduce((s, p) => s + p.seconds, 0);
}

export type WalkPosition = {
  phase: WalkPhase;
  index: number;
  phaseElapsedS: number;
  phaseRemainS: number;
};

/** Where an elapsed clock sits in the script; null once the script is done. */
export function phaseAt(walk: IntervalWalk, elapsedS: number): WalkPosition | null {
  let t = elapsedS;
  for (let i = 0; i < walk.phases.length; i++) {
    const p = walk.phases[i]!;
    if (t < p.seconds) {
      return { phase: p, index: i, phaseElapsedS: t, phaseRemainS: p.seconds - t };
    }
    t -= p.seconds;
  }
  return null;
}

/** Spoken when the script ends — the walk keeps recording; the user decides. */
export const WALK_DONE_CUE = 'Script finished. Keep walking as long as you like — the recording continues until you stop it.';
