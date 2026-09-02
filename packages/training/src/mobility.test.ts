import { describe, it, expect } from 'vitest';
import {
  STRETCHES, MOBILITY_ROUTINES, ASSESSED_POSITIONS,
  mobilityTimeline, timelineTotalS, orderByEmphasis,
} from './mobility';
import { MIN_TRANSITION_S } from './guided-timer';
import * as mobility from './mobility';

describe('the catalogue — a tool, not a library', () => {
  it('nine stretches, three fixed routines, four assessed positions', () => {
    expect(STRETCHES).toHaveLength(9);
    expect(MOBILITY_ROUTINES.map((r) => r.key)).toEqual(['morning_5', 'post_walk_5', 'desk_8']);
    expect(ASSESSED_POSITIONS).toHaveLength(4);
  });

  it('every routine key resolves to a real stretch', () => {
    for (const r of MOBILITY_ROUTINES) {
      for (const k of r.stretchKeys) {
        expect(STRETCHES.some((s) => s.key === k), `${r.key}/${k}`).toBe(true);
      }
    }
  });
});

describe('timeline arithmetic — stated minutes are exact', () => {
  it.each(MOBILITY_ROUTINES.map((r) => [r.key, r] as const))('%s totals its name', (_k, r) => {
    expect(timelineTotalS(mobilityTimeline(r))).toBe(r.totalMin * 60);
  });

  it('every transition honors the shipped floor', () => {
    for (const r of MOBILITY_ROUTINES) {
      for (const p of mobilityTimeline(r)) {
        if (p.kind === 'transition') expect(p.seconds).toBeGreaterThanOrEqual(MIN_TRANSITION_S);
      }
    }
  });

  it('bilateral stretches get both sides, in order', () => {
    const t = mobilityTimeline(MOBILITY_ROUTINES[0]!);
    const f4 = t.filter((p) => p.stretch.key === 'figure_four' && p.kind === 'hold');
    expect(f4.map((p) => p.side)).toEqual(['left', 'right']);
  });
});

describe('assessment — reorders emphasis, and that is ALL it does', () => {
  it('lowest-rated position moves first; unrated stays put; empty = untouched', () => {
    const keys = MOBILITY_ROUTINES[0]!.stretchKeys; // cat_cow, hip_flexor, hamstring_fold, figure_four
    expect(orderByEmphasis(keys, {})).toEqual(keys);
    const reordered = orderByEmphasis(keys, { hip_rotation: 1, forward_fold: 4 });
    expect(reordered[0]).toBe('figure_four'); // hip_rotation rated worst
  });

  it('NO SCORE EXISTS: the module exports nothing that aggregates the ratings', () => {
    const exported = Object.keys(mobility);
    expect(exported.join(' ')).not.toMatch(/score|percent|grade|index/i);
    // and no assessment copy speaks in percentages
    for (const p of ASSESSED_POSITIONS) {
      expect(p.label + p.anchors.join(' ')).not.toMatch(/%|score/i);
    }
  });
});
