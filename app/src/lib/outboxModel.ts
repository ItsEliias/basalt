// Offline outbox — pure model (storage and replay live in outbox.ts).
// Philosophy: a write the user committed must never be lost. When the
// network eats a service call, the INTENT (the service call's own input,
// not a raw row) is queued durably and replayed through the same service
// function later — so chains (daily-log get-or-create, favorites) replay
// exactly as a live call would.

export type OutboxIntent =
  | { kind: 'food_entry'; input: unknown; date?: string }
  | { kind: 'water'; ml: number; date: string; ts: string }
  | { kind: 'weight'; weightKg: number; measuredAt: string; source: string }
  | { kind: 'checkin'; checkin: unknown }
  | { kind: 'mindfulness'; row: unknown };

export type PendingWrite = {
  id: string;
  intent: OutboxIntent;
  createdAt: string;
  attempts: number;
};

/** Corrupt-safe parse — a broken store yields an empty queue, never a crash. */
export function parseOutbox(raw: string | null): PendingWrite[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is PendingWrite =>
        e && typeof e.id === 'string' && e.intent && typeof e.intent.kind === 'string',
    );
  } catch {
    return [];
  }
}

export function serializeOutbox(entries: PendingWrite[]): string {
  return JSON.stringify(entries);
}

let counter = 0;
/** Unique-enough id for queue entries (idempotency bookkeeping, not crypto). */
export function outboxId(now: number = Date.now()): string {
  counter = (counter + 1) % 10000;
  return `ob-${now.toString(36)}-${counter}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function enqueue(entries: PendingWrite[], intent: OutboxIntent, nowIso: string, id: string): PendingWrite[] {
  return [...entries, { id, intent, createdAt: nowIso, attempts: 0 }];
}

export function ack(entries: PendingWrite[], id: string): PendingWrite[] {
  return entries.filter((e) => e.id !== id);
}

export function markFailed(entries: PendingWrite[], id: string): PendingWrite[] {
  return entries.map((e) => (e.id === id ? { ...e, attempts: e.attempts + 1 } : e));
}

/** Retry budget: after this many failed replays an entry stops draining
 *  automatically (it stays visible in the pending count — never silently
 *  dropped; a future manual retry can still pick it up). */
export const MAX_ATTEMPTS = 25;

export function drainable(entries: PendingWrite[]): PendingWrite[] {
  return entries.filter((e) => e.attempts < MAX_ATTEMPTS);
}

/** Network-shaped failures queue; anything else (validation, auth, RLS)
 *  is a real error the caller must surface — queueing it would hide it. */
export function isNetworkError(message: string): boolean {
  return /network|fetch failed|failed to fetch|timeout|timed out|socket|ECONN|abort/i.test(message);
}

export function pendingLine(count: number): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? 'change' : 'changes'} waiting to sync`;
}
