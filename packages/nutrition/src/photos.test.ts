import { describe, it, expect } from 'vitest';
import { base64ToU8, foodPhotoPath } from './photos';

describe('base64ToU8', () => {
  it('inverts canonical encodings, padding included', () => {
    const cases: [string, number[]][] = [
      ['', []],
      ['TQ==', [77]],
      ['TWE=', [77, 97]],
      ['TWFu', [77, 97, 110]],
      ['AP8QIA==', [0, 255, 16, 32]],
    ];
    for (const [b64, bytes] of cases) {
      expect(Array.from(base64ToU8(b64))).toEqual(bytes);
    }
  });

  it('tolerates embedded newlines (RN base64 output wraps)', () => {
    expect(Array.from(base64ToU8('TW\nFu'))).toEqual([77, 97, 110]);
  });
});

describe('foodPhotoPath', () => {
  it('is folder-first with the user id so storage RLS can scope on it', () => {
    expect(foodPhotoPath('user-1', 1700000000000, 'ab12')).toBe('user-1/1700000000000-ab12.jpg');
  });
});
