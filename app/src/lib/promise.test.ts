import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PROMISE_DOES, PROMISE_DOESNT, PROMISE_TITLE } from './promiseCopy';

// The honest promise (8g) lives in three places — the in-app screen, the
// store listing, and the tester release notes. This test pins them to the
// same substance so none drifts silently.

const ROOT = resolve(__dirname, '..', '..', '..');

describe('the promise — three copies, one substance', () => {
  it('the in-app screen has the title, three does, four doesn\'ts', () => {
    expect(PROMISE_TITLE).toBe('What Basalt does and doesn\u2019t do');
    expect(PROMISE_DOES).toHaveLength(3);
    expect(PROMISE_DOESNT).toHaveLength(4);
  });

  it('the store listing carries the same claims', () => {
    const listing = readFileSync(join(ROOT, 'docs', 'store-assets', 'listing.md'), 'utf8')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    for (const key of ['own numbers', 'maths behind every target', 'trend weight', 'see your form', 'muscle from fat', 'diagnose', 'eating disorders']) {
      expect(listing, key).toContain(key);
    }
  });

  it('the tester release notes carry the same claims', () => {
    // The notes are hard-wrapped inside a quote block — collapse before matching.
    const notes = readFileSync(join(ROOT, 'docs', 'PLAY-SUBMIT-TODAY.md'), 'utf8')
      .replace(/\n\s*>\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    for (const key of ['own numbers', 'maths behind every target', 'trend weight', 'see your form', 'diagnose']) {
      expect(notes, key).toContain(key);
    }
  });

  it('no promise line overpromises — banned verbs', () => {
    for (const line of [...PROMISE_DOES, ...PROMISE_DOESNT]) {
      expect(line).not.toMatch(/guarantee|perfect|transform|revolutioni[sz]e/i);
    }
  });
});
