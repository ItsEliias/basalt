import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { EXTRAS } from './registry';

// V4.1 §6 — the README's Extras section is generated from this registry
// and may not drift: every extra must appear by title with its one-liner,
// and every image the README references must exist at the commit.

const REPO = resolve(__dirname, '..', '..', '..', '..');
const README = readFileSync(resolve(REPO, 'README.md'), 'utf8');

describe('README drift', () => {
  it('lists every registry extra with its exact title and one-liner', () => {
    for (const e of EXTRAS) {
      expect(README, `README missing extra "${e.title}"`).toContain(`**${e.title}**`);
      expect(README, `README one-liner drifted for "${e.title}"`).toContain(e.oneLiner);
    }
  });

  it('every referenced image exists — no stale references', () => {
    for (const m of README.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const p = resolve(REPO, m[1]!);
      expect(existsSync(p), `README references missing image ${m[1]}`).toBe(true);
    }
  });

  it('the promise text is verbatim', () => {
    // Keep in sync with app/src/lib/promiseCopy.ts (whitespace-normalised).
    const promise = readFileSync(resolve(REPO, 'app', 'src', 'lib', 'promiseCopy.ts'), 'utf8');
    for (const m of promise.matchAll(/'([^']{40,})'/g)) {
      const line = m[1]!.replace(/\\u2014/g, '—').replace(/\\u2019/g, '’').replace(/\\'/g, "'");
      const norm = (t: string) => t.replace(/\s+/g, ' ');
      expect(norm(README), `README promise drifted: "${line.slice(0, 40)}…"`).toContain(norm(line));
    }
  });
});
