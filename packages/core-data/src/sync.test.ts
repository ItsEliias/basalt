import { describe, expect, it } from 'vitest';

import { ok, err, type Result } from './result';
import {
  syncOnce,
  emptyPullBatch,
  type ChangeApplier,
  type OutboxEntry,
  type OutboxStore,
  type PullBatch,
  type RemoteChange,
  type RemoteSync,
  type SyncCursor,
} from './sync';

const entry = (id: string): OutboxEntry => ({
  id,
  entity: 'set_entry',
  op: 'insert',
  payload: { id },
  createdAt: '2026-08-14T00:00:00.000Z',
  attempts: 0,
});

function makeOutbox(entries: OutboxEntry[]) {
  const acked: string[] = [];
  const failed: string[] = [];
  const store: OutboxStore = {
    peek: async (limit) => ok(entries.slice(0, limit)),
    enqueue: async () => ok(undefined),
    ack: async (ids) => {
      acked.push(...ids);
      return ok(undefined);
    },
    fail: async (ids) => {
      failed.push(...ids);
      return ok(undefined);
    },
  };
  return { store, acked, failed };
}

function makeRemote(
  pushResult: Result<{ acked: string[]; rejected: { id: string; reason: string }[] }>,
  pullResult: Result<PullBatch>,
) {
  const pushedBatches: OutboxEntry[][] = [];
  const remote: RemoteSync = {
    push: async (batch) => {
      pushedBatches.push(batch);
      return pushResult;
    },
    pull: async () => pullResult,
  };
  return { remote, pushedBatches };
}

function makeApplier(result: Result<void> = ok(undefined)) {
  const applied: RemoteChange[][] = [];
  const applier: ChangeApplier = {
    apply: async (changes) => {
      applied.push(changes);
      return result;
    },
  };
  return { applier, applied };
}

const CURSORS: SyncCursor[] = [{ entity: 'set_entry', serverVersion: null }];

describe('syncOnce', () => {
  it('pushes a batch, acks accepted ids, and pulls afterwards', async () => {
    const { store, acked, failed } = makeOutbox([entry('a'), entry('b')]);
    const advanced: SyncCursor[] = [{ entity: 'set_entry', serverVersion: 'v2' }];
    const change: RemoteChange = {
      entity: 'set_entry',
      op: 'update',
      payload: {},
      serverVersion: 'v2',
    };
    const { remote } = makeRemote(
      ok({ acked: ['a', 'b'], rejected: [] }),
      ok({ changes: [change], cursors: advanced }),
    );
    const { applier, applied } = makeApplier();

    const result = await syncOnce(store, remote, applier, CURSORS);

    expect(result).toEqual(
      ok({ pushed: 2, rejected: 0, pulled: 1, cursors: advanced }),
    );
    expect(acked).toEqual(['a', 'b']);
    expect(failed).toEqual([]);
    expect(applied).toEqual([[change]]);
  });

  it('routes rejected entries to fail() without treating the pass as an error', async () => {
    const { store, acked, failed } = makeOutbox([entry('a'), entry('b')]);
    const { remote } = makeRemote(
      ok({ acked: ['a'], rejected: [{ id: 'b', reason: 'conflict' }] }),
      ok(emptyPullBatch(CURSORS)),
    );
    const { applier, applied } = makeApplier();

    const result = await syncOnce(store, remote, applier, CURSORS);

    expect(result).toEqual(
      ok({ pushed: 1, rejected: 1, pulled: 0, cursors: CURSORS }),
    );
    expect(acked).toEqual(['a']);
    expect(failed).toEqual(['b']);
    expect(applied).toEqual([]);
  });

  it('skips push entirely on an empty outbox but still pulls', async () => {
    const { store } = makeOutbox([]);
    const { remote, pushedBatches } = makeRemote(
      ok({ acked: [], rejected: [] }),
      ok(emptyPullBatch(CURSORS)),
    );
    const { applier } = makeApplier();

    const result = await syncOnce(store, remote, applier, CURSORS);

    expect(result).toEqual(
      ok({ pushed: 0, rejected: 0, pulled: 0, cursors: CURSORS }),
    );
    expect(pushedBatches).toEqual([]);
  });

  it('short-circuits with the push error and never pulls', async () => {
    const { store, acked } = makeOutbox([entry('a')]);
    let pullCalls = 0;
    const remote: RemoteSync = {
      push: async () => err('network down'),
      pull: async () => {
        pullCalls += 1;
        return ok(emptyPullBatch(CURSORS));
      },
    };
    const { applier } = makeApplier();

    const result = await syncOnce(store, remote, applier, CURSORS);

    expect(result).toEqual(err('network down'));
    expect(acked).toEqual([]);
    expect(pullCalls).toBe(0);
  });

  it('short-circuits when applying pulled changes fails', async () => {
    const { store } = makeOutbox([]);
    const change: RemoteChange = {
      entity: 'set_entry',
      op: 'delete',
      payload: {},
      serverVersion: 'v9',
    };
    const { remote } = makeRemote(
      ok({ acked: [], rejected: [] }),
      ok({ changes: [change], cursors: CURSORS }),
    );
    const { applier } = makeApplier(err('constraint violation'));

    const result = await syncOnce(store, remote, applier, CURSORS);

    expect(result).toEqual(err('constraint violation'));
  });

  it('respects the batchSize option when draining the outbox', async () => {
    const entries = [entry('a'), entry('b'), entry('c')];
    const { store } = makeOutbox(entries);
    const { remote, pushedBatches } = makeRemote(
      ok({ acked: ['a', 'b'], rejected: [] }),
      ok(emptyPullBatch(CURSORS)),
    );
    const { applier } = makeApplier();

    const result = await syncOnce(store, remote, applier, CURSORS, { batchSize: 2 });

    expect(result.ok).toBe(true);
    expect(pushedBatches).toEqual([[entries[0], entries[1]]]);
  });
});
