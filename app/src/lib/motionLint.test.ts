import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// V4.1 §5b — no component hard-codes a duration: every Animated.timing
// takes its duration from the theme (useMotion/motionTokens) or from DATA
// (a breathwork phase's own length). Literal millisecond durations live
// only in the motion module itself and the splash.

const ROOTS = [
  resolve(__dirname, '..'),                                   // app/src
  resolve(__dirname, '..', '..', '..', 'packages', 'ui', 'src'),
  resolve(__dirname, '..', '..', '..', 'packages', 'extras', 'src'),
];
const EXEMPT = [/[/\\]motion[/\\]/];

describe('motion lint', () => {
  it('no literal duration in any Animated.timing outside the motion module', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'node_modules' || name.startsWith('.')) continue;
          walk(p);
        } else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) {
          if (EXEMPT.some((re) => re.test(p))) continue;
          const src = readFileSync(p, 'utf8');
          for (const m of src.matchAll(/duration:\s*(\d+)\s*[,}]/g)) {
            offenders.push(`${p}: literal duration ${m[1]}`);
          }
        }
      }
    };
    for (const r of ROOTS) walk(r);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
