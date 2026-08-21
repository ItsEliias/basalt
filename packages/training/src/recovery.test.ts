import { describe, it, expect } from 'vitest';
import { computeRecovery, recoveryIntensity, parseOverrides, serializeOverrides, RECOVERY_RULES } from './recovery';

const H = 3600_000;
const NOW = 1_000_000 * H;

describe('computeRecovery — the published rules', () => {
  it('48h base: loaded early, recovering past halfway, fresh after', () => {
    const ev = (hoursAgo: number) => [{ region: 'chest' as const, atMs: NOW - hoursAgo * H, sets: 4 }];
    expect(computeRecovery(ev(6), { nowMs: NOW, shortSleep: false })[0]!.status).toBe('loaded');
    expect(computeRecovery(ev(30), { nowMs: NOW, shortSleep: false })[0]!.status).toBe('recovering');
    expect(computeRecovery(ev(50), { nowMs: NOW, shortSleep: false })[0]!.status).toBe('fresh');
  });

  it('volume extends the window: 16 sets → +12h, capped at +24h', () => {
    const events = [{ region: 'quads' as const, atMs: NOW - 1 * H, sets: 16 }];
    const r = computeRecovery(events, { nowMs: NOW, shortSleep: false })[0]!;
    expect(r.readyAtMs).toBe(NOW - 1 * H + (48 + 12) * H);
    const heavy = computeRecovery([{ region: 'quads' as const, atMs: NOW, sets: 60 }], { nowMs: NOW, shortSleep: false })[0]!;
    expect(heavy.readyAtMs).toBe(NOW + (48 + 24) * H); // cap
  });

  it('a short night extends every open window by 20%, and the why says so', () => {
    const events = [{ region: 'back' as const, atMs: NOW, sets: 4 }];
    const r = computeRecovery(events, { nowMs: NOW, shortSleep: true })[0]!;
    expect(r.readyAtMs).toBe(NOW + 48 * 1.2 * H);
    expect(r.why).toContain('short night');
  });

  it('sets older than 72h are gone — no lingering ghosts', () => {
    const events = [{ region: 'arms' as const, atMs: NOW - 80 * H, sets: 10 }];
    expect(computeRecovery(events, { nowMs: NOW, shortSleep: false })).toEqual([]);
  });

  it("an override wins and is labeled as the user's call", () => {
    const events = [{ region: 'chest' as const, atMs: NOW, sets: 10 }];
    const r = computeRecovery(events, { nowMs: NOW, shortSleep: false, overrides: ['chest'] })[0]!;
    expect(r.status).toBe('overridden');
    expect(r.why).toContain('your call');
  });

  it('intensity maps loadedness, quiet for untouched regions', () => {
    const i = recoveryIntensity([
      { region: 'chest', status: 'loaded', readyAtMs: 0, hardSets72h: 9, why: '' },
      { region: 'back', status: 'fresh', readyAtMs: 0, hardSets72h: 3, why: '' },
    ]);
    expect(i.chest).toBe(1);
    expect(i.back).toBe(0.25);
    expect(i.quads).toBeUndefined();
  });
});

describe('override persistence', () => {
  it('round-trips for today; expires yesterday; survives corruption', () => {
    const json = serializeOverrides(['chest', 'quads'], '2026-08-21');
    expect(parseOverrides(json, '2026-08-21')).toEqual(['chest', 'quads']);
    expect(parseOverrides(json, '2026-08-22')).toEqual([]);
    expect(parseOverrides('garbage', '2026-08-21')).toEqual([]);
  });
});
