import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DETAIL_OPTIONS, atLeast, heroDisplay, readinessWord, simpleMacroLine, todayNumbersFor,
  type SeedDay,
} from './detailModel';

const SEED: SeedDay = {
  remainingKcal: 283, proteinG: 127, proteinTargetG: 195,
  carbsG: 321, carbsTargetG: 230, fatG: 102, fatCapG: 78,
  fiberG: 26, fiberTargetG: 32, sugarG: 72, sugarCapG: 55,
  waterMl: 1710, waterTargetMl: 3000, intakeLow: 2505, intakeHigh: 3061,
  bmr: 1788, tdeeLow: 2494, tdeeHigh: 3048,
};

describe('detail conformance — shown, never computed', () => {
  it('simple ⊆ standard ⊆ full, every shared value equal', () => {
    const simple = todayNumbersFor('simple', SEED);
    const standard = todayNumbersFor('standard', SEED);
    const full = todayNumbersFor('full', SEED);
    for (const [k, v] of simple) {
      expect(standard.has(k), `standard missing ${k}`).toBe(true);
      expect(standard.get(k), k).toBe(v);
    }
    for (const [k, v] of standard) {
      expect(full.has(k), `full missing ${k}`).toBe(true);
      expect(full.get(k), k).toBe(v);
    }
    expect(simple.size).toBeLessThan(standard.size);
    expect(standard.size).toBeLessThan(full.size);
  });

  it('simple rounds the hero to the nearest 10 — same number, rounder', () => {
    expect(heroDisplay(283, 'simple')).toBe(280);
    expect(heroDisplay(283, 'standard')).toBe(283);
    expect(heroDisplay(283, 'full')).toBe(283);
  });

  it('the one-line macro summary states over-caps in words, never scolds', () => {
    expect(simpleMacroLine({ carbsOverG: 91, fatOverG: 24, proteinShortG: 68 })).toBe('fat 24 g over · carbs 91 g over');
    expect(simpleMacroLine({ carbsOverG: 0, fatOverG: 0, proteinShortG: 0 })).toBe('carbs and fat on track');
  });

  it('readiness words map the bands; the number stays a tap away by design', () => {
    expect(readinessWord(80)).toBe('Rested');
    expect(readinessWord(60)).toBe('OK');
    expect(readinessWord(40)).toBe('Tired');
  });

  it('the onboarding copy is verbatim', () => {
    expect(DETAIL_OPTIONS.map((o) => o.quote)).toEqual([
      '“Just tell me what to do.”', '“Show me the numbers.”', '“Show me the maths.”',
    ]);
    expect(atLeast('full', 'simple')).toBe(true);
    expect(atLeast('simple', 'standard')).toBe(false);
  });
});

describe('detail lint — nothing inside <Detail> computes', () => {
  it('no engine call appears inside a <Detail> block', () => {
    const ROOT = resolve(__dirname, '..');
    const ENGINE_CALLS = /(computePlan|computeTargets|intakeRange\(|generateProgramme|weeklyCheckin|fullWeeklyCheckin|derivedActivityFactor|suggestNext)\s*\(/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'node_modules' || name.startsWith('.')) continue;
          walk(p);
        } else if (/\.tsx$/.test(name)) {
          const src = readFileSync(p, 'utf8');
          for (const m of src.matchAll(/<Detail\b[\s\S]*?<\/Detail>/g)) {
            if (ENGINE_CALLS.test(m[0])) offenders.push(`${p}: ${m[0].slice(0, 60)}`);
          }
        }
      }
    };
    walk(ROOT);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
