import { describe, it, expect } from 'vitest';
import {
  EXTRAS, EXTRA_IDS, EXTRA_GROUP_TITLES, defaultExtras, parseExtras,
  extraOn, setExtra, dependentsOf, onboardingExtraScreens, extraDef,
} from './registry';

describe('registry shape — every entry carries the full contract', () => {
  it('ids are unique and every field is present', () => {
    expect(new Set(EXTRA_IDS).size).toBe(EXTRAS.length);
    for (const e of EXTRAS) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.oneLiner.length).toBeGreaterThan(0);
      expect(EXTRA_GROUP_TITLES[e.group]).toBeDefined();
      expect(typeof e.default).toBe('boolean');
      if (e.onboarding) {
        expect(e.onboarding.question.length).toBeGreaterThan(0);
        expect(e.onboarding.yesLabel.length).toBeGreaterThan(0);
        expect(e.onboarding.noLabel.length).toBeGreaterThan(0);
        expect(e.onboarding.preview.length).toBeGreaterThan(0);
      }
      for (const dep of e.requires ?? []) expect(EXTRA_IDS).toContain(dep);
    }
  });

  it('off by default is the rule; every exception is a capture input method', () => {
    for (const e of EXTRAS.filter((x) => x.default)) {
      expect(['capture', 'glanceability', 'basalt'], `${e.id} defaults on outside the sanctioned groups`).toContain(e.group);
    }
    expect(extraDef('pebble').default).toBe(false);
  });

  it('requires chains are acyclic', () => {
    for (const id of EXTRA_IDS) {
      const seen = new Set<string>();
      const walk = (x: string) => {
        expect(seen.has(x), `cycle through ${x}`).toBe(false);
        seen.add(x);
        for (const dep of extraDef(x as never).requires ?? []) walk(dep);
        seen.delete(x);
      };
      walk(id);
    }
  });
});

describe('state — defaults, parsing, the off-means-off gate', () => {
  it('defaults come from the registry; junk parses to defaults', () => {
    expect(parseExtras(null)).toEqual(defaultExtras());
    expect(parseExtras('not json')).toEqual(defaultExtras());
    expect(parseExtras('{"pebble":true}').pebble).toBe(true);
    expect(parseExtras('{"pebble":"yes"}').pebble).toBe(false);
  });

  it('extraOn is false when the flag is off, regardless of anything else', () => {
    const s = defaultExtras();
    for (const id of EXTRA_IDS.filter((i) => !defaultExtras()[i])) {
      expect(extraOn(s, id)).toBe(false);
    }
  });
});

describe('yes/no round-trips — what onboarding writes is what Settings reads', () => {
  it('every answer combination survives serialize → parse intact', () => {
    for (const id of EXTRA_IDS) {
      for (const answer of [true, false]) {
        const s = { ...defaultExtras(), [id]: answer };
        expect(parseExtras(JSON.stringify(s))).toEqual(s);
      }
    }
  });
});

describe('dependency enforcement', () => {
  it('turning off a parent turns off its dependents and reports them', () => {
    // Exercise generically: for every extra with dependents, flip all on
    // then turn the parent off.
    for (const parent of EXTRA_IDS.filter((i) => dependentsOf(i).length > 0)) {
      let s = defaultExtras();
      s = { ...s, [parent]: true };
      for (const child of dependentsOf(parent)) s = { ...s, [child]: true };
      const r = setExtra(s, parent, false);
      expect(r.refused).toBe(false);
      expect(r.turnedOffDependents).toEqual(expect.arrayContaining(dependentsOf(parent)));
      for (const child of dependentsOf(parent)) expect(r.state[child]).toBe(false);
    }
  });

  it('enabling a child with its requirement off is refused', () => {
    for (const e of EXTRAS.filter((x) => (x.requires ?? []).length > 0)) {
      const s = defaultExtras();
      for (const dep of e.requires!) s[dep] = false;
      const r = setExtra(s, e.id, true);
      expect(r.refused).toBe(true);
      expect(r.state[e.id]).toBe(defaultExtras()[e.id]);
    }
  });
});

describe('onboarding screens derive from the registry', () => {
  it('every onboarding-flagged extra appears on exactly one screen', () => {
    const screens = onboardingExtraScreens();
    const flat = screens.flatMap((s) => s.ids);
    const flagged = EXTRAS.filter((e) => e.onboarding).map((e) => e.id);
    expect(flat.sort()).toEqual([...flagged].sort());
    expect(new Set(flat).size).toBe(flat.length);
  });

  it('copy comes from the registry, never hand-written in a screen', () => {
    for (const s of onboardingExtraScreens()) {
      const first = extraDef(s.ids[0]!);
      expect(s.question).toBe(first.onboarding!.question);
    }
  });
});
