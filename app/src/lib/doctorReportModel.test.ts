import { describe, it, expect } from 'vitest';
import { buildDoctorReportHtml, type DoctorReportInput } from './doctorReportModel';

const FULL: DoctorReportInput = {
  monthLabel: 'August 2026',
  generatedAtIso: '2026-08-21T12:00:00Z',
  weight: { entries: [{ date: '2026-08-01', kg: 84.2 }, { date: '2026-08-20', kg: 83.1 }], source: 'user weigh-ins' },
  sleep: { nights: 18, avgMin: 442, source: 'Health Connect (synced)' },
  activity: { stepDays: 25, stepsAvg: 9120, sessions: 12, volumeKg: 96000, walks: 6, walkKm: 21.4 },
  intake: { loggedDays: 61, minKcal: 1480, medianKcal: 2210, maxKcal: 3120, proteinMedianG: 152 },
  vitals: { hrv: { min: 48, median: 61, max: 79, days: 22 }, rhr: { min: 51, median: 55, max: 61, days: 25 }, source: 'Health Connect rollups' },
};

describe('buildDoctorReportHtml', () => {
  it('carries the data with sources named per section', () => {
    const html = buildDoctorReportHtml(FULL);
    expect(html).toContain('84.2 → 83.1 kg (-1.1 kg)');
    expect(html).toContain('7 h 22 min');
    expect(html).toContain('Source: user weigh-ins');
    expect(html).toContain('48–79 ms');
    expect(html).toContain('9,120/day over 25 recorded days');
  });

  it('intake is a range over logged days with unlogged days absent, not zero', () => {
    const html = buildDoctorReportHtml(FULL);
    expect(html).toContain('61 logged days · daily energy 1480–3120 kcal (median 2210)');
    expect(html).toContain('median protein 152 g');
    expect(html).toContain('unlogged days are absent, not zero');
  });

  it('absent data is stated, never dropped or estimated', () => {
    const html = buildDoctorReportHtml({ ...FULL, weight: null, sleep: null, activity: null, intake: null, vitals: { hrv: null, rhr: null, source: 'Health Connect rollups' } });
    expect(html).toContain('No body weight recorded in this period.');
    expect(html).toContain('No sleep recorded in this period.');
    expect(html).toContain('No food intake recorded in this period.');
    expect(html).toContain('not recorded');
    expect(html).toContain('nothing in this report is estimated');
  });

  it('frames itself honestly as self-recorded, non-clinical data', () => {
    const html = buildDoctorReportHtml(FULL);
    expect(html).toContain('not a clinical measurement record');
  });

  it('escapes injected markup in labels', () => {
    const html = buildDoctorReportHtml({ ...FULL, monthLabel: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
