import { describe, it, expect } from 'vitest';
import { buildCsv, buildSectionedCsv, buildJson, buildPerTableCsvs, buildExportReadme, u8ToBase64 } from './exportFormat';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

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

describe('per-table zip export builders', () => {
  const bundle = {
    basalt_food_entries: [{ id: '1', food_name: 'oats', calories: 380 }],
    basalt_walks: [],
    basalt_targets: [{ id: 't1', calories: 2340 }],
  };

  it('one CSV per non-empty table; empty tables get no file', () => {
    const files = buildPerTableCsvs(bundle);
    expect(files.map((f) => f.name)).toEqual(['basalt_food_entries.csv', 'basalt_targets.csv']);
    expect(files[0]!.csv).toContain('id,food_name,calories');
    expect(files[0]!.csv).toContain('1,oats,380');
  });

  it('the README states every table and row count — absence is named', () => {
    const readme = buildExportReadme(bundle, '2026-08-21T10:00:00Z');
    expect(readme).toContain('basalt_food_entries: 1 row');
    expect(readme).toContain('basalt_walks: 0 rows (no file)');
    expect(readme).toContain('basalt_targets: 1 row');
    expect(readme).toContain('2026-08-21T10:00:00Z');
  });

  it('u8ToBase64 matches the canonical encoding, padding included', () => {
    const cases: [number[], string][] = [
      [[], ''],
      [[77], 'TQ=='],
      [[77, 97], 'TWE='],
      [[77, 97, 110], 'TWFu'],
      [[0, 255, 16, 32], 'AP8QIA=='],
    ];
    for (const [bytes, expected] of cases) {
      expect(u8ToBase64(new Uint8Array(bytes))).toBe(expected);
    }
  });

  it('zip round-trip: files come back out byte-identical', () => {
    const files = buildPerTableCsvs(bundle);
    const zipped = zipSync(
      Object.fromEntries(files.map((f) => [f.name, strToU8(f.csv)])),
    );
    const unzipped = unzipSync(zipped);
    expect(Object.keys(unzipped).sort()).toEqual(['basalt_food_entries.csv', 'basalt_targets.csv']);
    expect(strFromU8(unzipped['basalt_food_entries.csv']!)).toBe(files[0]!.csv);
  });
});
