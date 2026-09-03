import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

// The conformance suite can prove the six themes are sound; it cannot prove
// anyone USES them. Importing the static Minimal `color` palette from
// tokens.ts bypasses the theme contract entirely — every one of those
// references renders Minimal's colours in all six themes (the V3.2 Humanist
// shots showed macro rows in Minimal's light-gray ink2 on paper). This test
// bans the `color` import outside the theme system itself.

const REPO = resolve(__dirname, '../../../../..');
const ROOTS = [join(REPO, 'app', 'src'), join(REPO, 'packages', 'ui', 'src')];

// The theme system and the token definition are the only legitimate readers.
const ALLOWED = [
  `packages${sep}ui${sep}src${sep}theme${sep}`,
  `packages${sep}ui${sep}src${sep}tokens.ts`,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// Matches `color` as a named import (optionally aliased or amongst others)
// from '@basalt/ui' or any ../tokens path.
const IMPORT_RE =
  /import\s*(?:type\s*)?\{[^}]*\bcolor\b[^}]*\}\s*from\s*['"](?:@basalt\/ui|\.{1,2}\/(?:[\w/]*\/)?tokens)['"]/;

describe('theme bypass guard', () => {
  it('no file outside the theme system imports the static `color` palette', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (ALLOWED.some((a) => file.includes(a))) continue;
        if (IMPORT_RE.test(readFileSync(file, 'utf8'))) {
          offenders.push(file.slice(REPO.length + 1));
        }
      }
    }
    expect(offenders, `static-palette imports (route through useTheme()):\n${offenders.join('\n')}`).toEqual([]);
  });
});
