import type { MovementPattern } from './catalog';

// Split templates (V4 Phase 8c) — data in the same spirit as the imported
// splits: a template is a list of days, each day a list of SLOTS naming a
// movement pattern and a role. The generator fills slots from the
// catalog; it never invents structure.

export type SlotRole = 'main' | 'secondary' | 'accessory';

export type Slot = {
  pattern: MovementPattern;
  role: SlotRole;
  /** Bias exercise selection toward a region (accessory slots). */
  bias?: string;
};

export type DayTemplate = { name: string; slots: Slot[] };
export type SplitTemplate = { id: string; name: string; days: DayTemplate[]; why: string };

const slot = (pattern: MovementPattern, role: SlotRole, bias?: string): Slot => ({ pattern, role, ...(bias ? { bias } : {}) });

const FULL_BODY: DayTemplate = {
  name: 'Full body',
  slots: [
    slot('squat', 'main'), slot('push-h', 'main'), slot('pull-h', 'main'),
    slot('hinge', 'secondary'), slot('push-v', 'secondary'), slot('core', 'accessory'),
  ],
};
const FULL_BODY_B: DayTemplate = {
  name: 'Full body B',
  slots: [
    slot('hinge', 'main'), slot('push-v', 'main'), slot('pull-v', 'main'),
    slot('squat', 'secondary'), slot('pull-h', 'secondary'), slot('carry', 'accessory'),
  ],
};
const UPPER: DayTemplate = {
  name: 'Upper',
  slots: [
    slot('push-h', 'main'), slot('pull-h', 'main'), slot('push-v', 'secondary'),
    slot('pull-v', 'secondary'), slot('accessory', 'accessory', 'arms'), slot('accessory', 'accessory', 'shoulders'),
  ],
};
const LOWER: DayTemplate = {
  name: 'Lower',
  slots: [
    slot('squat', 'main'), slot('hinge', 'main'), slot('squat', 'secondary'),
    slot('accessory', 'accessory', 'hamstrings'), slot('accessory', 'accessory', 'calves'), slot('core', 'accessory'),
  ],
};
const PUSH: DayTemplate = {
  name: 'Push',
  slots: [
    slot('push-h', 'main'), slot('push-v', 'main'), slot('push-h', 'secondary'),
    slot('accessory', 'accessory', 'shoulders'), slot('accessory', 'accessory', 'arms'), slot('core', 'accessory'),
  ],
};
const PULL: DayTemplate = {
  name: 'Pull',
  slots: [
    slot('pull-v', 'main'), slot('pull-h', 'main'), slot('accessory', 'accessory', 'back'),
    slot('accessory', 'accessory', 'arms'), slot('accessory', 'accessory', 'shoulders'), slot('carry', 'accessory'),
  ],
};
const LEGS: DayTemplate = {
  name: 'Legs',
  slots: [
    slot('squat', 'main'), slot('hinge', 'main'), slot('squat', 'secondary'),
    slot('accessory', 'accessory', 'glutes'), slot('accessory', 'accessory', 'calves'), slot('core', 'accessory'),
  ],
};

/** Split by available days — the published table. */
export function splitForDays(daysPerWeek: number): SplitTemplate {
  const d = Math.max(1, Math.min(6, Math.round(daysPerWeek)));
  switch (d) {
    case 1:
      return { id: 'fb1', name: 'Full body ×1', days: [FULL_BODY], why: '1 day a week: one full-body session moves every pattern — frequency beats splitting at this dose.' };
    case 2:
      return { id: 'fb2', name: 'Full body ×2', days: [FULL_BODY, FULL_BODY_B], why: '2 days: two different full-body sessions hit everything twice.' };
    case 3:
      return { id: 'fb3', name: 'Full body ×3', days: [FULL_BODY, FULL_BODY_B, FULL_BODY], why: '3 days: full body three times — the highest per-muscle frequency this schedule allows.' };
    case 4:
      return { id: 'ul4', name: 'Upper / Lower ×2', days: [UPPER, LOWER, UPPER, LOWER], why: '4 days: upper/lower twice keeps each session short and each muscle trained twice.' };
    case 5:
      return { id: 'ppl-ul', name: 'Push / Pull / Legs / Upper / Lower', days: [PUSH, PULL, LEGS, UPPER, LOWER], why: "5 days: PPL + upper/lower — Cody's Gym split 1 shape; everything twice with focused days." };
    default:
      return { id: 'ppl2', name: 'Push / Pull / Legs ×2', days: [PUSH, PULL, LEGS, PUSH, PULL, LEGS], why: '6 days: PPL twice through — only worth it when recovery is honestly there.' };
  }
}
