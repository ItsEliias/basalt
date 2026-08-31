import { describe, it, expect } from 'vitest';
import {
  parseOutbox, serializeOutbox, enqueue, ack, markFailed, drainable,
  isNetworkError, pendingLine, outboxId, MAX_ATTEMPTS, type PendingWrite,
} from './outboxModel';

const intent = { kind: 'water', ml: 250, date: '2026-08-31', ts: '2026-08-31T10:00:00Z' } as const;

describe('outbox model — durable, corrupt-safe, honest', () => {
  it('round-trips through serialization', () => {
    const q = enqueue([], intent, '2026-08-31T10:00:01Z', 'ob-1');
    const back = parseOutbox(serializeOutbox(q));
    expect(back).toEqual(q);
  });

  it('a corrupt store yields an empty queue, never a crash', () => {
    expect(parseOutbox('{{{ not json')).toEqual([]);
    expect(parseOutbox('42')).toEqual([]);
    expect(parseOutbox(JSON.stringify([{ nope: true }]))).toEqual([]);
    expect(parseOutbox(null)).toEqual([]);
  });

  it('ack removes exactly the acked entry; failure counts attempts', () => {
    let q = enqueue([], intent, 't', 'a');
    q = enqueue(q, intent, 't', 'b');
    q = markFailed(q, 'a');
    expect(q.find((e) => e.id === 'a')!.attempts).toBe(1);
    expect(q.find((e) => e.id === 'b')!.attempts).toBe(0);
    q = ack(q, 'a');
    expect(q.map((e) => e.id)).toEqual(['b']);
  });

  it('entries past the retry budget stop draining but are never dropped', () => {
    const spent: PendingWrite = { id: 'x', intent, createdAt: 't', attempts: MAX_ATTEMPTS };
    const fresh: PendingWrite = { id: 'y', intent, createdAt: 't', attempts: 0 };
    expect(drainable([spent, fresh]).map((e) => e.id)).toEqual(['y']);
  });

  it('classifies network-shaped failures only — real errors must surface', () => {
    expect(isNetworkError('TypeError: Network request failed')).toBe(true);
    expect(isNetworkError('fetch failed')).toBe(true);
    expect(isNetworkError('timeout of 10000ms exceeded')).toBe(true);
    expect(isNetworkError('new row violates row-level security policy')).toBe(false);
    expect(isNetworkError('Invalid amount.')).toBe(false);
  });

  it('the Settings line is quiet: null when nothing waits', () => {
    expect(pendingLine(0)).toBeNull();
    expect(pendingLine(1)).toBe('1 change waiting to sync');
    expect(pendingLine(3)).toBe('3 changes waiting to sync');
  });

  it('ids are unique across rapid generation', () => {
    const ids = new Set(Array.from({ length: 500 }, () => outboxId(1700000000000)));
    expect(ids.size).toBe(500);
  });
});
