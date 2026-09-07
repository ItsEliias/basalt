import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The Extras lint rule, as a test: feature code for Extras lives in
// packages/extras/* and may only be imported by the registry or inside an
// ExtraSlot gate (the components that render under one). Anything else
// importing it would let an Extra leak into the core app — exactly what
// the all-off rule forbids.

const ROOT = resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['app/src', 'app/App.tsx', 'packages'];
const ALLOWED = [
  'app/src/components/ExtrasProvider.tsx',
  'packages/core-data/src/extras/registry.ts',
];

function* walk(p: string): Generator<string> {
  const full = join(ROOT, p);
  const st = statSync(full, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isFile()) { yield p; return; }
  for (const entry of readdirSync(full)) {
    if (entry === 'node_modules' || entry === 'build' || entry.startsWith('.')) continue;
    yield* walk(join(p, entry));
  }
}

describe('extras lint — packages/extras is only reachable through the gate', () => {
  it('no import of @basalt/extras or packages/extras outside the allowlist', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const f of walk(dir)) {
        if (!/\.(ts|tsx)$/.test(f) || f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
        if (f.startsWith('packages/extras/')) continue; // the package itself
        const src = readFileSync(join(ROOT, f), 'utf8');
        if (/from ['"](@basalt\/extras|.*packages\/extras)/.test(src) && !ALLOWED.includes(f)) {
          offenders.push(f);
        }
      }
    }
    expect(offenders, `extras imports outside the gate: ${offenders.join(', ')}`).toEqual([]);
  });
});
