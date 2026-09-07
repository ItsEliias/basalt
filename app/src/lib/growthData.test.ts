import { describe, it, expect } from 'vitest';
import { GROWTH_WINDOW_DAYS as APP_WINDOW } from './growthData';
import { GROWTH_WINDOW_DAYS as EXTRAS_WINDOW } from '@basalt/extras/src/growth/model';

describe('growth window — the restated constant cannot drift', () => {
  it('app loader and extras model agree', () => {
    expect(APP_WINDOW).toBe(EXTRAS_WINDOW);
  });
});
