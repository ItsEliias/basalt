import { MIN_TRANSITION_S } from './guided-timer';
import type { BodyRegion } from './muscle-map';

// Mobility v1 (V3.1 H3) — Bend's niche in this app's language. A TOOL,
// not a library: nine stretches, three fixed routines, no browsing
// surface. The optional four-position self-assessment ONLY reorders
// emphasis — there is no mobility score, no percentage, no aggregate of
// the sliders anywhere (the audit's named trap; pinned by test). Timers
// obey the shipped transition-floor law: every positioning transition is
// at least MIN_TRANSITION_S.

export type Stretch = {
  key: string;
  name: string;
  regions: BodyRegion[];
  /** Which assessed position this stretch serves, if any. */
  position: AssessedPosition | null;
  bilateral: boolean;
  cue: string;
};

export type AssessedPosition = 'deep_squat' | 'forward_fold' | 'overhead_reach' | 'hip_rotation';

export const ASSESSED_POSITIONS: { key: AssessedPosition; label: string; anchors: [string, string] }[] = [
  { key: 'deep_squat', label: 'Deep squat', anchors: ['heels lift early', 'full depth, heels down'] },
  { key: 'forward_fold', label: 'Forward fold', anchors: ['hands to knees', 'palms to floor'] },
  { key: 'overhead_reach', label: 'Overhead reach', anchors: ['arms forward of ears', 'arms behind ears'] },
  { key: 'hip_rotation', label: 'Hip rotation', anchors: ['knee stays high', 'knee drops flat'] },
];

export const STRETCHES: Stretch[] = [
  { key: 'cat_cow', name: 'Cat–cow', regions: ['back', 'core'], position: 'forward_fold', bilateral: false, cue: 'Slow spine waves — move with the breath' },
  { key: 'childs_pose', name: "Child's pose", regions: ['back', 'shoulders'], position: 'overhead_reach', bilateral: false, cue: 'Sink the hips back, arms long, let the ribs drop' },
  { key: 'hip_flexor', name: 'Half-kneel hip flexor', regions: ['quads', 'glutes'], position: 'deep_squat', bilateral: true, cue: 'Tuck the tail, shift forward until the front of the hip lengthens' },
  { key: 'hamstring_fold', name: 'Standing fold', regions: ['hamstrings', 'back'], position: 'forward_fold', bilateral: false, cue: 'Soft knees, hang heavy, no bouncing' },
  { key: 'figure_four', name: 'Figure-four', regions: ['glutes'], position: 'hip_rotation', bilateral: true, cue: 'Ankle over knee, pull the shin gently closer' },
  { key: 'calf_wall', name: 'Wall calf stretch', regions: ['calves'], position: 'deep_squat', bilateral: true, cue: 'Back heel down, lean until the calf speaks' },
  { key: 'doorway_chest', name: 'Doorway chest opener', regions: ['chest', 'shoulders'], position: 'overhead_reach', bilateral: false, cue: 'Forearms on the frame, step through slowly' },
  { key: 'thread_needle', name: 'Thread the needle', regions: ['shoulders', 'back'], position: 'hip_rotation', bilateral: true, cue: 'Slide the arm under, rest the shoulder down' },
  { key: 'neck_side', name: 'Neck side bend', regions: ['shoulders'], position: null, bilateral: true, cue: 'Ear toward shoulder, hand adds weight only, never pull' },
];

export type MobilityRoutine = {
  key: 'morning_5' | 'post_walk_5' | 'desk_8';
  name: string;
  totalMin: number;
  stretchKeys: string[];
  /** Hold per stretch (per side when bilateral), seconds. */
  holdS: number;
};

// Timeline arithmetic: total = Σ holds + transitions (one per movement
// between positions). Each routine's numbers are chosen so the stated
// minutes are EXACT — pinned by test, no rounding lies.
export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  // 4 stretches, 2 bilateral → 6 holds ×40 s = 240 s + 6 transitions ×10 s = 300 s.
  { key: 'morning_5', name: 'Morning · 5 min', totalMin: 5, holdS: 40, stretchKeys: ['cat_cow', 'hip_flexor', 'hamstring_fold', 'figure_four'] },
  // 3 stretches, 2 bilateral → 5 holds ×50 s = 250 s + 5 transitions ×10 s = 300 s.
  { key: 'post_walk_5', name: 'Post-walk · 5 min', totalMin: 5, holdS: 50, stretchKeys: ['calf_wall', 'hamstring_fold', 'hip_flexor'] },
  // 5 stretches, 2 bilateral → 7 holds ×58 s = 406 s + 7 transitions ×10.57… — use 60 s holds:
  // 7 holds ×58.57 no. Choose: 7 holds ×59 = 413 + 7×10 = 483 ≠ 480. Use holdS 58 + one 12 s
  // transition? No — keep transitions at the floor and set holds to make it exact:
  // 7 × (h + 10) = 480 → h = 58.57. Instead 6 holds: 4 stretches, 2 bilateral = 6 holds
  // ×70 = 420 + 6×10 = 480 s exactly.
  { key: 'desk_8', name: 'Desk · 8 min', totalMin: 8, holdS: 70, stretchKeys: ['neck_side', 'doorway_chest', 'thread_needle', 'cat_cow'] },
];

export type MobilityPhase = {
  kind: 'transition' | 'hold';
  stretch: Stretch;
  side: 'left' | 'right' | null;
  seconds: number;
};

/** Assessment: position → 1..5 self-rating. Missing keys are simply unrated. */
export type MobilityAssessment = Partial<Record<AssessedPosition, number>>;

/**
 * Reorder a routine's stretches so the lowest-rated positions come first.
 * Stable for unrated stretches; with no assessment the order is untouched.
 * This is the assessment's ENTIRE effect — it feeds no score.
 */
export function orderByEmphasis(stretchKeys: string[], assessment: MobilityAssessment): string[] {
  const rated = (key: string): number => {
    const st = STRETCHES.find((s) => s.key === key);
    const pos = st?.position;
    const r = pos ? assessment[pos] : undefined;
    return r === undefined ? 99 : r;
  };
  return [...stretchKeys].sort((a, b) => rated(a) - rated(b));
}

/** The runnable timeline: transition (≥ floor) into each hold, per side. */
export function mobilityTimeline(
  routine: MobilityRoutine,
  assessment: MobilityAssessment = {},
): MobilityPhase[] {
  const order = orderByEmphasis(routine.stretchKeys, assessment);
  const phases: MobilityPhase[] = [];
  for (const key of order) {
    const stretch = STRETCHES.find((s) => s.key === key);
    if (!stretch) continue;
    const sides: ('left' | 'right' | null)[] = stretch.bilateral ? ['left', 'right'] : [null];
    for (const side of sides) {
      phases.push({ kind: 'transition', stretch, side, seconds: MIN_TRANSITION_S });
      phases.push({ kind: 'hold', stretch, side, seconds: routine.holdS });
    }
  }
  return phases;
}

export function timelineTotalS(phases: MobilityPhase[]): number {
  return phases.reduce((a, p) => a + p.seconds, 0);
}
