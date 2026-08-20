import type { SetEntry } from '@basalt/training';

// Train view-model — pure helpers behind the session screen.

/**
 * Map the onboarding equipment inventory onto free-exercise-db equipment
 * tokens for the "My equipment" library filter. Bodyweight movements are
 * always available, so 'body only' is always included.
 */
export function equipmentTokens(profileEquipment: string[]): string[] {
  const tokens = new Set<string>(['body only']);
  for (const item of profileEquipment) {
    const k = item.toLowerCase();
    if (k.includes('dumbbell')) tokens.add('dumbbell');
    if (k.includes('barbell') || k.includes('squat rack')) { tokens.add('barbell'); tokens.add('e-z curl bar'); }
    if (k.includes('bands')) tokens.add('bands');
    if (k.includes('kettlebell')) tokens.add('kettlebells');
    if (k.includes('cable')) { tokens.add('cable'); tokens.add('machine'); }
    if (k.includes('exercise bike') || k.includes('treadmill') || k.includes('rower')) tokens.add('machine');
    if (k.includes('medicine ball')) tokens.add('medicine ball');
  }
  return Array.from(tokens).sort();
}

/** Prev-column cell for a row: "72.5×8", "50 s", or "—" with no history. */
export function prevCellText(prevSets: SetEntry[], rowIndex: number): string {
  const s = prevSets[rowIndex];
  if (!s) return '—';
  if (s.durationS != null && s.reps == null) return `${s.durationS} s`;
  const w = s.weightKg != null ? String(s.weightKg) : 'bw';
  return `${w}×${s.reps ?? 0}`;
}

/** Parse a numeric field; empty/garbage → null (never NaN, never 0-guess). */
export function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = parseFloat(t);
  return isFinite(n) && n >= 0 ? n : null;
}

/** "MUSCLE · EQUIPMENT" meta line for an exercise header. */
export function exerciseMetaText(primaryMuscles: string[], equipment: string | null): string {
  const parts: string[] = [];
  if (equipment) parts.push(equipment);
  if (primaryMuscles.length > 0) parts.push(primaryMuscles[0]!);
  return parts.join(' · ');
}

/** Default row count for a fresh exercise: match the previous session, else 3. */
export function defaultRowCount(prevSets: SetEntry[]): number {
  const working = prevSets.filter((s) => s.setType !== 'warmup');
  return working.length > 0 ? working.length : 3;
}

/** Session elapsed as "22:14" from an ISO start. */
export function elapsedText(startedAtIso: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - Date.parse(startedAtIso)) / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
