import { describe, it, expect } from 'vitest';
import { composeCoop, COOP_DAYS, COOP_DOT_RULE } from './coop';

const dots = (pairs: [string, boolean][]) => new Map(pairs);

describe('composeCoop', () => {
  const today = '2026-08-31';

  it(`renders exactly the last ${COOP_DAYS} days, oldest first`, () => {
    const r = composeCoop(dots([]), dots([]), today);
    expect(r.days).toHaveLength(COOP_DAYS);
    expect(r.days[0]!.date).toBe('2026-08-18');
    expect(r.days[COOP_DAYS - 1]!.date).toBe('2026-08-31');
  });

  it('unpublished days are null — unknown, never assumed inactive', () => {
    const r = composeCoop(dots([['2026-08-31', true]]), dots([]), today);
    expect(r.days[COOP_DAYS - 1]!.mine).toBe(true);
    expect(r.days[COOP_DAYS - 1]!.theirs).toBeNull();
    expect(r.days[0]!.mine).toBeNull();
  });

  it('presence lines are one fact per person, never a comparison', () => {
    const r = composeCoop(
      dots([['2026-08-30', true], ['2026-08-31', true]]),
      dots([['2026-08-31', false]]),
      today,
    );
    expect(r.mineLine).toBe('You: 2 of the last 14 days');
    expect(r.theirsLine).toBe('Them: 0 of the last 14 days');
  });

  it('FORBIDDEN-LIST RE-CHECK: no comparison or gamification language anywhere', () => {
    const r = composeCoop(dots([['2026-08-31', true]]), dots([]), today);
    const all = [r.mineLine, r.theirsLine, r.srcnote, COOP_DOT_RULE].join(' ');
    expect(all).not.toMatch(/(ahead|behind|beat|versus| vs |winn|losing|lead|catch up|score)/i);
    expect(all).not.toMatch(/(point|xp|level|badge|troph|confetti|cheer)/i);
  });

  it('the dot rule publishes what a dot means and what crosses', () => {
    expect(COOP_DOT_RULE).toMatch(/only thing your partner sees/i);
  });
});
