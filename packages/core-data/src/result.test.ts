import { describe, it, expect } from 'vitest';
import { ok, err, type Result } from './result';

describe('ok', () => {
  it('wraps data in an Ok result', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
  });

  it('preserves object identity of the wrapped data', () => {
    const data = { id: 'abc' };
    expect(ok(data).data).toBe(data);
  });
});

describe('err', () => {
  it('wraps a message in an Err result', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });
});

describe('Result<T> discriminant', () => {
  it('narrows to Ok when ok is true', () => {
    const r: Result<number> = ok(7);
    if (r.ok) {
      expect(r.data).toBe(7);
    } else {
      throw new Error('expected ok result');
    }
  });

  it('narrows to Err when ok is false', () => {
    const r: Result<number> = err('nope');
    if (!r.ok) {
      expect(r.error).toBe('nope');
    } else {
      throw new Error('expected err result');
    }
  });
});
