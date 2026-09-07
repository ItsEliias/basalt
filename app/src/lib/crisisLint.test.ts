import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkCrisis } from '@basalt/core-data';

// The crisis-path laws, as tests (V4 Phase 7):
// 1. The fixed phrases trigger — with every Extra on AND off, because the
//    detector is pure and reads no state (asserted structurally too).
// 2. Every self-expression text entry point calls checkCrisis before it
//    does anything else with the text.
// 3. The crisis screen is NEVER wrapped in an ExtraSlot, and no setting
//    can disable it.

const ROOT = resolve(__dirname, '..', '..');

// Keep in sync with packages/core-data/src/crisis.test.ts.
const CRISIS_TEST_PHRASES = [
  'i want to kill myself',
  'I have been thinking about suicide',
  'sometimes I just want to die',
  'planning to hurt myself tonight',
  "there's no point anymore",
  'so tired of being alive',
];

// Every file where a person writes free text ABOUT THEMSELVES. Add a
// surface with a self-expression TextInput → add it here, or this list's
// completeness scan below fails.
const TEXT_ENTRY_POINTS = [
  'src/components/CoachCard.tsx',
  'src/screens/recover/MindCard.tsx',
  'src/components/JournalCard.tsx',
];

describe('crisis path — always on, no setting disables it', () => {
  it('the fixed phrases trigger regardless of any extras state (the detector is pure)', () => {
    for (const p of CRISIS_TEST_PHRASES) expect(checkCrisis(p), p).toBe(true);
    // Structural half: the module has no imports at all, so no state,
    // no storage, and no Extra can reach it.
    const src = readFileSync(join(ROOT, '..', 'packages', 'core-data', 'src', 'crisis.ts'), 'utf8');
    expect(src).not.toMatch(/^import /m);
  });

  it('every text entry point runs checkCrisis', () => {
    for (const f of TEXT_ENTRY_POINTS) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      expect(src.includes('checkCrisis'), `${f} must run the crisis detector`).toBe(true);
      expect(src.includes('CrisisSheet'), `${f} must show the crisis screen`).toBe(true);
    }
  });

  it('the crisis screen is never wrapped in an ExtraSlot', () => {
    // CrisisSheet itself must not import the gate…
    const sheet = readFileSync(join(ROOT, 'src', 'components', 'CrisisSheet.tsx'), 'utf8');
    expect(sheet).not.toContain('ExtraSlot');
    // …and no usage site may nest <CrisisSheet inside <ExtraSlot …>…</ExtraSlot>
    // in a way that gates it: statically, we forbid CrisisSheet appearing
    // between an ExtraSlot open and its close in the same JSX return.
    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'node_modules' || name.startsWith('.')) continue;
          walk(p, acc);
        } else if (/\.tsx$/.test(name)) acc.push(p);
      }
      return acc;
    };
    for (const f of walk(join(ROOT, 'src'))) {
      const src = readFileSync(f, 'utf8');
      if (!src.includes('<CrisisSheet')) continue;
      for (const m of src.matchAll(/<ExtraSlot[\s\S]*?<\/ExtraSlot>/g)) {
        expect(m[0].includes('<CrisisSheet'), `${f}: CrisisSheet gated by ExtraSlot`).toBe(false);
      }
    }
  });

  it('no self-expression TextInput exists outside the audited entry points', () => {
    // Completeness scan: any component file with BOTH a TextInput and a
    // self-writing placeholder (about today/yourself/journal/ask) must be
    // in TEXT_ENTRY_POINTS. Object-name fields (food search, supplement
    // names) are out of scope by design — see V4-REPORT Phase 7.
    const suspects: string[] = [];
    const scan = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'node_modules' || name.startsWith('.')) continue;
          scan(p);
        } else if (/\.tsx$/.test(name)) {
          const src = readFileSync(p, 'utf8');
          if (src.includes('TextInput') && /about today|about yourself|journal|Ask about your/i.test(src)) {
            suspects.push(p.slice(ROOT.length + 1));
          }
        }
      }
    };
    scan(join(ROOT, 'src'));
    for (const s of suspects) {
      expect(TEXT_ENTRY_POINTS, `${s} looks like self-expression input — audit it for the crisis gate`).toContain(s);
    }
  });
});
