import { describe, it, expect } from 'vitest';
import {
  SETTINGS_SECTIONS, profileSummary, appearanceSummary, pebbleSummary,
  extrasSummary, nutritionSummary, notificationsSummary, accountSummary, aboutSummary,
} from './settingsHomeModel';

// V4.1 §2 — the settings home is eight rows, each stating current values.

describe('settings home', () => {
  it('has the eight sections in the spec order', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.key)).toEqual([
      'profile', 'appearance', 'pebble', 'extras',
      'nutrition', 'notifications', 'account', 'about',
    ]);
  });

  it('appearance reads like the spec example — theme · detail · layout', () => {
    expect(appearanceSummary({ themeName: 'Gummy', detailTitle: 'Standard', layoutLabel: 'Tiles' }))
      .toBe('Gummy · Standard · Tiles');
  });

  it('profile summarises name, goals and target', () => {
    expect(profileSummary({ name: 'Cody', goalCount: 2, targetsKcal: 2500 }))
      .toBe('Cody · 2 goals · 2500 kcal target');
    expect(profileSummary({ name: null, goalCount: 0, targetsKcal: null }))
      .toBe('no name set · no goals · no targets yet');
  });

  it('pebble states off-as-default plainly, and the stage only when Grows is on', () => {
    expect(pebbleSummary(false, null)).toBe('off — default');
    expect(pebbleSummary(true, null)).toBe('on');
    expect(pebbleSummary(true, 3)).toBe('on · stage 3 of 5');
  });

  it('extras all-off says the core app — the registry law in one line', () => {
    expect(extrasSummary(0, 24)).toBe('all 24 off — the core app');
    expect(extrasSummary(3, 24)).toBe('3 of 24 on');
  });

  it('the rest state their values, never placeholders', () => {
    expect(nutritionSummary({ hideNumbers: true, challengeOn: true }))
      .toBe('numbers hidden · monthly challenge on');
    expect(notificationsSummary(0)).toBe('all off');
    expect(notificationsSummary(2)).toBe('2 on');
    expect(accountSummary('a@b.c')).toBe('a@b.c');
    expect(aboutSummary('0.2.1')).toBe('v0.2.1 · the promise, feedback');
  });
});
