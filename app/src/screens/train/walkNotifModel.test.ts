import { describe, it, expect } from 'vitest';
import { walkNotifText, walkPaceText, walkDistanceText } from './walkNotifModel';

describe('walk notification text — distance · pace · elapsed, honest pace', () => {
  it('no pace under 100 m — early noise is not a pace', () => {
    expect(walkPaceText(80, 60)).toBeNull();
    expect(walkPaceText(1000, 360)).toBe('06:00 /km');
  });
  it('metres then kilometres at 2dp', () => {
    expect(walkDistanceText(999)).toBe('999 m');
    expect(walkDistanceText(1240)).toBe('1.24 km');
  });
  it('paused says so in title and body', () => {
    const t = walkNotifText({ distM: 1240, movingS: 745, paused: true });
    expect(t.title).toContain('paused');
    expect(t.body.startsWith('Paused · ')).toBe(true);
  });
  it('running text carries all three parts', () => {
    const t = walkNotifText({ distM: 2000, movingS: 720, paused: false });
    expect(t.body).toBe('2.00 km · 06:00 /km · 12:00');
  });
});
