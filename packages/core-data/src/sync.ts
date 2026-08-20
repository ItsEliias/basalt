// Local-first ↔ remote sync skeleton (roadmap §6). Contracts only: the app
// implements OutboxStore over its local db (expo-sqlite/Drizzle) and
// RemoteSync over Supabase; syncOnce() is pure orchestration. No storage,
// no network, and no feature logic live in this module.
import { type Result, ok } from './result';

export type SyncOp = 'insert' | 'update' | 'delete';

/** A locally-committed mutation awaiting push. `id` is client-generated
 *  (uuid/ulid) and is the idempotency key on the remote side. */
export interface OutboxEntry {
  id: string;
  entity: string;
  op: SyncOp;
  payload: unknown;
  createdAt: string;
  attempts: number;
}

/** Per-entity high-water mark for incremental pulls. `serverVersion` is
 *  opaque to the client (Supabase decides: sequence, timestamp, …). */
export interface SyncCursor {
  entity: string;
  serverVersion: string | null;
}

export interface RemoteChange {
  entity: string;
  op: SyncOp;
  payload: unknown;
  serverVersion: string;
}

export interface PushOutcome {
  acked: string[];
  rejected: { id: string; reason: string }[];
}

export interface PullBatch {
  changes: RemoteChange[];
  cursors: SyncCursor[];
}

/** App-side, over the local db. Implementations must be durable across
 *  restarts — the outbox IS the offline guarantee. */
export interface OutboxStore {
  enqueue(entry: Omit<OutboxEntry, 'attempts'>): Promise<Result<void>>;
  peek(limit: number): Promise<Result<OutboxEntry[]>>;
  ack(ids: string[]): Promise<Result<void>>;
  /** Marks a failed push attempt; implementations increment `attempts`
   *  so callers can implement retry budgets / dead-lettering. */
  fail(ids: string[]): Promise<Result<void>>;
}

/** Remote side, over Supabase. push() must be idempotent on entry id. */
export interface RemoteSync {
  push(entries: OutboxEntry[]): Promise<Result<PushOutcome>>;
  pull(cursors: SyncCursor[]): Promise<Result<PullBatch>>;
}

/** App-side: applies pulled remote changes to the local db. Must be
 *  last-write-wins-safe against rows the outbox still holds. */
export interface ChangeApplier {
  apply(changes: RemoteChange[]): Promise<Result<void>>;
}

export interface SyncOnceReport {
  pushed: number;
  rejected: number;
  pulled: number;
  cursors: SyncCursor[];
}

/**
 * One full sync pass: drain one outbox batch (push → ack/fail), then pull
 * incremental changes and apply them. Any failing stage short-circuits with
 * its error; a partially-rejected push is NOT an error (rejects are reported
 * and left failed for retry policy to handle).
 */
export async function syncOnce(
  outbox: OutboxStore,
  remote: RemoteSync,
  applier: ChangeApplier,
  cursors: SyncCursor[],
  options: { batchSize?: number } = {},
): Promise<Result<SyncOnceReport>> {
  const batchSize = options.batchSize ?? 50;

  const batch = await outbox.peek(batchSize);
  if (!batch.ok) return batch;

  let pushed = 0;
  let rejected = 0;
  if (batch.data.length > 0) {
    const outcome = await remote.push(batch.data);
    if (!outcome.ok) return outcome;
    if (outcome.data.acked.length > 0) {
      const acked = await outbox.ack(outcome.data.acked);
      if (!acked.ok) return acked;
    }
    if (outcome.data.rejected.length > 0) {
      const failed = await outbox.fail(outcome.data.rejected.map((r) => r.id));
      if (!failed.ok) return failed;
    }
    pushed = outcome.data.acked.length;
    rejected = outcome.data.rejected.length;
  }

  const pulled = await remote.pull(cursors);
  if (!pulled.ok) return pulled;
  if (pulled.data.changes.length > 0) {
    const applied = await applier.apply(pulled.data.changes);
    if (!applied.ok) return applied;
  }

  return ok({
    pushed,
    rejected,
    pulled: pulled.data.changes.length,
    cursors: pulled.data.cursors,
  });
}

/** Convenience for implementations that need a typed empty outcome. */
export function emptyPullBatch(cursors: SyncCursor[]): PullBatch {
  return { changes: [], cursors };
}
