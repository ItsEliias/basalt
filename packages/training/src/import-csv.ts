// Competitor CSV import — pure parsing + matching; no client, no network.
// Strong and Hevy exports, a generic column-mapped CSV, and Basalt's own
// sectioned export (the round-trip guarantee: what we export, we re-import
// losslessly). Every parsed session flows through the same service layer
// as a live session; nothing writes here.

export type ImportedSet = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  rpe: number | null;
};

export type ImportedExercise = {
  name: string;
  sets: ImportedSet[];
};

export type ImportedSession = {
  startedAt: string; // ISO
  endedAt: string | null;
  name: string | null;
  exercises: ImportedExercise[];
};

export type ImportPreview = {
  sessionCount: number;
  setCount: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Distinct source exercise names with no confident catalog match. */
  unmatched: string[];
  /** name → matched catalog name, for the confident ones. */
  matched: Record<string, string>;
};

// ─── RFC-4180-ish CSV ────────────────────────────────────────────────────────

/** Parse CSV text into rows of cells. Handles quoted cells, embedded
 *  delimiters/newlines, and doubled quotes. Delimiter sniffed from the
 *  header line (comma vs semicolon — Strong has shipped both). */
export function parseCsv(text: string, delimiter?: ',' | ';'): string[][] {
  const src = text.replace(/^﻿/, '');
  const headerLine = src.slice(0, src.indexOf('\n') === -1 ? src.length : src.indexOf('\n'));
  const delim =
    delimiter ??
    ((headerLine.split(';').length > headerLine.split(',').length ? ';' : ',') as ',' | ';');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const n = parseFloat(String(s).replace(',', '.'));
  return isFinite(n) ? n : null;
};

const LB_TO_KG = 0.45359237;

// ─── Strong ─────────────────────────────────────────────────────────────────
//
// Header (unit variants): Date, Workout Name, Duration, Exercise Name,
// Set Order, Weight | Weight (kg) | Weight (lbs), Reps, Distance, Seconds,
// Notes, Workout Notes, RPE. Sessions group by (Date, Workout Name).

export function parseStrongCsv(text: string): ImportedSession[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h === name || h.startsWith(name));
  const iDate = col('date');
  const iName = col('workout name');
  const iEx = col('exercise name');
  const iSet = col('set order');
  const iWeight = header.findIndex((h) => h.startsWith('weight'));
  const iReps = col('reps');
  const iSeconds = col('seconds');
  const iRpe = col('rpe');
  if (iDate === -1 || iEx === -1) return [];
  const lbs = iWeight !== -1 && header[iWeight]!.includes('lb');

  const byKey = new Map<string, ImportedSession>();
  for (const r of rows.slice(1)) {
    const dateRaw = r[iDate]?.trim();
    if (!dateRaw) continue;
    const startedAt = new Date(dateRaw.replace(' ', 'T')).toISOString();
    const name = iName !== -1 ? r[iName]?.trim() || null : null;
    const key = `${startedAt}|${name ?? ''}`;
    if (!byKey.has(key)) byKey.set(key, { startedAt, endedAt: null, name, exercises: [] });
    const session = byKey.get(key)!;

    const exName = r[iEx]?.trim();
    if (!exName) continue;
    let ex = session.exercises.find((e) => e.name === exName);
    if (!ex) { ex = { name: exName, sets: [] }; session.exercises.push(ex); }
    const rawW = iWeight === -1 ? null : num(r[iWeight]);
    ex.sets.push({
      setNumber: num(r[iSet] ?? '') ?? ex.sets.length + 1,
      weightKg: rawW === null ? null : Math.round((lbs ? rawW * LB_TO_KG : rawW) * 100) / 100,
      reps: iReps === -1 ? null : num(r[iReps]),
      durationS: iSeconds === -1 ? null : num(r[iSeconds]) || null,
      rpe: iRpe === -1 ? null : num(r[iRpe]),
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ─── Hevy ───────────────────────────────────────────────────────────────────
//
// Header: title, start_time, end_time, description, exercise_title,
// superset_id, exercise_notes, set_index, set_type, weight_kg, reps,
// distance_km, duration_seconds, rpe. Sessions group by (title, start_time).

export function parseHevyCsv(text: string): ImportedSession[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iTitle = col('title');
  const iStart = col('start_time');
  const iEnd = col('end_time');
  const iEx = col('exercise_title');
  const iSet = col('set_index');
  const iWeight = col('weight_kg');
  const iReps = col('reps');
  const iDur = col('duration_seconds');
  const iRpe = col('rpe');
  if (iStart === -1 || iEx === -1) return [];

  const byKey = new Map<string, ImportedSession>();
  for (const r of rows.slice(1)) {
    const startRaw = r[iStart]?.trim();
    if (!startRaw) continue;
    const startedAt = new Date(startRaw).toISOString();
    const name = iTitle !== -1 ? r[iTitle]?.trim() || null : null;
    const endRaw = iEnd !== -1 ? r[iEnd]?.trim() : undefined;
    const key = `${startedAt}|${name ?? ''}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        startedAt,
        endedAt: endRaw ? new Date(endRaw).toISOString() : null,
        name,
        exercises: [],
      });
    }
    const session = byKey.get(key)!;
    const exName = r[iEx]?.trim();
    if (!exName) continue;
    let ex = session.exercises.find((e) => e.name === exName);
    if (!ex) { ex = { name: exName, sets: [] }; session.exercises.push(ex); }
    ex.sets.push({
      setNumber: (num(r[iSet] ?? '') ?? ex.sets.length) + 1, // Hevy is 0-based
      weightKg: iWeight === -1 ? null : num(r[iWeight]),
      reps: iReps === -1 ? null : num(r[iReps]),
      durationS: iDur === -1 ? null : num(r[iDur]) || null,
      rpe: iRpe === -1 ? null : num(r[iRpe]),
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ─── Generic (column-mapped) ────────────────────────────────────────────────

export type GenericMapping = {
  date: number;
  exercise: number;
  weight?: number;
  reps?: number;
  durationS?: number;
  /** Multiply weights by this to reach kg (1 for kg, 0.45359237 for lb). */
  weightFactor?: number;
};

export function parseGenericCsv(text: string, map: GenericMapping): ImportedSession[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const factor = map.weightFactor ?? 1;
  const byDay = new Map<string, ImportedSession>();
  for (const r of rows.slice(1)) {
    const dateRaw = r[map.date]?.trim();
    const exName = r[map.exercise]?.trim();
    if (!dateRaw || !exName) continue;
    const d = new Date(dateRaw.replace(' ', 'T'));
    if (isNaN(d.getTime())) continue;
    const startedAt = d.toISOString();
    const key = startedAt.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, { startedAt, endedAt: null, name: null, exercises: [] });
    const session = byDay.get(key)!;
    let ex = session.exercises.find((e) => e.name === exName);
    if (!ex) { ex = { name: exName, sets: [] }; session.exercises.push(ex); }
    const rawW = map.weight === undefined ? null : num(r[map.weight]);
    ex.sets.push({
      setNumber: ex.sets.length + 1,
      weightKg: rawW === null ? null : Math.round(rawW * factor * 100) / 100,
      reps: map.reps === undefined ? null : num(r[map.reps]),
      durationS: map.durationS === undefined ? null : num(r[map.durationS]) || null,
      rpe: null,
    });
  }
  return Array.from(byDay.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ─── Basalt's own sectioned export (round-trip) ─────────────────────────────
//
// buildSectionedCsv writes `== table ==` headers; the three training tables
// reconstruct sessions exactly. What Basalt exports, Basalt re-imports.

export function parseBasaltSectionedCsv(text: string): ImportedSession[] {
  const sections = new Map<string, string[][]>();
  let current: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (current && buffer.length > 0) sections.set(current, parseCsv(buffer.join('\n'), ','));
    buffer = [];
  };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^== (.+) ==$/);
    if (m) { flush(); current = m[1]!; continue; }
    if (line === '(no rows)') continue;
    if (current && line.trim() !== '') buffer.push(line);
  }
  flush();

  const sessions = sections.get('basalt_workout_sessions') ?? [];
  const exercises = sections.get('basalt_session_exercises') ?? [];
  const sets = sections.get('basalt_set_entries') ?? [];
  if (sessions.length < 2) return [];

  const idx = (rows: string[][], name: string) => rows[0]!.indexOf(name);
  const sId = idx(sessions, 'id'); const sStart = idx(sessions, 'started_at');
  const sEnd = idx(sessions, 'ended_at'); const sNotes = idx(sessions, 'notes');
  const eId = idx(exercises, 'id'); const eSession = idx(exercises, 'session_id');
  const eName = idx(exercises, 'exercise_name'); const eOrder = idx(exercises, 'order_index');
  const stEx = idx(sets, 'session_exercise_id'); const stNum = idx(sets, 'set_number');
  const stW = idx(sets, 'weight_kg'); const stReps = idx(sets, 'reps');
  const stDur = idx(sets, 'duration_s'); const stRpe = idx(sets, 'rpe');
  const stType = idx(sets, 'set_type');

  const out = new Map<string, ImportedSession>();
  const exToSession = new Map<string, { session: string; ex: ImportedExercise; order: number }>();
  for (const r of sessions.slice(1)) {
    out.set(r[sId]!, {
      startedAt: new Date(r[sStart]!).toISOString(),
      endedAt: r[sEnd] ? new Date(r[sEnd]!).toISOString() : null,
      name: sNotes !== -1 ? r[sNotes] || null : null,
      exercises: [],
    });
  }
  const ordered = exercises.slice(1).sort((a, b) => (num(a[eOrder]!) ?? 0) - (num(b[eOrder]!) ?? 0));
  for (const r of ordered) {
    const session = out.get(r[eSession]!);
    if (!session) continue;
    const ex: ImportedExercise = { name: r[eName]!, sets: [] };
    session.exercises.push(ex);
    exToSession.set(r[eId]!, { session: r[eSession]!, ex, order: num(r[eOrder]!) ?? 0 });
  }
  for (const r of sets.slice(1)) {
    if (stType !== -1 && r[stType] === 'warmup') {
      // Warmups round-trip too — they're rows like any other.
    }
    const target = exToSession.get(r[stEx]!);
    if (!target) continue;
    target.ex.sets.push({
      setNumber: num(r[stNum]!) ?? target.ex.sets.length + 1,
      weightKg: r[stW] ? num(r[stW]!) : null,
      reps: r[stReps] ? num(r[stReps]!) : null,
      durationS: r[stDur] ? num(r[stDur]!) : null,
      rpe: r[stRpe] ? num(r[stRpe]!) : null,
    });
  }
  for (const s of out.values()) {
    for (const ex of s.exercises) ex.sets.sort((a, b) => a.setNumber - b.setNumber);
  }
  return Array.from(out.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ─── Exercise-name matching — published rule ────────────────────────────────
//
// 1. normalize: lowercase, strip parenthesised qualifiers ("(Barbell)"),
//    strip punctuation, collapse spaces
// 2. exact normalized match
// 3. substring containment either way, min 4 chars
// Anything else is unmatched — shown in the preview for manual mapping,
// and importable as free text regardless (exercise_name is the record;
// exercise_id is a link, not a gate).

export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchExerciseName(source: string, catalog: string[]): string | null {
  const n = normalizeExerciseName(source);
  if (n.length === 0) return null;
  for (const c of catalog) if (normalizeExerciseName(c) === n) return c;
  if (n.length >= 4) {
    for (const c of catalog) {
      const cn = normalizeExerciseName(c);
      if (cn.length >= 4 && (cn.includes(n) || n.includes(cn))) return c;
    }
  }
  return null;
}

export function buildImportPreview(
  sessions: ImportedSession[],
  catalog: string[],
): ImportPreview {
  const names = new Set<string>();
  let setCount = 0;
  for (const s of sessions) {
    for (const ex of s.exercises) { names.add(ex.name); setCount += ex.sets.length; }
  }
  const matched: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const name of Array.from(names).sort()) {
    const m = matchExerciseName(name, catalog);
    if (m) matched[name] = m;
    else unmatched.push(name);
  }
  // Local calendar dates — exports carry wall-clock times with no zone, so
  // the ISO (UTC) slice can land a 6 a.m. session on the wrong day.
  const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dates = sessions.map((s) => localDay(s.startedAt)).sort();
  return {
    sessionCount: sessions.length,
    setCount,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    unmatched,
    matched,
  };
}

/** Stable dedupe key for idempotent re-imports (unique on user+ext_id). */
export function importExtId(source: string, session: ImportedSession): string {
  return `import:${source}:${session.startedAt}:${session.name ?? ''}`.slice(0, 200);
}
