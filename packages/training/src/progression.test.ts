import { describe, it, expect } from 'vitest';
import { suggestNext, suggestionText, roundToStep, type ProgressionInput, type ProgressionSet } from './progression';

const TODAY = new Date(2026, 7, 21);

const set = (weightKg: number | null, reps: number | null, rir: number | null, setType = 'normal'): ProgressionSet =>
  ({ setType, reps, weightKg, rir });

function input(sets: ProgressionSet[], daysAgo = 3, feedback: 'too_easy' | 'right' | 'too_hard' | null = null): ProgressionInput {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return { prev: { performedAt: d.toISOString(), sets, feedback }, today: TODAY };
}

describe('suggestNext — the published rules, in order', () => {
  it('0 · no history invents no numbers', () => {
    const s = suggestNext({ prev: null, today: TODAY });
    expect(s.kind).toBe('first_time');
    expect(s.weightKg).toBeNull();
    expect(s.reps).toBeNull();
    expect(s.basis).toContain('no history');
  });

  it('warmups are invisible to the engine', () => {
    const s = suggestNext(input([set(20, 10, null, 'warmup')]));
    expect(s.kind).toBe('first_time');
  });

  it('1 · ramp-back tiers: 14–27 days → 90%, 28+ → 80%, gap stated', () => {
    const sets = [set(60, 8, 2), set(60, 8, 2)];
    const twoWeeks = suggestNext(input(sets, 15));
    expect(twoWeeks.kind).toBe('ramp_back');
    expect(twoWeeks.weightKg).toBe(roundToStep(60 * 0.9)); // 55
    expect(twoWeeks.basis).toContain('15 days');

    const month = suggestNext(input(sets, 35));
    expect(month.weightKg).toBe(roundToStep(60 * 0.8)); // 47.5? → 48→ 47.5
    expect(month.basis).toContain('80%');
  });

  it('2 · RIR 0 or too-hard feedback lightens 5%', () => {
    const ground = suggestNext(input([set(100, 8, 0)]));
    expect(ground.kind).toBe('lighten');
    expect(ground.weightKg).toBe(95);
    expect(ground.basis).toContain('RIR 0');

    const marked = suggestNext(input([set(100, 8, 2)], 3, 'too_hard'));
    expect(marked.kind).toBe('lighten');
    expect(marked.basis).toContain('too hard');
  });

  it('3 · all sets at 12+ with reps in reserve → +2.5 kg, reps reset to 8', () => {
    const s = suggestNext(input([set(60, 12, 2), set(60, 12, 1)]));
    expect(s).toMatchObject({ kind: 'increase_load', weightKg: 62.5, reps: 8 });
    expect(s.basis).toContain('+2.5 kg');
  });

  it('3 · too-easy feedback jumps load even mid-range', () => {
    const s = suggestNext(input([set(60, 9, 3)], 3, 'too_easy'));
    expect(s).toMatchObject({ kind: 'increase_load', weightKg: 62.5 });
    expect(s.basis).toContain('too easy');
  });

  it('4 · mid-range with RIR ≥ 2 → +1 rep at the same load', () => {
    const s = suggestNext(input([set(60, 9, 2), set(60, 8, 3)]));
    expect(s).toMatchObject({ kind: 'increase_reps', weightKg: 60, reps: 10 });
  });

  it('5 · RIR 1 holds — consolidate, no false push', () => {
    const s = suggestNext(input([set(60, 10, 1)]));
    expect(s).toMatchObject({ kind: 'hold', weightKg: 60, reps: 10 });
  });

  it('no RIR recorded and reps mid-range → hold (no evidence, no push)', () => {
    const s = suggestNext(input([set(60, 10, null)]));
    expect(s.kind).toBe('hold');
  });

  it('bodyweight path progresses by reps only', () => {
    const roomy = suggestNext(input([set(null, 12, 3)]));
    expect(roomy).toMatchObject({ kind: 'increase_reps', weightKg: null, reps: 13 });
    const limit = suggestNext(input([set(null, 15, 0)]));
    // RIR 0 with no load: nothing to lighten — falls through to hold via rep path
    expect(limit.weightKg).toBeNull();
  });

  it('top working weight decides — back-off sets do not drag the suggestion down', () => {
    const s = suggestNext(input([set(100, 8, 2), set(90, 10, 3)]));
    expect(s.weightKg).toBe(100);
  });
});

describe('suggestionText', () => {
  it('reads as a suggestion with its basis, never a command', () => {
    const s = suggestNext(input([set(60, 9, 2)]));
    const text = suggestionText(s);
    expect(text).toContain('Suggested: 60 kg × 10');
    expect(text).toContain('—');
    expect(text.toLowerCase()).not.toMatch(/must|required|should\b/);
  });
});
