import { describe, it, expect } from 'vitest';
import {
  EXCLUSION_MAP, GENERATOR_RULES, equipmentSetFrom, generateProgramme, generatedWeeklySets,
  limitationChipsFrom, type GeneratorInput,
} from './generate';

const base = (over: Partial<GeneratorInput>): GeneratorInput => ({
  daysPerWeek: 3,
  sessionMinutes: 60,
  experience: '1to3y',
  goal: 'maintain',
  equipment: equipmentSetFrom('gym', []),
  inventory: {},
  exclusions: [],
  bodyweightKg: 82,
  ...over,
});

describe('the generator is deterministic and rule-published', () => {
  it('same input, same programme — twice', () => {
    const a = generateProgramme(base({}));
    const b = generateProgramme(base({}));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('the rules are readable strings covering every mechanism', () => {
    const all = GENERATOR_RULES.join(' ');
    for (const term of ['full body', 'substitutions', 'RIR', 'calibration', 'double progression', '10–20', 'deload', 'trimmed']) {
      expect(all.toLowerCase()).toContain(term.toLowerCase());
    }
  });
});

describe('worked example 1 — bodyweight + bands, 3×/week, new lifter, cut', () => {
  const p = generateProgramme(base({
    daysPerWeek: 3, sessionMinutes: 45, experience: 'new', goal: 'cut',
    equipment: equipmentSetFrom('home', ['Resistance bands', 'Bodyweight only']),
    bodyweightKg: 90,
  }));

  it('full body ×3, every slot filled from bands/bodyweight', () => {
    expect(p.split.id).toBe('fb3');
    for (const day of p.days) {
      for (const g of day.slots) {
        expect(g.exercise, `${day.name}/${g.slot.pattern}`).not.toBeNull();
        for (const eq of g.exercise!.equipment) expect(['bands']).toContain(eq);
      }
    }
  });

  it('new-lifter block: 2–3 sets of 10–15, calibration week on', () => {
    expect(p.newLifterBlock).toBe(true);
    expect(p.calibrationWeek).toBe(true);
    for (const day of p.days) {
      for (const g of day.slots) {
        expect(g.sets).toBeLessThanOrEqual(3);
        expect(g.repLow).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('cut gets zone-2 walks in the week; starting loads are bodyweight or band', () => {
    expect(p.cardio.zone2Walks).toEqual({ count: 2, minutes: 40 });
    for (const day of p.days) {
      for (const g of day.slots) {
        expect(g.startWeightKg).toBeNull(); // nothing to load
      }
    }
  });

  it('sessions fit 45 minutes', () => {
    for (const day of p.days) expect(day.estMinutes).toBeLessThanOrEqual(45);
  });
});

describe('worked example 2 — dumbbells to 20 kg + bench, 4×/week, 1–3 years, gain', () => {
  const p = generateProgramme(base({
    daysPerWeek: 4, sessionMinutes: 60, experience: '1to3y', goal: 'gain',
    equipment: equipmentSetFrom('home', ['Dumbbells', 'Bench']),
    inventory: { dumbbellMaxKg: 20 },
    bodyweightKg: 75,
  }));

  it('upper/lower ×2 with dumbbell starting loads from the published fractions', () => {
    expect(p.split.id).toBe('ul4');
    const withLoads = p.days.flatMap((d) => d.slots).filter((g) => g.startWeightKg !== null);
    expect(withLoads.length).toBeGreaterThan(0);
    for (const g of withLoads) {
      expect(g.startWeightKg!).toBeLessThanOrEqual(20);
      expect(g.startWeightKg! % 2.5).toBe(0);
      expect(g.startBasis).toContain('heaviest pair');
    }
  });

  it('hypertrophy sets × reps (3–4 × 8–12 on the big slots)', () => {
    const mains = p.days.flatMap((d) => d.slots).filter((g) => g.slot.role === 'main');
    for (const g of mains) {
      expect(g.sets).toBe(4);
      expect(g.repLow).toBe(8);
      expect(g.repHigh).toBe(12);
    }
  });

  it('every slot is filled or carries the honest gap note', () => {
    for (const day of p.days) {
      for (const g of day.slots) {
        if (!g.exercise) expect(g.gapNote).toContain('stays visible');
      }
    }
  });
});

describe('worked example 3 — full gym, 5×/week, 3+ years, maintain', () => {
  const p = generateProgramme(base({
    daysPerWeek: 5, sessionMinutes: 75, experience: '3plus', goal: 'maintain',
    equipment: equipmentSetFrom('gym', []),
    bodyweightKg: 82,
  }));

  it("PPL/UL — Cody's Gym split 1 shape — with strength mains at 4–6 reps", () => {
    expect(p.split.id).toBe('ppl-ul');
    const mains = p.days.flatMap((d) => d.slots).filter((g) => g.slot.role === 'main');
    for (const g of mains) {
      expect(g.repLow).toBe(4);
      expect(g.repHigh).toBe(6);
    }
  });

  it('barbell mains start at bar + published % of bodyweight, rounded to 2.5', () => {
    const barbell = p.days.flatMap((d) => d.slots)
      .filter((g) => g.exercise?.equipment.includes('barbell') && g.startWeightKg !== null);
    expect(barbell.length).toBeGreaterThan(0);
    for (const g of barbell) {
      expect(g.startWeightKg!).toBeGreaterThanOrEqual(20);
      expect((g.startWeightKg! - 20) % 2.5).toBe(0);
      expect(g.startBasis).toMatch(/bodyweight|empty bar/);
    }
  });

  it('deload every 4th week for 3+ years', () => {
    expect(p.deloadEveryWeeks).toBe(4);
  });

  it('weekly volume lands inside the band — or the plan says, by name, that it could not', () => {
    const totals = generatedWeeklySets(p.days);
    for (const region of ['chest', 'back', 'quads'] as const) {
      const sets = totals.get(region) ?? 0;
      expect(sets, region).toBeGreaterThanOrEqual(8);
      if (sets > 22) {
        // The published behaviour: the check trims what the scheme allows
        // and states the remainder instead of silently breaking 3–4×8–12.
        expect(p.volumeAdjustments.join(' '), region).toContain(`${region}: still`);
      }
    }
  });
});

describe('limitations and history', () => {
  it('a knee chip caps squat-pattern difficulty at 1 and the plan still fills the slot', () => {
    const p = generateProgramme(base({ exclusions: ['knee'] }));
    const squats = p.days.flatMap((d) => d.slots).filter((g) => g.slot.pattern === 'squat' && g.exercise);
    expect(squats.length).toBeGreaterThan(0);
    for (const g of squats) expect(g.exercise!.difficulty).toBe(1);
  });

  it('a shoulder chip removes push-v entirely — gap note when nothing fits', () => {
    const p = generateProgramme(base({
      exclusions: ['shoulder'],
      equipment: equipmentSetFrom('home', ['Bodyweight only']),
    }));
    const pushV = p.days.flatMap((d) => d.slots).filter((g) => g.slot.pattern === 'push-v');
    for (const g of pushV) {
      expect(g.exercise).toBeNull();
      expect(g.gapNote).toBeTruthy();
    }
    expect(EXCLUSION_MAP.shoulder[0]).toEqual({ pattern: 'push-v', maxDifficulty: 0 });
  });

  it('logged history beats every formula', () => {
    const p = generateProgramme(base({
      historyTopKg: new Map([['bb-back-squat', 90]]),
    }));
    const squat = p.days.flatMap((d) => d.slots).find((g) => g.exercise?.id === 'bb-back-squat');
    expect(squat?.startWeightKg).toBe(90);
    expect(squat?.startBasis).toContain('your own logged top weight');
  });

  it('condition strings map to chips', () => {
    expect(limitationChipsFrom(['Knee injury', 'Lower-back issues', 'Asthma'])).toEqual(['knee', 'lower_back']);
  });

  it('no starting weight is ever presented as more than a starting point', () => {
    const p = generateProgramme(base({ inventory: { dumbbellMaxKg: 20 }, equipment: equipmentSetFrom('home', ['Dumbbells']) }));
    for (const g of p.days.flatMap((d) => d.slots)) {
      if (g.startWeightKg !== null) {
        expect(g.startBasis).toMatch(/starting point|calibrates|bell you own|logged top weight/);
      }
    }
  });
});
