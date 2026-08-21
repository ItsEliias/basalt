import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importRecipeFromUrl } from './recipe-import';

function htmlWithLdJson(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`;
}

function mockFetchHtml(html: string, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status, text: async () => html })));
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const fullRecipe = {
  '@type': 'Recipe',
  name: 'Chicken Soup',
  description: 'Warms the soul',
  recipeIngredient: ['2 cups chicken broth', '1 onion'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil broth.' }, 'Add onion.'],
  recipeYield: '4',
  prepTime: 'PT15M',
  cookTime: 'PT1H30M',
  nutrition: { calories: '250 cal', proteinContent: '20g', fatContent: '8g', carbohydrateContent: '30g' },
};

describe('importRecipeFromUrl — happy path', () => {
  it('parses ingredients, steps, durations, servings, macros, and scores confidence', async () => {
    mockFetchHtml(htmlWithLdJson(fullRecipe));
    const result = await importRecipeFromUrl('https://example.com/recipe');

    expect(result.title).toBe('Chicken Soup');
    expect(result.description).toBe('Warms the soul');
    expect(result.ingredients).toEqual([
      { quantity: '2', unit: 'cups', name: 'chicken broth' },
      { quantity: '1', unit: '', name: 'onion' },
    ]);
    expect(result.steps).toEqual(['Boil broth.', 'Add onion.']);
    expect(result.prepMinutes).toBe(15);
    expect(result.cookMinutes).toBe(90);
    expect(result.servings).toBe(4);
    expect(result.estimatedMacros).toEqual({ calories: 250, protein: 20, fat: 8, carbs: 30 });
    // ingredients(35) + steps(35) + calories(20) + base(10) = 100
    expect(result.confidence).toBe(100);
    expect(result.error).toBeUndefined();
  });

  it('finds the Recipe node inside an @graph array', async () => {
    mockFetchHtml(htmlWithLdJson({ '@graph': [{ '@type': 'WebSite' }, fullRecipe] }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.title).toBe('Chicken Soup');
  });

  it('defaults servings to 1 and confidence to 10 when only a bare Recipe type exists', async () => {
    mockFetchHtml(htmlWithLdJson({ '@type': 'Recipe' }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.servings).toBe(1);
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual([]);
    expect(result.confidence).toBe(10);
  });

  it('extracts a plain string image URL', async () => {
    mockFetchHtml(htmlWithLdJson({ ...fullRecipe, image: 'https://example.com/cover.jpg' }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.imageUrl).toBe('https://example.com/cover.jpg');
  });

  it('extracts the first URL from an array of image strings', async () => {
    mockFetchHtml(htmlWithLdJson({ ...fullRecipe, image: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.imageUrl).toBe('https://example.com/a.jpg');
  });

  it('extracts url from an ImageObject', async () => {
    mockFetchHtml(htmlWithLdJson({ ...fullRecipe, image: { '@type': 'ImageObject', url: 'https://example.com/obj.jpg' } }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.imageUrl).toBe('https://example.com/obj.jpg');
  });

  it('extracts url from an array of ImageObjects', async () => {
    mockFetchHtml(htmlWithLdJson({ ...fullRecipe, image: [{ '@type': 'ImageObject', url: 'https://example.com/first.jpg' }] }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.imageUrl).toBe('https://example.com/first.jpg');
  });

  it('falls back to og:image when the Recipe node has no image', async () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/og.jpg"/><script type="application/ld+json">${JSON.stringify(fullRecipe)}</script></head></html>`;
    mockFetchHtml(html);
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.imageUrl).toBe('https://example.com/og.jpg');
  });

  it('is null when neither the Recipe node nor og:image has an image', async () => {
    mockFetchHtml(htmlWithLdJson(fullRecipe));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.imageUrl).toBeNull();
  });

  it('sends the package default User-Agent unless overridden', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => htmlWithLdJson(fullRecipe) }));
    vi.stubGlobal('fetch', fetchMock);

    await importRecipeFromUrl('https://example.com/recipe');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/recipe', {
      headers: { 'User-Agent': '@basalt/nutrition/1.0' },
    });

    await importRecipeFromUrl('https://example.com/recipe', { userAgent: 'Mozilla/5.0 (compatible; ExampleApp/1.0)' });
    expect(fetchMock).toHaveBeenLastCalledWith('https://example.com/recipe', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExampleApp/1.0)' },
    });
  });
});

describe('importRecipeFromUrl — error paths', () => {
  it('returns an HTTP error when the response is not ok', async () => {
    mockFetchHtml('', false, 404);
    const result = await importRecipeFromUrl('https://example.com/missing');
    expect(result.error).toBe('HTTP 404');
    expect(result.title).toBe('Unknown Recipe');
  });

  it('returns a network error message when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.error).toBe('Network error — check connection');
  });

  it('returns "no Recipe JSON-LD" when the page has no matching script block', async () => {
    mockFetchHtml('<html><body>no ld+json here</body></html>');
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.error).toBe('No Recipe JSON-LD found on this page');
  });

  it('skips malformed JSON-LD blocks and falls through to the not-found error', async () => {
    mockFetchHtml('<script type="application/ld+json">{not valid json</script>');
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.error).toBe('No Recipe JSON-LD found on this page');
  });

  it('skips JSON-LD blocks whose @type is not Recipe', async () => {
    mockFetchHtml(htmlWithLdJson({ '@type': 'WebPage' }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.error).toBe('No Recipe JSON-LD found on this page');
  });
});
