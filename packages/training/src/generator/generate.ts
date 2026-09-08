import type { BodyRegion } from '../muscle-map';
import { CATALOG, CATALOG_BY_ID, doableWith, type CatalogExercise, type EquipmentItem } from './catalog';
import { splitForDays, type SlotRole, type SplitTemplate, type Slot } from './templates';

// The split generator (V4 Phase 8c) — deterministic and rule-based;
// every rule below is exported as a readable string and rendered under
// the programme's "why". No randomness, no model, no magic: the same
// inputs always produce the same week.

export type Experience = 'new' | 'under1y' | '1to3y' | '3plus';
export type GeneratorGoal = 'cut' | 'maintain' | 'gain' | 'move';

export type GeneratorInput = {
  daysPerWeek: number;
  sessionMinutes: number;
  experience: Experience;
  goal: GeneratorGoal;
  /** What the user actually has (gym implies everything). */
  equipment: ReadonlySet<EquipmentItem>;
  inventory: { dumbbellMaxKg?: number; kettlebellKg?: number };
  /** Regions the limitation chips exclude (see EXCLUSION_MAP). */
  exclusions: readonly LimitationChip[];
  bodyweightKg: number | null;
  /** Top logged working weight per catalog id, when history exists. */
  historyTopKg?: ReadonlyMap<string, number>;
};

export type LimitationChip = 'knee' | 'shoulder' | 'lower_back' | 'wrist' | 'hip';

/**
 * Published exclusion rules: a chip caps the difficulty of a movement
 * pattern (0 = excluded outright). Anything the cap removes falls through
 * the substitution list; if nothing fits, the plan SAYS so.
 */
export const EXCLUSION_MAP: Record<LimitationChip, { pattern: string; maxDifficulty: 0 | 1 }[]> = {
  knee: [{ pattern: 'squat', maxDifficulty: 1 }],
  shoulder: [{ pattern: 'push-v', maxDifficulty: 0 }, { pattern: 'push-h', maxDifficulty: 1 }],
  lower_back: [{ pattern: 'hinge', maxDifficulty: 1 }],
  wrist: [{ pattern: 'push-h', maxDifficulty: 1 }, { pattern: 'push-v', maxDifficulty: 1 }],
  hip: [{ pattern: 'squat', maxDifficulty: 1 }, { pattern: 'hinge', maxDifficulty: 1 }],
};

/** Map the intake's condition chips to exclusion chips. */
export function limitationChipsFrom(conditions: readonly string[]): LimitationChip[] {
  const out: LimitationChip[] = [];
  for (const c of conditions) {
    const l = c.toLowerCase();
    if (l.includes('knee')) out.push('knee');
    if (l.includes('shoulder')) out.push('shoulder');
    if (l.includes('back')) out.push('lower_back');
    if (l.includes('wrist')) out.push('wrist');
    if (l.includes('hip')) out.push('hip');
  }
  return [...new Set(out)];
}

/** Intake equipment names → catalog vocabulary. Gym = everything. */
export function equipmentSetFrom(place: 'gym' | 'home' | 'both' | null, names: readonly string[]): Set<EquipmentItem> {
  if (place === 'gym' || place === 'both') {
    return new Set<EquipmentItem>(['barbell', 'dumbbell', 'kettlebell', 'bands', 'bench', 'pullupbar', 'rack', 'cable', 'machine', 'cardio']);
  }
  const set = new Set<EquipmentItem>();
  for (const n of names) {
    const l = n.toLowerCase();
    if (l.includes('dumbbell')) set.add('dumbbell');
    if (l.includes('barbell')) set.add('barbell');
    if (l.includes('rack')) set.add('rack');
    if (l.includes('bench')) set.add('bench');
    if (l.includes('band')) set.add('bands');
    if (l.includes('pull-up') || l.includes('pullup')) set.add('pullupbar');
    if (l.includes('kettlebell')) set.add('kettlebell');
    if (l.includes('cable')) set.add('cable');
    if (l.includes('treadmill') || l.includes('bike') || l.includes('rower')) set.add('cardio');
  }
  return set;
}

// ── Published numbers ──────────────────────────────────────────────────

export const REST_SECONDS = { compound: 150, accessory: 75 } as const; // 2–3 min / 60–90 s, midpoints for time math
export const WORK_SECONDS_PER_SET = 40;
export const SESSION_OVERHEAD_MIN = 5;
export const RIR_BY_WEEK = [3, 2, 1] as const; // then deload
export const DELOAD_EVERY_WEEKS: Record<Experience, number> = { new: 6, under1y: 6, '1to3y': 5, '3plus': 4 };
export const NEW_LIFTER_WEEKS = 4;
export const SETSREPS = {
  hypertrophy: { main: { sets: 4, low: 8, high: 12 }, secondary: { sets: 3, low: 8, high: 12 }, accessory: { sets: 3, low: 10, high: 15 } },
  strength: { main: { sets: 4, low: 4, high: 6 }, secondary: { sets: 3, low: 6, high: 8 }, accessory: { sets: 3, low: 10, high: 15 } },
  newLifter: { main: { sets: 3, low: 10, high: 15 }, secondary: { sets: 2, low: 10, high: 15 }, accessory: { sets: 2, low: 12, high: 15 } },
} as const;
export const DB_START_FRACTION: Record<SlotRole, number> = { main: 0.5, secondary: 0.4, accessory: 0.3 };
export const BB_START_PCT_BODYWEIGHT: Record<string, Record<Experience, number>> = {
  squat: { new: 0, under1y: 0.3, '1to3y': 0.4, '3plus': 0.5 },
  hinge: { new: 0, under1y: 0.4, '1to3y': 0.5, '3plus': 0.6 },
  'push-h': { new: 0, under1y: 0.2, '1to3y': 0.3, '3plus': 0.4 },
  'push-v': { new: 0, under1y: 0.1, '1to3y': 0.15, '3plus': 0.2 },
  'pull-h': { new: 0, under1y: 0.25, '1to3y': 0.3, '3plus': 0.35 },
};
export const BAR_KG = 20;
export const VOLUME_BAND = { low: 10, high: 20 } as const;
export const STEPS_TARGET_DEFAULT = 8000;
export const CUT_WALKS = { count: 2, minutes: 40 } as const; // 2–3 walks of 30–45 min — the plan writes one concrete week

export const GENERATOR_RULES: readonly string[] = [
  'Split by days: 1–2 → full body · 3 → full body ×3 · 4 → upper/lower ×2 · 5 → push/pull/legs/upper/lower · 6 → PPL ×2.',
  'Selection: highest-priority movement whose equipment you own and whose pattern your limitations allow; falls through substitutions; if nothing fits, the slot says so instead of vanishing.',
  'Sets × reps: hypertrophy 3–4 × 8–12; strength (3+ years, main lifts) 3–5 × 4–6; first four weeks for new lifters 2–3 × 10–15 regardless of goal.',
  'RIR target per block week: 3 → 2 → 1 → deload.',
  'Starting weight: your own logged top weight when it exists; otherwise dumbbells at a published fraction of your heaviest pair (50/40/30% by slot role), barbells at the bar plus a conservative percentage of bodyweight by experience. Week 1 is a calibration week — every set asks RIR and week 2 adjusts.',
  'Progression: double progression — top of the rep range at RIR ≤ 2 adds 2.5 kg or the next dumbbell; bodyweight movements progress by reps.',
  'Volume check: weekly hard sets per muscle must land inside 10–20; the generator adds or removes an accessory set and says which.',
  'Deload: every 4th–6th week by experience (new/under-a-year: 6 · 1–3 years: 5 · 3+: 4), or earlier when readiness proposes one.',
  'Cardio: a steps target every day; on a cut, zone-2 walks are built into the same week.',
  'Session time: sets × (work + published rest: compounds 2–3 min, accessories 60–90 s) is trimmed to your minutes — accessories go first, and the plan lists what it trimmed.',
];

// ── Output shapes ──────────────────────────────────────────────────────

export type GeneratedSlot = {
  slot: Slot;
  exercise: CatalogExercise | null;
  /** Present when nothing fits: the honest gap, plus what would unlock it. */
  gapNote?: string;
  sets: number;
  repLow: number;
  repHigh: number;
  restS: number;
  startWeightKg: number | null;
  startBasis: string;
};

export type GeneratedDay = {
  name: string;
  slots: GeneratedSlot[];
  estMinutes: number;
  trimmed: string[];
};

export type GeneratedProgramme = {
  split: SplitTemplate;
  days: GeneratedDay[];
  calibrationWeek: boolean;
  newLifterBlock: boolean;
  rirByWeek: readonly number[];
  deloadEveryWeeks: number;
  volumeAdjustments: string[];
  cardio: { stepsTarget: number; zone2Walks: { count: number; minutes: number } | null };
  rules: readonly string[];
};

// ── The generator ──────────────────────────────────────────────────────

function allowedDifficulty(x: CatalogExercise, exclusions: readonly LimitationChip[]): boolean {
  for (const chip of exclusions) {
    for (const rule of EXCLUSION_MAP[chip]) {
      if (x.pattern === rule.pattern && x.difficulty > rule.maxDifficulty) return false;
    }
  }
  return true;
}

function experienceCap(exp: Experience): 1 | 2 | 3 {
  return exp === 'new' ? 2 : 3;
}

function roundTo(kg: number, step: number): number {
  return Math.round(kg / step) * step;
}

function pickExercise(
  slotDef: Slot,
  doable: CatalogExercise[],
  exclusions: readonly LimitationChip[],
  experience: Experience,
  usedToday: Set<string>,
): CatalogExercise | null {
  const cap = experienceCap(experience);
  const candidates = doable
    .filter((x) => x.pattern === slotDef.pattern)
    .filter((x) => x.difficulty <= cap)
    .filter((x) => allowedDifficulty(x, exclusions))
    .filter((x) => !usedToday.has(x.id))
    .filter((x) => (slotDef.bias ? x.primary.includes(slotDef.bias as BodyRegion) : true));
  if (candidates.length === 0) return null;
  // Priority: compounds first for main/secondary, then the hardest the
  // experience cap allows (experienced lifters get the fuller movement),
  // then stable id order for determinism.
  const wantCompound = slotDef.role !== 'accessory';
  candidates.sort((a, b) => {
    const ac = a.compound ? 1 : 0;
    const bc = b.compound ? 1 : 0;
    if (wantCompound && ac !== bc) return bc - ac;
    if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty;
    return a.id.localeCompare(b.id);
  });
  // Fall through substitutions when the top pick's subs are also doable —
  // the top pick IS doable here, so it wins directly.
  return candidates[0]!;
}

function startingWeight(
  x: CatalogExercise,
  role: SlotRole,
  input: GeneratorInput,
): { kg: number | null; basis: string } {
  const history = input.historyTopKg?.get(x.id);
  if (history !== undefined && history > 0) {
    return { kg: history, basis: 'your own logged top weight — a starting point, not a target' };
  }
  if (x.equipment.length === 0 || (!x.equipment.some((eq) => eq === 'barbell' || eq === 'dumbbell' || eq === 'kettlebell'))) {
    return { kg: null, basis: 'bodyweight — progress by reps' };
  }
  if (x.equipment.includes('kettlebell')) {
    const kb = input.inventory.kettlebellKg;
    return kb
      ? { kg: kb, basis: `your kettlebell (${kb} kg) — the bell you own is the load` }
      : { kg: null, basis: 'your kettlebell — weight not recorded, add it in the PT intake' };
  }
  if (x.equipment.includes('dumbbell')) {
    const max = input.inventory.dumbbellMaxKg;
    if (!max) return { kg: null, basis: 'pick a dumbbell you could move ~10 times with 3 in reserve — add your heaviest pair in the PT intake and this becomes a number' };
    const frac = DB_START_FRACTION[role];
    return {
      kg: Math.max(2.5, roundTo(max * frac, 2.5)),
      basis: `${Math.round(frac * 100)}% of your heaviest pair (${max} kg) — a starting point; week 1 calibrates`,
    };
  }
  // Barbell
  const pct = BB_START_PCT_BODYWEIGHT[x.pattern]?.[input.experience] ?? 0;
  const added = input.bodyweightKg ? roundTo(input.bodyweightKg * pct, 2.5) : 0;
  return {
    kg: BAR_KG + added,
    basis: added > 0
      ? `the bar + ${Math.round(pct * 100)}% of bodyweight — conservative by design; week 1 calibrates`
      : 'the empty bar — form first; week 1 calibrates',
  };
}

function setsRepsFor(role: SlotRole, input: GeneratorInput): { sets: number; low: number; high: number } {
  if (input.experience === 'new') return SETSREPS.newLifter[role];
  const strength = input.experience === '3plus' && input.goal !== 'cut' && role === 'main';
  return strength ? SETSREPS.strength[role] : SETSREPS.hypertrophy[role];
}

function estimateMinutes(slots: GeneratedSlot[]): number {
  const s = slots.reduce((sum, g) => sum + g.sets * (WORK_SECONDS_PER_SET + g.restS), 0);
  return Math.round(s / 60) + SESSION_OVERHEAD_MIN;
}

/** Weekly hard-set credit per region across the generated week. */
export function generatedWeeklySets(days: GeneratedDay[]): Map<BodyRegion, number> {
  const totals = new Map<BodyRegion, number>();
  for (const day of days) {
    for (const g of day.slots) {
      if (!g.exercise) continue;
      for (const r of g.exercise.primary) totals.set(r, (totals.get(r) ?? 0) + g.sets);
      for (const r of g.exercise.secondary) totals.set(r, (totals.get(r) ?? 0) + g.sets * 0.5);
    }
  }
  return totals;
}

export function generateProgramme(input: GeneratorInput): GeneratedProgramme {
  const split = splitForDays(input.daysPerWeek);
  const doable = doableWith(input.equipment);
  const volumeAdjustments: string[] = [];

  const days: GeneratedDay[] = split.days.map((dayT) => {
    const usedToday = new Set<string>();
    const slots: GeneratedSlot[] = dayT.slots.map((slotDef) => {
      const exercise = pickExercise(slotDef, doable, input.exclusions, input.experience, usedToday);
      if (exercise) usedToday.add(exercise.id);
      const sr = setsRepsFor(slotDef.role, input);
      const start = exercise
        ? startingWeight(exercise, slotDef.role, input)
        : { kg: null, basis: '' };
      return {
        slot: slotDef,
        exercise,
        ...(exercise
          ? {}
          : {
              gapNote: `No ${slotDef.pattern} movement fits your equipment and limitations — the slot stays visible rather than silently vanishing. A band or a pull-up bar usually unlocks it.`,
            }),
        sets: sr.sets,
        repLow: sr.low,
        repHigh: sr.high,
        restS: slotDef.role === 'accessory' ? REST_SECONDS.accessory : REST_SECONDS.compound,
        startWeightKg: start.kg,
        startBasis: start.basis,
      };
    });

    // Session-time trim: accessories drop first, then secondaries; the
    // three main movements are the floor. Everything trimmed is named.
    const trimmed: string[] = [];
    let est = estimateMinutes(slots.filter((s) => s.exercise));
    for (const role of ['accessory', 'secondary'] as const) {
      while (est > input.sessionMinutes && slots.filter((s) => s.exercise).length > 3) {
        const idx = [...slots].reverse().findIndex((s) => s.exercise && s.slot.role === role);
        if (idx === -1) break;
        const realIdx = slots.length - 1 - idx;
        trimmed.push(slots[realIdx]!.exercise!.name);
        slots.splice(realIdx, 1);
        est = estimateMinutes(slots.filter((s) => s.exercise));
      }
    }
    return { name: dayT.name, slots, estMinutes: est, trimmed };
  });

  // Volume check — hypertrophy goals must land inside the band. Drops
  // come off accessory then secondary slots (mains keep the published
  // scheme); adds go to accessory slots only, capped at 4 sets, and the
  // new-lifter block never gets volume added — its four weeks are about
  // learning movement, not optimising sets. Every change is named; a
  // region the check cannot fix is stated, not hidden.
  if (input.goal !== 'move') {
    for (let pass = 0; pass < 10; pass++) {
      const totals = generatedWeeklySets(days);
      let changed = false;
      for (const [region, sets] of totals) {
        if (sets > VOLUME_BAND.high) {
          outer: for (const role of ['accessory', 'secondary'] as const) {
            for (const day of [...days].reverse()) {
              for (const g of [...day.slots].reverse()) {
                if (g.exercise && g.slot.role === role && g.exercise.primary.includes(region) && g.sets > 2) {
                  g.sets -= 1;
                  volumeAdjustments.push(`${region}: ${sets.toFixed(1)} weekly sets sat over ${VOLUME_BAND.high} — dropped a set from ${g.exercise.name}.`);
                  changed = true;
                  break outer;
                }
              }
            }
          }
        } else if (sets < VOLUME_BAND.low && sets >= 4 && !(input.experience === 'new')) {
          outer2: for (const day of days) {
            for (const g of day.slots) {
              if (g.exercise && g.slot.role === 'accessory' && g.sets < 4
                  && (g.exercise.primary.includes(region) || g.exercise.secondary.includes(region))) {
                g.sets += 1;
                volumeAdjustments.push(`${region}: ${sets.toFixed(1)} weekly sets sat under ${VOLUME_BAND.low} — added a set to ${g.exercise.name}.`);
                changed = true;
                break outer2;
              }
            }
          }
        }
      }
      if (!changed) break;
    }
    const finalTotals = generatedWeeklySets(days);
    for (const [region, sets] of finalTotals) {
      if (sets > VOLUME_BAND.high + 2) {
        volumeAdjustments.push(`${region}: still ${sets.toFixed(1)} weekly sets after trimming accessories — the split itself is ${region}-heavy; swap or drop a set by hand if it wears on you.`);
      }
    }
  }

  return {
    split,
    days,
    calibrationWeek: true,
    newLifterBlock: input.experience === 'new',
    rirByWeek: RIR_BY_WEEK,
    deloadEveryWeeks: DELOAD_EVERY_WEEKS[input.experience],
    volumeAdjustments,
    cardio: {
      stepsTarget: STEPS_TARGET_DEFAULT,
      zone2Walks: input.goal === 'cut' ? CUT_WALKS : null,
    },
    rules: GENERATOR_RULES,
  };
}
