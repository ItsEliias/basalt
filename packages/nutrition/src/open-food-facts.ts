const BASE = 'https://world.openfoodfacts.org';

export interface OFFProduct {
  id: string;
  name: string;
  brand: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat: number;
  servingSize: number;
  servingUnit: string;
  allergens: string[];
  imageUrl?: string;
  barcode?: string;
}

export async function searchByBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(`${BASE}/api/v0/product/${barcode}.json`);
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    return mapProduct(json.product, barcode);
  } catch {
    return null;
  }
}

export async function searchByName(query: string, page = 1): Promise<OFFProduct[]> {
  try {
    const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=20`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.products ?? []).map((p: any) => mapProduct(p)).filter(Boolean);
  } catch {
    return [];
  }
}

function mapProduct(p: any, barcode?: string): OFFProduct {
  const n = p.nutriments ?? {};
  const serving = parseServing(p.serving_size ?? '100g');
  return {
    id: p._id ?? p.code ?? barcode ?? '',
    barcode: p.code ?? barcode,
    name: p.product_name ?? p.product_name_en ?? 'Unknown product',
    brand: p.brands ?? '',
    calories: round(n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0),
    protein: round(n['proteins_serving'] ?? n['proteins_100g'] ?? 0),
    fat: round(n['fat_serving'] ?? n['fat_100g'] ?? 0),
    carbs: round(n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0),
    fiber: round(n['fiber_serving'] ?? n['fiber_100g'] ?? 0),
    sugar: round(n['sugars_serving'] ?? n['sugars_100g'] ?? 0),
    sodium: round(n['sodium_serving'] ?? n['sodium_100g'] ?? 0),
    saturatedFat: round(n['saturated-fat_serving'] ?? n['saturated-fat_100g'] ?? 0),
    servingSize: serving.size,
    servingUnit: serving.unit,
    allergens: parseAllergens(p.allergens_tags ?? []),
    imageUrl: p.image_front_thumb_url ?? p.image_url,
  };
}

function parseServing(raw: string): { size: number; unit: string } {
  const match = raw.match(/^([\d.]+)\s*([a-zA-Z]+)/);
  if (match) return { size: parseFloat(match[1] ?? '0'), unit: match[2] ?? 'g' };
  return { size: 100, unit: 'g' };
}

function parseAllergens(tags: string[]): string[] {
  return tags.map((t) => t.replace('en:', '').replace(/-/g, ' '));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
