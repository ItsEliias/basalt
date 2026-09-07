import { describe, it, expect } from 'vitest';
import { NARRATIVE_LABEL, narrativeDateFor, narrativeWorthwhile } from './model';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('daily narrative — labelled narration, morning-after, opt-in only', () => {
  it('the label names generation, and the card renders it unconditionally', () => {
    expect(NARRATIVE_LABEL).toBe('Generated summary');
    const src = readFileSync(resolve(__dirname, 'NarrativeCard.tsx'), 'utf8');
    expect(src).toContain('NARRATIVE_LABEL');
    expect(src).not.toMatch(/hideLabel|showLabel/);
  });

  it('summarises yesterday, never today', () => {
    expect(narrativeDateFor(new Date('2026-09-07T08:00:00Z'))).toBe('2026-09-06');
  });

  it('an empty day earns silence, not a paragraph about absence', () => {
    const empty = { date: 'd', calories: null, targetCalories: null, proteinG: null,
      entryCount: 0, sessionCount: 0, walkKm: null, sleepHours: null };
    expect(narrativeWorthwhile(empty)).toBe(false);
    expect(narrativeWorthwhile({ ...empty, sleepHours: 7 })).toBe(true);
  });

  it('never on Trends: no Trends screen imports the narrative surface', () => {
    const trends = readFileSync(resolve(__dirname, '..', '..', '..', '..', 'app', 'src', 'screens', 'trends', 'TrendsScreen.tsx'), 'utf8');
    expect(trends).not.toContain('Narrative');
  });

  it('never a notification: no notification module touches the narrative', () => {
    for (const f of ['weekReviewNotif.ts', 'monthlyReportNotif.ts', 'backgroundWork.ts', 'pebbleRevoice.ts']) {
      const src = readFileSync(resolve(__dirname, '..', '..', '..', '..', 'app', 'src', 'lib', f), 'utf8');
      expect(src, `${f} references the narrative`).not.toMatch(/narrative|daily-summary/i);
    }
  });
});
