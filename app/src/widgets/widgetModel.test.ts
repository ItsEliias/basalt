import { describe, it, expect } from 'vitest';
import { parseSnapshot, widgetLines } from './widgetModel';

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
