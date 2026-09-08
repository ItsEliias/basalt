import { describe, it, expect } from 'vitest';
import {
  CATALOG, CATALOG_BY_ID, demoSearchUrl, doableWith, type EquipmentItem, type MovementPattern,
} from './catalog';

const ALL: EquipmentItem[] = ['barbell', 'dumbbell', 'kettlebell', 'bands', 'bench', 'pullupbar', 'rack', 'cable', 'machine', 'cardio'];

// The five equipment tiers the spec demands coverage for.
const TIERS: Record<string, Set<EquipmentItem>> = {
  gym: new Set(ALL),
  dumbbell: new Set<EquipmentItem>(['dumbbell']),
  kettlebell: new Set<EquipmentItem>(['kettlebell']),
  bands: new Set<EquipmentItem>(['bands']),
  bodyweight: new Set<EquipmentItem>([]),
};
const PATTERNS: MovementPattern[] = ['squat', 'hinge', 'push-h', 'push-v', 'pull-h', 'pull-v', 'carry', 'core'];

describe('generator catalog — the shape the generator depends on', () => {
  it('has at least 120 exercises', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(120);
  });

  it('ids are unique and every substitution resolves', () => {
    expect(CATALOG_BY_ID.size).toBe(CATALOG.length);
    for (const x of CATALOG) {
      expect(x.subs.length, x.id).toBeGreaterThanOrEqual(1);
      expect(x.subs.length, x.id).toBeLessThanOrEqual(3);
      for (const sub of x.subs) {
        expect(CATALOG_BY_ID.has(sub), `${x.id} → ${sub}`).toBe(true);
        expect(sub).not.toBe(x.id);
      }
    }
  });

  it('every pattern is coverable at every tier', () => {
    for (const [tier, available] of Object.entries(TIERS)) {
      const doable = doableWith(available);
      for (const pattern of PATTERNS) {
        const hit = doable.some((x) => x.pattern === pattern);
        expect(hit, `${pattern} at ${tier}`).toBe(true);
      }
    }
  });

  it('every cue is two sentences: a do and an avoid', () => {
    for (const x of CATALOG) {
      expect(x.cue, x.id).toMatch(/Avoid/);
      const sentences = x.cue.replace(/¹/g, '').split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, x.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("Cody's 15 sheet descriptions are embedded verbatim", () => {
    const SHEET = [
      'Lie on a flat bench with a dumbbell in each hand, press them up to the ceiling.',
      'Place one knee and hand on a bench, lift a dumbbell with the opposite hand, pulling it towards your hip.',
      'Sit or stand, press dumbbells overhead, extending your arms.',
      'Hold a dumbbell close to your chest and perform squats.',
      'Stand and curl the dumbbells, targeting the biceps.',
      'Similar to flat bench press but on an incline bench, targeting the upper chest.',
      'Similar to dumbbell rows but performed with a barbell.',
      'Stand and lift dumbbells to the sides, targeting the lateral deltoids.',
      'Step forward or backward with one leg while holding dumbbells.',
      'Place your hands on a bench, lower and lift your body to work the triceps.',
      'Lie on a decline bench to emphasize the lower chest.',
      'Stand and row a dumbbell with one arm, stabilizing yourself with the opposite hand on a bench.',
      'Step onto a bench with one foot, alternating between legs.',
      'Lie on a flat bench, arms extended, and open and close the arms in a flye motion.',
      'Using a barbell, perform the classic bench press on a flat bench.',
    ];
    const allCues = CATALOG.map((x) => x.cue).join('\n');
    for (const line of SHEET) expect(allCues, line.slice(0, 40)).toContain(line);
  });

  it('the demo link is an honest web search, never a hosted video', () => {
    expect(demoSearchUrl('Goblet squat')).toContain('google.com/search');
    expect(demoSearchUrl('Goblet squat')).toContain('Goblet%20squat');
  });

  it('bodyweight entries require nothing; loaded entries name everything they need', () => {
    const pushup = CATALOG_BY_ID.get('push-up')!;
    expect(pushup.equipment).toEqual([]);
    const bench = CATALOG_BY_ID.get('bb-bench')!;
    expect(bench.equipment).toEqual(expect.arrayContaining(['barbell', 'bench', 'rack']));
  });

  it('no forbidden cheer in any cue', () => {
    for (const x of CATALOG) {
      expect(x.cue, x.id).not.toMatch(/crush|beast|killer|awesome|great job/i);
    }
  });
});
