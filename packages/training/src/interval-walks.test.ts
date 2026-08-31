import { describe, it, expect } from 'vitest';
import { INTERVAL_WALKS, walkTotalSeconds, phaseAt, WALK_DONE_CUE } from './interval-walks';

describe('interval walk catalogue', () => {
  it('is a fixed three-session set — a picker, not a browsable library', () => {
    expect(INTERVAL_WALKS.map((w) => w.key)).toEqual(['intervals_20', 'brisk_build_30', 'steady_45']);
  });

  it('every session totals exactly the minutes its name states', () => {
    for (const w of INTERVAL_WALKS) {
      const stated = Number(w.name.match(/(\d+) min/)?.[1]);
      expect(walkTotalSeconds(w), w.key).toBe(stated * 60);
    }
  });

  it('cues use talk-test language, never pace numbers', () => {
    for (const w of INTERVAL_WALKS) {
      for (const p of w.phases) {
        expect(p.cue, `${w.key}/${p.effort}`).not.toMatch(/\d/);
      }
    }
  });

  it('spoken copy obeys the no-cheerleading law like printed copy', () => {
    const banned = /(great|awesome|amazing|crush|smash|you got this|well done|keep it up|proud)/i;
    for (const w of INTERVAL_WALKS) {
      for (const p of w.phases) expect(p.cue, w.key).not.toMatch(banned);
    }
    expect(WALK_DONE_CUE).not.toMatch(banned);
  });
});

describe('phaseAt', () => {
  const w = INTERVAL_WALKS[0]!; // 3 warm · 5×(1 brisk / 2 easy) · 2 cool

  it('walks the script by elapsed seconds', () => {
    expect(phaseAt(w, 0)!.phase.effort).toBe('warmup');
    expect(phaseAt(w, 179)!.phase.effort).toBe('warmup');
    expect(phaseAt(w, 180)!.phase.effort).toBe('brisk');
    expect(phaseAt(w, 240)!.phase.effort).toBe('easy');
  });

  it('reports remaining seconds inside the phase', () => {
    const pos = phaseAt(w, 200)!;
    expect(pos.phase.effort).toBe('brisk');
    expect(pos.phaseElapsedS).toBe(20);
    expect(pos.phaseRemainS).toBe(40);
  });

  it('null once the script ends — the recording is the user\'s, not the script\'s', () => {
    expect(phaseAt(w, walkTotalSeconds(w))).toBeNull();
    expect(phaseAt(w, walkTotalSeconds(w) - 1)).not.toBeNull();
  });
});
