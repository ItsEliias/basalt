import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CRISIS_BODY, CRISIS_HEADING, checkCrisis, crisisResourcesFor } from './crisis';

// The fixed phrases every text entry point must trigger on — the app-side
// test imports this same list, so detector and wiring can never drift.
export const CRISIS_TEST_PHRASES = [
  'i want to kill myself',
  'I have been thinking about suicide',
  'sometimes I just want to die',
  'planning to hurt myself tonight',
  "there's no point anymore",
  'so tired of being alive',
];

describe('crisis detector — always on, over-broad by design', () => {
  it('every fixed test phrase triggers', () => {
    for (const p of CRISIS_TEST_PHRASES) expect(checkCrisis(p), p).toBe(true);
  });

  it('unsure phrases trigger too — false positives are acceptable, false negatives are not', () => {
    expect(checkCrisis("I just can't go on like this")).toBe(true);
    expect(checkCrisis('what is the point of living')).toBe(true);
  });

  it('ordinary logging text does not trigger', () => {
    for (const p of ['killed leg day', 'this diet is killing me at parties', 'dead tired after the shift', 'chicken and rice again']) {
      expect(checkCrisis(p), p).toBe(false);
    }
  });

  it('is pure and setting-free — no imports at all, so no storage and no extras can gate it', () => {
    const src = readFileSync(require.resolve('./crisis.ts'), 'utf8');
    expect(src).not.toMatch(/^import /m);
    expect(src).not.toMatch(/AsyncStorage|ExtrasState|EXTRAS_|extraOn\(/);
  });
});

describe('regional resources', () => {
  it('AU gets Lifeline 13 11 14 and 000', () => {
    const r = crisisResourcesFor('AU');
    expect(r.lines[0]).toEqual({ name: 'Lifeline', phone: '13 11 14', sms: '0477 13 11 14' });
    expect(r.emergency).toBe('000');
  });

  it('NZ 1737 · UK/IE Samaritans 116 123 · US/CA 988', () => {
    expect(crisisResourcesFor('NZ').lines[0]?.phone).toBe('1737');
    expect(crisisResourcesFor('GB').lines[0]?.phone).toBe('116 123');
    expect(crisisResourcesFor('IE').lines[0]?.phone).toBe('116 123');
    expect(crisisResourcesFor('US').lines[0]?.phone).toBe('988');
    expect(crisisResourcesFor('CA').lines[0]?.phone).toBe('988');
  });

  it('everywhere else gets the directory, never nothing', () => {
    const r = crisisResourcesFor('DE');
    expect(r.lines).toEqual([]);
    expect(r.directory).toBe('https://findahelpline.com');
    expect(crisisResourcesFor(null).directory).toBe('https://findahelpline.com');
  });

  it('the screen copy is plain words — no mascot, no are-you-sure, and it says the entry saved', () => {
    expect(CRISIS_HEADING).toBe('This sounds heavy.');
    expect(CRISIS_BODY).toContain('still saved');
    expect(CRISIS_BODY).toContain('nothing was sent anywhere');
    expect(CRISIS_BODY).not.toMatch(/are you sure|pebble/i);
  });
});
