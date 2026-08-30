import { describe, it, expect } from 'vitest';
import { recipePhotoPath } from './recipe-photos';

describe('recipePhotoPath', () => {
  it('is folder-first with the user id so storage RLS can scope on it', () => {
    expect(recipePhotoPath('user-1', 1700000000000, 'ab12', 'jpg')).toBe('user-1/1700000000000-ab12.jpg');
  });

  it('respects the given extension', () => {
    expect(recipePhotoPath('user-1', 1700000000000, 'ab12', 'webp')).toBe('user-1/1700000000000-ab12.webp');
  });
});
