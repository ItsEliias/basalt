import { describe, it, expect } from 'vitest';
import { macroLine, parseReadinessSnapshot, parseSnapshot, readinessAgeText, widgetLines } from './widgetModel';

const NOW = Date.parse('2026-08-21T12:00:00Z');
const snap = {
  remainingKcal: 640, over: false, waterFilled: 3, waterTotal: 8,
  entryCount: 4, hideNumbers: false, at: '2026-08-21T11:59:30Z',
};

describe('widget snapshot', () => {
  it('renders remaining energy with its age and water ticks', () => {
    const lines = widgetLines(snap, NOW);
    expect(lines.headline).toBe('640 kcal left');
    expect(lines.sub).toBe('as of just now');
    expect(lines.water).toBe('▮▮▮▯▯▯▯▯');
  });

  it('over-target says over — plainly, no color of shame in the text', () => {
    expect(widgetLines({ ...snap, remainingKcal: -120, over: true }, NOW).headline).toBe('120 kcal over');
  });

  it('a stale snapshot states its age instead of posing as live', () => {
    const old = { ...snap, at: '2026-08-21T05:00:00Z' };
    expect(widgetLines(old, NOW).sub).toBe('as of 7 h ago');
  });

  it('hide-the-numbers carries through to the home screen', () => {
    const lines = widgetLines({ ...snap, hideNumbers: true }, NOW);
    expect(lines.headline).toBe('Logged — 4 items');
    expect(lines.headline).not.toContain('kcal');
  });

  it('no snapshot → an honest empty, and corruption parses to null', () => {
    expect(widgetLines(null, NOW).headline).toBe('Open Basalt');
    expect(parseSnapshot('garbage')).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot(JSON.stringify(snap))).toMatchObject({ remainingKcal: 640 });
  });
});

describe('macro line (widgets Extra)', () => {
  it('is absent without macros in the snapshot — the defaults widget is unchanged', () => {
    expect(macroLine(parseSnapshot(JSON.stringify(snap)))).toBeNull();
  });

  it('renders P/C/F against targets, fat over-cap in words', () => {
    const withMacros = { ...snap, macros: { p: 82.4, pt: 180, c: 190, ct: 279, f: 97.6, fcap: 93 } };
    expect(macroLine(parseSnapshot(JSON.stringify(withMacros))))
      .toBe('P 82/180 · C 190/279 · F 98/93 · 5 over');
  });

  it('hide-the-numbers hides macros too', () => {
    const hidden = { ...snap, hideNumbers: true, macros: { p: 82, pt: 180, c: 190, ct: 279, f: 41, fcap: 93 } };
    expect(macroLine(parseSnapshot(JSON.stringify(hidden)))).toBeNull();
  });
});

describe('readiness snapshot', () => {
  it('parses score + note + age; rejects garbage', () => {
    const r = parseReadinessSnapshot(JSON.stringify({ score: 71, note: 'HRV low', at: '2026-08-21T11:00:00Z' }));
    expect(r).toEqual({ score: 71, note: 'HRV low', at: '2026-08-21T11:00:00Z' });
    expect(parseReadinessSnapshot('not json')).toBeNull();
    expect(parseReadinessSnapshot(null)).toBeNull();
    expect(parseReadinessSnapshot(JSON.stringify({ score: 71 }))).toBeNull();
  });

  it('a null score survives the round trip — No number, never 0', () => {
    const r = parseReadinessSnapshot(JSON.stringify({ score: null, note: 'no wearable data', at: '2026-08-21T11:00:00Z' }));
    expect(r?.score).toBeNull();
    expect(r?.note).toBe('no wearable data');
  });

  it('states its age in plain words', () => {
    expect(readinessAgeText('2026-08-21T11:59:30Z', NOW)).toBe('just now');
    expect(readinessAgeText('2026-08-21T11:15:00Z', NOW)).toBe('45 min ago');
    expect(readinessAgeText('2026-08-21T08:00:00Z', NOW)).toBe('4 h ago');
  });
});
