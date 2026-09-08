import { describe, it, expect } from 'vitest';
import {
  INTAKE_RANGE_EXPLAINER, SOURCE_UNCERTAINTY, intakeRange, intakeRangeLine, uncertaintyFor,
} from './uncertainty';

describe('visible uncertainty — the published per-source model', () => {
  it('the percentages are pinned — changing them means changing the published explainer too', () => {
    expect(SOURCE_UNCERTAINTY).toEqual({
      barcode: 0.05, recipe: 0.1, manual: 0.1, search: 0.15,
      health_connect: 0.2, photo: 0.25, quick_add: 0.25,
    });
    expect(INTAKE_RANGE_EXPLAINER).toContain('barcode ±5%');
    expect(INTAKE_RANGE_EXPLAINER).toContain('photo or quick-add ±25%');
    expect(INTAKE_RANGE_EXPLAINER).toContain('A stated model, not a measurement.');
  });

  it('per-app health-connect sources fold to the base rate; unknown sources get the widest band', () => {
    expect(uncertaintyFor('health_connect:com.sec.android.app.shealth')).toBe(0.2);
    expect(uncertaintyFor('barcode')).toBe(0.05);
    expect(uncertaintyFor('something_new')).toBe(0.25);
    expect(uncertaintyFor(null)).toBe(0.1);
  });

  it('the range narrows when the same calories come from a tighter source', () => {
    const photo = intakeRange([{ calories: 600, source: 'photo' }]);
    const barcode = intakeRange([{ calories: 600, source: 'barcode' }]);
    expect(photo.low).toBe(450);
    expect(photo.high).toBe(750);
    expect(barcode.low).toBe(570);
    expect(barcode.high).toBe(630);
    expect(barcode.widthFraction).toBeLessThan(photo.widthFraction);
  });

  it('mixed days sum entry-by-entry — one loose entry cannot hide behind ten tight ones', () => {
    const r = intakeRange([
      { calories: 500, source: 'barcode' },
      { calories: 500, source: 'photo' },
    ]);
    expect(r.low).toBe(500 * 0.95 + 500 * 0.75);
    expect(r.high).toBe(500 * 1.05 + 500 * 1.25);
  });

  it('an empty day earns silence, not a zero range', () => {
    expect(intakeRangeLine([])).toBeNull();
    expect(intakeRange([]).widthFraction).toBe(0);
  });

  it('the hero line is plain words with the narrowing stated', () => {
    expect(intakeRangeLine([{ calories: 2000, source: 'search' }]))
      .toBe('likely 1,700–2,300 kcal eaten · narrows as entries are weighed');
  });
});
