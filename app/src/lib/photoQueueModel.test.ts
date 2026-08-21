import { describe, it, expect } from 'vitest';
import { queueAdd, queueList, queueRemove, queuedLabel } from './photoQueueModel';

describe('photo queue (pure core)', () => {
  it('round-trips through JSON', () => {
    const q = queueAdd([], { id: 'a', uri: 'file:///x/a.jpg', takenAt: '2026-08-21T07:00:00Z' });
    expect(queueList(JSON.stringify(q))).toEqual(q);
  });

  it('a corrupted store yields an empty queue, never a crash', () => {
    expect(queueList('not json')).toEqual([]);
    expect(queueList('{"nope":1}')).toEqual([]);
    expect(queueList('[{"id":1}]')).toEqual([]); // wrong types filtered
  });

  it('add is idempotent per id; remove removes exactly one', () => {
    const a = { id: 'a', uri: 'u', takenAt: 't' };
    const b = { id: 'b', uri: 'u', takenAt: 't' };
    const q = queueAdd(queueAdd(queueAdd([], a), b), a);
    expect(q).toHaveLength(2);
    expect(queueRemove(q, 'a').map((x) => x.id)).toEqual(['b']);
  });

  it('labels are relative and honest', () => {
    const now = new Date(2026, 7, 21, 12, 0);
    expect(queuedLabel('2026-08-21T07:05:00', now)).toBe('Today 07:05');
    expect(queuedLabel('2026-08-20T19:42:00', now)).toBe('Yesterday 19:42');
    expect(queuedLabel('2026-08-18T08:00:00', now)).toContain('Tue');
  });
});
