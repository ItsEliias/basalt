import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchByBarcode, searchByName } from './open-food-facts';

function mockFetchOnce(json: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => json })));
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const rawProduct = {
  _id: 'p1',
  code: '012345',
  product_name: 'Peanut Butter',
  brands: 'Acme',
  nutriments: {
    'energy-kcal_serving': 190.3,
    'proteins_serving': 7.5,
    'fat_serving': 16,
    'carbohydrates_serving': 6,
    'fiber_serving': 2,
    'sugars_serving': 3,
    'sodium_serving': 0.1,
    'saturated-fat_serving': 3,
  },
  serving_size: '32g',
  allergens_tags: ['en:peanuts', 'en:tree-nuts'],
  image_front_thumb_url: 'https://example.com/img.jpg',
};

describe('searchByBarcode — OFF response → OFFProduct mapping', () => {
  it('maps a found product, preferring per-serving nutriments and parsing serving size/unit', async () => {
    mockFetchOnce({ status: 1, product: rawProduct });

    const result = await searchByBarcode('012345');
    expect(result).toEqual({
      id: 'p1',
      barcode: '012345',
      name: 'Peanut Butter',
      brand: 'Acme',
      calories: 190.3,
      protein: 7.5,
      fat: 16,
      carbs: 6,
      fiber: 2,
      sugar: 3,
      sodium: 0.1,
      saturatedFat: 3,
      servingSize: 32,
      servingUnit: 'g',
      allergens: ['peanuts', 'tree nuts'],
      imageUrl: 'https://example.com/img.jpg',
    });
  });

  it('falls back to per-100g nutriments when per-serving values are absent', async () => {
    mockFetchOnce({
      status: 1,
      product: { ...rawProduct, nutriments: { 'energy-kcal_100g': 500, 'proteins_100g': 20 } },
    });
    const result = await searchByBarcode('012345');
    expect(result?.calories).toBe(500);
    expect(result?.protein).toBe(20);
    expect(result?.fat).toBe(0);
  });

  it('defaults to 100g when serving_size does not parse', async () => {
    mockFetchOnce({ status: 1, product: { ...rawProduct, serving_size: 'n/a' } });
    const result = await searchByBarcode('012345');
    expect(result?.servingSize).toBe(100);
    expect(result?.servingUnit).toBe('g');
  });

  it('returns null when OFF reports status !== 1', async () => {
    mockFetchOnce({ status: 0 });
    const result = await searchByBarcode('nope');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const result = await searchByBarcode('012345');
    expect(result).toBeNull();
  });
});

describe('searchByName', () => {
  it('maps a list of products and filters falsy results', async () => {
    mockFetchOnce({ products: [rawProduct] });
    const result = await searchByName('peanut butter');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Peanut Butter');
  });

  it('returns [] when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const result = await searchByName('anything');
    expect(result).toEqual([]);
  });

  it('returns [] when the response has no products field', async () => {
    mockFetchOnce({});
    const result = await searchByName('anything');
    expect(result).toEqual([]);
  });
});
