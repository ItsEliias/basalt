import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// The deletion guard (V3.1 item 1). The V3 batch found both account-
// deletion paths missing every table added since V1 — a compliance bug
// this test makes structurally unrepeatable: it enumerates every
// `create table … basalt_*` in the migrations directory and fails the
// suite if any of them is not wiped by BOTH paths (the delete-account
// Edge Function and the basalt_delete_my_data SQL function). Add a
// table without extending both wipe lists and CI goes red.

const ROOT = resolve(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const EDGE_FN = join(ROOT, 'supabase', 'functions', 'delete-account', 'index.ts');

// Tables that hold NO user rows — the shared exercise library seeded from
// free-exercise-db (no user_id column; verified in the unified schema).
// Anything added here needs the same justification in review.
const GLOBAL_TABLES = new Set(['basalt_exercises']);

function allBasaltTables(): string[] {
  const names = new Set<string>();
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(basalt_[a-z0-9_]+)/gi)) {
      names.add(m[1]!.toLowerCase());
    }
  }
  return [...names].sort();
}

/** The LATEST definition of basalt_delete_my_data wins (create or replace). */
function latestSqlWipeBody(): string {
  let body = '';
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const m = sql.match(/create or replace function public\.basalt_delete_my_data\(\)[\s\S]*?\$\$;/i);
    if (m) body = m[0];
  }
  return body;
}

function sqlPathCovers(body: string, table: string): boolean {
  return new RegExp(`delete from public\\.${table}\\b`, 'i').test(body);
}

function edgePathCovers(src: string, table: string): boolean {
  // Covered if named in BASALT_TABLES / TWO_SIDED, or wiped explicitly.
  return new RegExp(`['"]${table}['"]`).test(src);
}

describe('deletion guard — every basalt_ table is wiped by BOTH paths', () => {
  const tables = allBasaltTables().filter((t) => !GLOBAL_TABLES.has(t));
  const sqlBody = latestSqlWipeBody();
  const edgeSrc = readFileSync(EDGE_FN, 'utf8');

  it('found a plausible schema (sanity floor so a bad path never passes vacuously)', () => {
    expect(tables.length).toBeGreaterThan(25);
    expect(sqlBody).toContain('basalt_delete_my_data');
  });

  it('SQL path (basalt_delete_my_data) covers every user table', () => {
    const missing = tables.filter((t) => !sqlPathCovers(sqlBody, t));
    expect(missing, `extend the LATEST basalt_delete_my_data migration for: ${missing.join(', ')}`).toEqual([]);
  });

  it('Edge path (delete-account function) covers every user table', () => {
    const missing = tables.filter((t) => !edgePathCovers(edgeSrc, t));
    expect(missing, `extend delete-account's wipe lists for: ${missing.join(', ')}`).toEqual([]);
  });

  it('two-sided tables are wiped in both directions in both paths', () => {
    expect(sqlBody).toMatch(/basalt_share_grants where owner_id = uid or grantee_id = uid/);
    expect(sqlBody).toMatch(/basalt_pairs where a_id = uid or b_id = uid/);
    expect(edgeSrc).toMatch(/'owner_id', 'grantee_id'/);
    expect(edgeSrc).toMatch(/'a_id', 'b_id'/);
  });

  it('the global-table allowlist only ever shrinks by intent', () => {
    expect([...GLOBAL_TABLES]).toEqual(['basalt_exercises']);
  });
});
