import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COACH_DEFLECTIONS, COACH_SUBLABEL, coachLocalGuard, parseCoachReply } from './model';

describe('coach hard limits — device-side, before any network call', () => {
  it('medical questions get "one for a doctor"', () => {
    for (const q of ['can you diagnose this', 'I have chest pain after training', 'is my medication okay with fasting']) {
      const g = coachLocalGuard(q);
      expect(g?.kind, q).toBe('medical');
      expect(g?.reply).toContain('for a doctor');
    }
  });

  it('dosing questions are deflected — no dose ever', () => {
    for (const q of ['how much creatine should I use', 'what dose of melatonin', 'is it safe to take 400mg caffeine']) {
      const g = coachLocalGuard(q);
      expect(['dosing', 'medical']).toContain(g?.kind);
      if (g?.kind === 'dosing') expect(g.reply).toContain('never proposes doses');
    }
  });

  it('disordered-eating signals end coaching and point to help — outranking everything', () => {
    for (const q of ['what if I just stop eating', 'how to purge after a binge', 'I want to fast for days to punish myself']) {
      const g = coachLocalGuard(q);
      expect(g?.kind, q).toBe('disordered');
      expect(g?.reply).toContain('Butterfly Foundation');
      expect(g?.reply).toContain('will not coach restriction');
    }
  });

  it('ordinary questions pass through', () => {
    expect(coachLocalGuard('why is my protein target 156 g?')).toBeNull();
    expect(coachLocalGuard('what does my readiness number mean today')).toBeNull();
  });

  it('deflection copy never diagnoses, doses, or cheers', () => {
    for (const reply of Object.values(COACH_DEFLECTIONS)) {
      expect(reply).not.toMatch(/you (probably|likely) have/i);
      expect(reply).not.toMatch(/\d+ ?mg/);
      expect(reply).not.toMatch(/great|you've got this|don't worry/i);
    }
  });
});

describe('coach replies — grounded and bounded', () => {
  it('parses a valid reply and rejects malformed ones', () => {
    expect(parseCoachReply({ answer: 'x', citedNumbers: ['readiness 71'], action: null })).toEqual({
      answer: 'x', citedNumbers: ['readiness 71'], action: null,
    });
    expect(parseCoachReply({ answer: 'x', citedNumbers: [], action: { label: 'Open Recover', kind: 'open-recover' } })?.action?.kind).toBe('open-recover');
    expect(parseCoachReply({ answer: 'x', citedNumbers: [], action: { label: 'Edit', kind: 'edit-data' } })?.action).toBeNull();
    expect(parseCoachReply({ answer: 'x' })).toBeNull();
    expect(parseCoachReply(null)).toBeNull();
  });

  it('the sublabel states the three laws', () => {
    expect(COACH_SUBLABEL).toContain('only your stored numbers');
    expect(COACH_SUBLABEL).toContain('never edits');
    expect(COACH_SUBLABEL).toContain('only speaks when asked');
  });

  it('never initiates — the module contains no scheduling or notification code', () => {
    const src = readFileSync(require.resolve('./model.ts'), 'utf8');
    expect(src).not.toMatch(/Notifications|scheduleNotification|setInterval|setTimeout/);
  });
});
