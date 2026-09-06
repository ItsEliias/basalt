import { describe, it, expect } from 'vitest';
import {
  PEBBLE_DEFAULTS, normalizePebbleSettings, parsePebbleSettings,
  pebbleAllowedOnSurface, pebbleVisible, type PebbleSettings, type PebbleSurface,
  macroShortfallProposal, readinessSwapProposal, sleepDebtProposal,
  progressionProposal, pickProposal,
  voicedContent, allNotifContents, PEBBLE_NOTIF_TITLE,
} from './pebbleModel';

const ON: PebbleSettings = { showInApp: true, notifVoice: true, onDataScreens: true };
const SURFACES: PebbleSurface[] = ['today', 'log', 'train', 'recover', 'trends', 'data', 'empty', 'error'];

const PROPOSAL = macroShortfallProposal({ proteinG: 142, proteinTargetG: 180, entriesLogged: 3, hour: 18 })!;

describe('the rendering law — no proposal, no Pebble; never on empty/error', () => {
  it('off by default: every toggle starts false', () => {
    expect(PEBBLE_DEFAULTS).toEqual({ showInApp: false, notifVoice: false, onDataScreens: false });
  });

  it('null proposal renders nothing on every surface under every setting', () => {
    for (const surface of SURFACES) {
      expect(pebbleVisible(ON, surface, null)).toBe(false);
      expect(pebbleVisible(PEBBLE_DEFAULTS, surface, null)).toBe(false);
    }
  });

  it('empty states and errors never show Pebble, even fully opted in', () => {
    expect(pebbleVisible(ON, 'empty', PROPOSAL)).toBe(false);
    expect(pebbleVisible(ON, 'error', PROPOSAL)).toBe(false);
  });

  it('Trends and data screens need their own opt-in', () => {
    const noData: PebbleSettings = { ...ON, onDataScreens: false };
    expect(pebbleAllowedOnSurface(noData, 'trends')).toBe(false);
    expect(pebbleAllowedOnSurface(noData, 'data')).toBe(false);
    expect(pebbleAllowedOnSurface(ON, 'trends')).toBe(true);
    expect(pebbleAllowedOnSurface(noData, 'today')).toBe(true);
  });

  it('master toggle off silences every surface', () => {
    const off: PebbleSettings = { ...ON, showInApp: false };
    for (const surface of SURFACES) {
      expect(pebbleVisible(normalizePebbleSettings(off), surface, PROPOSAL)).toBe(false);
    }
  });
});

describe('settings normalization — notif voice depends on the master toggle', () => {
  it('turning the master off drags the voice off', () => {
    expect(normalizePebbleSettings({ showInApp: false, notifVoice: true, onDataScreens: true }))
      .toEqual({ showInApp: false, notifVoice: false, onDataScreens: true });
  });
  it('parses stored JSON and junk safely', () => {
    expect(parsePebbleSettings(null)).toEqual(PEBBLE_DEFAULTS);
    expect(parsePebbleSettings('not json')).toEqual(PEBBLE_DEFAULTS);
    expect(parsePebbleSettings('{"showInApp":true,"notifVoice":true}'))
      .toEqual({ showInApp: true, notifVoice: true, onDataScreens: false });
    expect(parsePebbleSettings('{"notifVoice":true}')).toEqual(PEBBLE_DEFAULTS);
  });
});

describe('proposals — always from an engine value, always with a way out', () => {
  it('macro shortfall needs a logged day, a real gap and eating hours left', () => {
    expect(macroShortfallProposal({ proteinG: 0, proteinTargetG: 180, entriesLogged: 0, hour: 18 })).toBeNull();
    expect(macroShortfallProposal({ proteinG: 170, proteinTargetG: 180, entriesLogged: 3, hour: 18 })).toBeNull();
    expect(macroShortfallProposal({ proteinG: 100, proteinTargetG: 180, entriesLogged: 3, hour: 23 })).toBeNull();
    const p = macroShortfallProposal({ proteinG: 142, proteinTargetG: 180, entriesLogged: 3, hour: 18 })!;
    expect(p.text).toContain('40 g short');
    expect(p.actions).toHaveLength(2);
    expect(p.actions[1].kind).toBe('dismiss');
  });

  it('readiness swap needs a low score AND a session to lighten', () => {
    expect(readinessSwapProposal({ score: 80, band: 6, hasSessionToday: true })).toBeNull();
    expect(readinessSwapProposal({ score: 58, band: 6, hasSessionToday: false })).toBeNull();
    expect(readinessSwapProposal({ score: null, band: null, hasSessionToday: true })).toBeNull();
    const p = readinessSwapProposal({ score: 58, band: 6, hasSessionToday: true })!;
    expect(p.text).toContain('58, ±6');
    expect(p.actions[0].kind).toBe('open-train');
  });

  it('sleep debt speaks only from measured sleep and a set target', () => {
    expect(sleepDebtProposal({ sleepHours: null, sleepTargetMin: 480 })).toBeNull();
    expect(sleepDebtProposal({ sleepHours: 7.5, sleepTargetMin: 480 })).toBeNull();
    const p = sleepDebtProposal({ sleepHours: 6, sleepTargetMin: 480 })!;
    expect(p.text).toContain('2 h');
    expect(p.actions[0].kind).toBe('open-recover');
  });

  it('progression only proposes when the engine produced numbers', () => {
    expect(progressionProposal({ exercise: 'Bench press', weightKg: null, reps: null })).toBeNull();
    const p = progressionProposal({ exercise: 'Bench press', weightKg: 62.5, reps: 8 })!;
    expect(p.text).toContain('62.5 kg × 8');
  });

  it('every proposal carries exactly two actions and a dismiss', () => {
    const all = [
      PROPOSAL,
      readinessSwapProposal({ score: 58, band: 6, hasSessionToday: true })!,
      sleepDebtProposal({ sleepHours: 6, sleepTargetMin: 480 })!,
      progressionProposal({ exercise: 'Squat', weightKg: 100, reps: 5 })!,
    ];
    for (const p of all) {
      expect(p.actions).toHaveLength(2);
      expect(p.actions.some((a) => a.kind === 'dismiss')).toBe(true);
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it('dismissal removes a proposal for the day; the next candidate steps up', () => {
    const sleep = sleepDebtProposal({ sleepHours: 6, sleepTargetMin: 480 })!;
    expect(pickProposal([PROPOSAL, sleep], [])).toBe(PROPOSAL);
    expect(pickProposal([PROPOSAL, sleep], [PROPOSAL.id])).toBe(sleep);
    expect(pickProposal([PROPOSAL, sleep], [PROPOSAL.id, sleep.id])).toBeNull();
  });
});

describe('the voice law — identical notifications, different voice only', () => {
  const INPUT = { weekReviewOn: true, monthlyReportOn: true, vitalsHeadline: 'Resting HR 12% above your range' };

  it('the scheduled set is identical with Pebble on and off apart from title/icon', () => {
    const on = allNotifContents({ ...INPUT, pebbleVoice: true });
    const off = allNotifContents({ ...INPUT, pebbleVoice: false });
    expect(on.map((n) => ({ id: n.id, body: n.body }))).toEqual(off.map((n) => ({ id: n.id, body: n.body })));
    expect(on.length).toBe(off.length);
    for (const n of on) expect(n.title).toBe(PEBBLE_NOTIF_TITLE);
    for (const n of on) expect(n.icon).toBe('pebble');
    for (const n of off) expect(n.icon).toBe('default');
    for (const n of off) expect(n.title).not.toBe(PEBBLE_NOTIF_TITLE);
  });

  it('no notification exists only because Pebble is on', () => {
    for (const flags of [
      { weekReviewOn: false, monthlyReportOn: false, vitalsHeadline: null },
      { weekReviewOn: true, monthlyReportOn: false, vitalsHeadline: null },
      INPUT,
    ]) {
      const on = allNotifContents({ ...flags, pebbleVoice: true });
      const off = allNotifContents({ ...flags, pebbleVoice: false });
      expect(on.map((n) => n.id)).toEqual(off.map((n) => n.id));
    }
  });

  it('voicedContent never edits the body', () => {
    const base = { id: 'x', title: 'Week in review', body: 'Written from your data — open Trends to read it.' };
    expect(voicedContent(base, true).body).toBe(base.body);
    expect(voicedContent(base, false)).toEqual({ ...base, icon: 'default' });
  });
});
