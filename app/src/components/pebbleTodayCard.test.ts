import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// V4.1 §5 — Pebble on Today. Source-scan pins (the component imports
// react-native, so its laws are asserted structurally).

const SRC = readFileSync(resolve(__dirname, 'PebbleTodayCard.tsx'), 'utf8');
const TODAY = readFileSync(resolve(__dirname, '../screens/today/TodayScreen.tsx'), 'utf8');

describe('Pebble on Today', () => {
  it('the four suggested questions are verbatim', () => {
    for (const q of [
      "How's my week going?",
      'What should I eat for dinner to hit protein?',
      'Am I ready to train today?',
      'Why is my target 2,300?',
    ]) expect(SRC).toContain(q);
  });

  it('coach off shows exactly the one pointer line', () => {
    expect(SRC).toContain('Turn on Pebble Coach in Extras to ask questions');
  });

  it('the crisis detector runs before any network call, and the sheet is ungated', () => {
    expect(SRC.indexOf('checkCrisis')).toBeGreaterThan(-1);
    expect(SRC.indexOf('checkCrisis(q)')).toBeLessThan(SRC.indexOf('functions.invoke'));
    const gated = [...SRC.matchAll(/<ExtraSlot[\s\S]*?<\/ExtraSlot>/g)].some((m) => m[0].includes('<CrisisSheet'));
    expect(gated).toBe(false);
  });

  it('Today places the card by layout — above the rings, below the hero otherwise', () => {
    expect(TODAY).toContain("layout === 'rings' || theme.shape.meter === 'ring' ? pebbleCard");
    expect(TODAY).toContain("layout !== 'rings' && theme.shape.meter !== 'ring' ? pebbleCard");
  });
});
