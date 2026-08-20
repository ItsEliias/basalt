export interface UrlRecipeImport {
  title: string;
  description: string;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  steps: string[];
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  estimatedMacros: { calories: number; protein: number; fat: number; carbs: number };
  source: string;
  confidence: number;
  error?: string;
}

export interface ImportRecipeFromUrlOptions {
  /** Overrides the default request `User-Agent`. */
  userAgent?: string;
}

const DEFAULT_USER_AGENT = '@basalt/nutrition/1.0';

const EMPTY_RESULT: Omit<UrlRecipeImport, 'source'> = {
  title: 'Unknown Recipe',
  description: '',
  ingredients: [],
  steps: [],
  prepMinutes: 0,
  cookMinutes: 0,
  servings: 1,
  estimatedMacros: { calories: 0, protein: 0, fat: 0, carbs: 0 },
  confidence: 0,
};

function parseIsoDuration(iso?: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0');
}

function parseIngredient(raw: string): { name: string; quantity: string; unit: string } {
  const m = raw.trim().match(/^([\d\s./½¼¾⅓⅔]+)\s*([a-zA-Z]+\.?)?\s+(.+)$/);
  if (m) return { quantity: (m[1] ?? '').trim(), unit: m[2]?.trim() ?? '', name: (m[3] ?? '').trim() };
  return { quantity: '', unit: '', name: raw.trim() };
}

function extractNutrition(n: any): { calories: number; protein: number; fat: number; carbs: number } {
  const g = (v?: string) => v ? parseFloat(v.replace(/[^\d.]/g, '')) || 0 : 0;
  return {
    calories: g(n?.calories),
    protein: g(n?.proteinContent),
    fat: g(n?.fatContent),
    carbs: g(n?.carbohydrateContent),
  };
}

function findRecipeNode(parsed: unknown): Record<string, unknown> | null {
  const nodes: unknown[] = Array.isArray(parsed)
    ? parsed
    : [(parsed as any)?.['@graph'] ? (parsed as any)['@graph'] : parsed].flat();

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    const type = n['@type'];
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return n;
  }
  return null;
}

export async function importRecipeFromUrl(
  url: string,
  options: ImportRecipeFromUrlOptions = {},
): Promise<UrlRecipeImport> {
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent },
    });
    if (!res.ok) return { ...EMPTY_RESULT, source: url, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch {
    return { ...EMPTY_RESULT, source: url, error: 'Network error — check connection' };
  }

  const ldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const block of ldBlocks) {
    let parsed: unknown;
    try { parsed = JSON.parse(block[1] ?? ''); } catch { continue; }

    const recipe = findRecipeNode(parsed);
    if (!recipe) continue;

    const rawIngredients: unknown[] = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
    const ingredients = (rawIngredients as string[]).map(parseIngredient);

    const rawSteps: unknown[] = Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions : [];
    const steps = rawSteps.map((s) =>
      typeof s === 'string' ? s : typeof s === 'object' && s !== null ? (s as any).text ?? '' : ''
    ).filter(Boolean) as string[];

    const servings = parseInt(String(recipe.recipeYield ?? recipe.servings ?? '1')) || 1;
    const macros = extractNutrition(recipe.nutrition);

    const confidence =
      (ingredients.length > 0 ? 35 : 0) +
      (steps.length > 0 ? 35 : 0) +
      (macros.calories > 0 ? 20 : 0) +
      10;

    return {
      title: String(recipe.name ?? 'Imported Recipe'),
      description: String(recipe.description ?? ''),
      ingredients,
      steps,
      prepMinutes: parseIsoDuration(recipe.prepTime as string | undefined),
      cookMinutes: parseIsoDuration(recipe.cookTime as string | undefined),
      servings,
      estimatedMacros: macros,
      source: url,
      confidence,
    };
  }

  return { ...EMPTY_RESULT, source: url, error: 'No Recipe JSON-LD found on this page' };
}
