import { describe, it, expect } from 'vitest';
import { SUPPLEMENTS_LAW, cleanSupplementName } from './supplements';

describe('supplements — the law and the name rule', () => {
  it('the law says no products and no doses, verbatim on the card', () => {
    expect(SUPPLEMENTS_LAW).toBe(
      'Your list, your words — Basalt never suggests a product or proposes a dose.',
    );
  });

  it('names are trimmed, whitespace-collapsed, bounded', () => {
    expect(cleanSupplementName('  creatine   monohydrate ')).toBe('creatine monohydrate');
    expect(cleanSupplementName('   ')).toBeNull();
    expect(cleanSupplementName('')).toBeNull();
    expect(cleanSupplementName('x'.repeat(81))).toBeNull();
    expect(cleanSupplementName('x'.repeat(80))).toBe('x'.repeat(80));
  });

  it('the module never ships suggestion copy — no catalogue, no dose table', () => {
    // Source-scan law: this file must not contain any product or dosing
    // vocabulary beyond the user's own stored words.
    const src = require('node:fs').readFileSync(require.resolve('./supplements.ts'), 'utf8');
    expect(src).not.toMatch(/recommended dose|daily dose|mg\b|suggested|popular supplements/i);
  });
});
