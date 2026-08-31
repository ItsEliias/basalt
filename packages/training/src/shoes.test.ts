import { describe, it, expect } from 'vitest';
import { shoeStatusLine, SHOE_GUIDANCE } from './shoes';

describe('shoeStatusLine', () => {
  it('no threshold → just the fact', () => {
    expect(shoeStatusLine(231.4, null)).toBe('231 km');
  });

  it('under threshold → progress toward YOUR number', () => {
    expect(shoeStatusLine(420, 600)).toBe('420 km of your 600 km threshold');
  });

  it('past threshold → the fact stated, nothing else', () => {
    expect(shoeStatusLine(612, 600)).toBe('612 km · past your 600 km threshold');
  });

  it('never nags — no imperative replacement language anywhere', () => {
    const banned = /(replace now|time to replace|buy|new shoes now|worn out|should replace|!)/i;
    expect(shoeStatusLine(900, 600)).not.toMatch(banned);
    expect(SHOE_GUIDANCE).not.toMatch(/(buy|now!|urgent|must)/i);
  });

  it('guidance names its numbers and whose call it is', () => {
    expect(SHOE_GUIDANCE).toContain('500–800 km');
    expect(SHOE_GUIDANCE).toContain('your own threshold');
  });
});
