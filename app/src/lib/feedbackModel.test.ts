import { describe, it, expect } from 'vitest';
import { FEEDBACK_EMAIL, buildFeedbackMailto, feedbackBody, feedbackSubject } from './feedbackModel';

const INPUT = {
  version: '0.1.0',
  build: '1',
  theme: 'candyRings',
  model: 'Pixel 10 Pro',
  androidRelease: '16',
};

describe('feedback mailto — facts only, all visible in the draft', () => {
  it('subject carries the version', () => {
    expect(feedbackSubject('0.1.0')).toBe('Basalt feedback v0.1.0');
    expect(feedbackSubject(null)).toBe('Basalt feedback vunknown');
  });

  it('body carries version+build, theme, device model and Android version', () => {
    const body = feedbackBody(INPUT);
    expect(body).toContain('App version: 0.1.0 (build 1)');
    expect(body).toContain('Theme: candyRings');
    expect(body).toContain('Device: Pixel 10 Pro');
    expect(body).toContain('Android: 16');
  });

  it('nulls degrade to honest unknowns, never crash', () => {
    const body = feedbackBody({ version: null, build: null, theme: 'minimal', model: null, androidRelease: null });
    expect(body).toContain('App version: unknown (build ?)');
    expect(body).toContain('Device: unknown');
  });

  it('the URL is a well-formed encoded mailto to the feedback address', () => {
    const url = buildFeedbackMailto(INPUT);
    expect(url.startsWith(`mailto:${FEEDBACK_EMAIL}?subject=`)).toBe(true);
    expect(url).toContain('Basalt%20feedback%20v0.1.0');
    expect(url).toContain('%0A');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('\n');
  });
});
