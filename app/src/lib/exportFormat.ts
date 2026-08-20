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
