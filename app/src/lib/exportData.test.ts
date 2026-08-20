import { describe, it, expect } from 'vitest';
import { buildCsv, buildSectionedCsv, buildJson } from './exportFormat';

describe('buildCsv', () => {
  it('emits a header from the union of keys and keeps row order', () => {
    const csv = buildCsv([
      { id: 1, name: 'Oats' },
      { id: 2, name: 'Yoghurt', brand: 'Vaalia' },
    ]);
    expect(csv.split('\n')).toEqual([
      'id,name,brand',
      '1,Oats,',
      '2,Yoghurt,Vaalia',
    ]);
  });

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csv = buildCsv([{ note: 'a,b', quote: 'say "hi"', multi: 'l1\nl2' }]);
    expect(csv.split('\n')[1]).toBe('"a,b","say ""hi""","l1');
  });

  it('serializes nested objects (jsonb columns) as JSON strings', () => {
    const csv = buildCsv([{ habits: { alcohol: 'social' } }]);
    expect(csv).toContain('"{""alcohol"":""social""}"');
  });

  it('empty input → empty string', () => {
    expect(buildCsv([])).toBe('');
  });
});

describe('buildSectionedCsv', () => {
  it('sections every table and admits emptiness plainly', () => {
    const out = buildSectionedCsv({
      basalt_food_entries: [{ id: 'x', calories: 300 }],
      basalt_walks: [],
    });
    expect(out).toContain('== basalt_food_entries ==');
    expect(out).toContain('id,calories');
    expect(out).toContain('== basalt_walks ==');
    expect(out).toContain('(no rows)');
  });
});

describe('buildJson', () => {
  it('wraps the bundle with provenance', () => {
    const parsed = JSON.parse(buildJson({ basalt_targets: [{ calories: 2340 }] }));
    expect(parsed.app).toBe('Basalt');
    expect(parsed.tables.basalt_targets[0].calories).toBe(2340);
    expect(typeof parsed.exportedAt).toBe('string');
  });
});
