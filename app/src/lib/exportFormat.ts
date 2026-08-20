// Pure export formatting — no client imports so tests stay node-clean.

export type ExportBundle = Record<string, Record<string, unknown>[]>;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Rows → RFC-4180-style CSV with a header from the union of keys. */
export function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [keys.join(',')];
  for (const row of rows) {
    lines.push(keys.map((k) => csvCell(row[k])).join(','));
  }
  return lines.join('\n');
}

/**
 * All tables as one sectioned CSV document — a `== table ==` line introduces
 * each table's own header + rows. Empty tables state that they are empty
 * rather than silently vanishing.
 */
export function buildSectionedCsv(bundle: ExportBundle): string {
  const parts: string[] = [];
  for (const [table, rows] of Object.entries(bundle)) {
    parts.push(`== ${table} ==`);
    parts.push(rows.length > 0 ? buildCsv(rows) : '(no rows)');
    parts.push('');
  }
  return parts.join('\n');
}

/**
 * One CSV file per table for the zip archive. Empty tables are not given
 * empty files — the README names every table with its row count instead,
 * so absence is stated, never silent.
 */
export function buildPerTableCsvs(bundle: ExportBundle): { name: string; csv: string }[] {
  return Object.entries(bundle)
    .filter(([, rows]) => rows.length > 0)
    .map(([table, rows]) => ({ name: `${table}.csv`, csv: buildCsv(rows) }));
}

export function buildExportReadme(bundle: ExportBundle, exportedAtIso: string): string {
  const lines = [
    'Basalt export — one CSV per table.',
    `Exported at ${exportedAtIso}.`,
    'Every row belongs to this account. Tables with no rows have no file; they are listed here so nothing vanishes silently.',
    '',
  ];
  for (const [table, rows] of Object.entries(bundle)) {
    lines.push(`${table}: ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}${rows.length === 0 ? ' (no file)' : ''}`);
  }
  return lines.join('\n');
}

/** Uint8Array → base64 without Buffer/btoa — RN's JS runtime has neither. */
export function u8ToBase64(bytes: Uint8Array): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += ALPHABET[a >> 2]! + ALPHABET[((a & 3) << 4) | (b >> 4)]!;
    out += i + 1 < bytes.length ? ALPHABET[((b & 15) << 2) | (c >> 6)]! : '=';
    out += i + 2 < bytes.length ? ALPHABET[c & 63]! : '=';
  }
  return out;
}

export function buildJson(bundle: ExportBundle): string {
  return JSON.stringify(
    {
      app: 'Basalt',
      exportedAt: new Date().toISOString(),
      note: 'Every table row belonging to this account. This file is the complete ledger.',
      tables: bundle,
    },
    null,
    2,
  );
}
