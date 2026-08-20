import { describe, it, expect } from 'vitest';
import {
  WEEK_REVIEW_CONTENT, WEEK_REVIEW_NOTIF_ID, WEEK_REVIEW_TRIGGER,
} from './weekReviewNotifModel';

describe('week review notification contract', () => {
  it('fires Sunday 18:00, weekly (expo weekday 1 = Sunday)', () => {
    expect(WEEK_REVIEW_TRIGGER).toEqual({ type: 'weekly', weekday: 1, hour: 18, minute: 0 });
  });

  it('has a stable identifier so re-enabling replaces, never stacks', () => {
    expect(WEEK_REVIEW_NOTIF_ID).toBe('week-in-review');
  });

  it('carries no data and no cheerleading — a factual prompt only', () => {
    const text = `${WEEK_REVIEW_CONTENT.title} ${WEEK_REVIEW_CONTENT.body}`;
    expect(text).not.toMatch(/!|🎉|great|awesome|crush|streak|\d+ kcal|\d+ kg/i);
    expect(WEEK_REVIEW_CONTENT.body).toContain('your data');
  });
});
