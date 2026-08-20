import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// The grocery list — quantities consolidated, units normalised, grouped by
// aisle, checkable in-store. One running list per user in V1; shared lists
// arrive with V1.x.

export type GroceryItem = {
  id: string;
  name: string;
  qty: number | null;
  unit: string | null;
  aisle: string;
  checked: boolean;
};

export type GroceryInput = { name: string; qty: number | null; unit: string | null };

// ─── Unit normalisation (pure) ──────────────────────────────────────────────

const UNIT_MAP: Record<string, { unit: string; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  litre: { unit: 'ml', factor: 1000 },
  liter: { unit: 'ml', factor: 1000 },
  tbsp: { unit: 'tbsp', factor: 1 },
  tablespoon: { unit: 'tbsp', factor: 1 },
  tablespoons: { unit: 'tbsp', factor: 1 },
  tsp: { unit: 'tsp', factor: 1 },
  teaspoon: { unit: 'tsp', factor: 1 },
  teaspoons: { unit: 'tsp', factor: 1 },
  cup: { unit: 'cup', factor: 1 },
  cups: { unit: 'cup', factor: 1 },
};

/** Normalise to a base unit (kg→g, l→ml, unit-word plurals collapsed). */
export function normalizeQty(qty: number | null, unit: string | null): { qty: number | null; unit: string | null } {
  if (qty === null) return { qty: null, unit: unit ? unit.toLowerCase() : null };
  if (!unit) return { qty, unit: null };
  const mapped = UNIT_MAP[unit.toLowerCase().replace(/\.$/, '')];
  if (!mapped) return { qty, unit: unit.toLowerCase() };
  return { qty: Math.round(qty * mapped.factor * 100) / 100, unit: mapped.unit };
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Consolidate incoming items into an existing list: same name + same base
 * unit → one row with summed qty; a prose amount (null qty) merging with a
 * numeric one keeps the row but can't sum — both survive as separate rows
 * rather than inventing a number.
 */
export function consolidate(
  existing: { name: string; qty: number | null; unit: string | null }[],
  incoming: GroceryInput[],
): { merged: { name: string; qty: number | null; unit: string | null }[]; added: GroceryInput[] } {
  const merged = existing.map((e) => ({ ...e, ...normalizeQty(e.qty, e.unit) }));
  const added: GroceryInput[] = [];

  for (const raw of incoming) {
    const inc = { name: raw.name, ...normalizeQty(raw.qty, raw.unit) };
    const match = merged.find(
      (m) => nameKey(m.name) === nameKey(inc.name) && m.unit === inc.unit && m.qty !== null && inc.qty !== null,
    );
    if (match) {
      match.qty = Math.round((match.qty! + inc.qty!) * 100) / 100;
    } else {
      added.push(inc);
    }
  }
  return { merged, added };
}

// ─── Aisle guessing (pure, honest default 'other') ──────────────────────────

const AISLES: [RegExp, string][] = [
  [/\b(onion|carrot|spinach|garlic|potato|tomato|capsicum|broccoli|lettuce|cucumber|zucchini|mushroom|apple|banana|lemon|lime|herb|parsley|coriander|basil|ginger|chilli|avocado)\b/i, 'produce'],
  [/\b(beef|chicken|pork|lamb|mince|salmon|tuna|fish|prawn|shrimp|bacon|sausage|turkey)\b/i, 'meat & fish'],
  [/\b(milk|cheese|butter|yoghurt|yogurt|cream|egg)s?\b/i, 'dairy & eggs'],
  [/\b(frozen|ice)\b/i, 'frozen'],
  [/\b(bread|roll|wrap|tortilla|bagel)s?\b/i, 'bakery'],
];

export function aisleFor(name: string): string {
  for (const [pattern, aisle] of AISLES) {
    if (pattern.test(name)) return aisle;
  }
  return name.trim() ? 'pantry' : 'other';
}

/** Aisle presentation order for the list. */
export const AISLE_ORDER = ['produce', 'meat & fish', 'dairy & eggs', 'bakery', 'frozen', 'pantry', 'other'];

export function groupByAisle(items: GroceryItem[]): { aisle: string; items: GroceryItem[] }[] {
  const groups = new Map<string, GroceryItem[]>();
  for (const item of items) {
    groups.set(item.aisle, [...(groups.get(item.aisle) ?? []), item]);
  }
  return AISLE_ORDER.filter((a) => groups.has(a)).map((aisle) => ({ aisle, items: groups.get(aisle)! }));
}

// ─── Persistence ────────────────────────────────────────────────────────────

function mapRow(r: any): GroceryItem {
  return {
    id: r.id,
    name: r.name,
    qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
    unit: r.unit ?? null,
    aisle: r.aisle ?? 'other',
    checked: r.checked ?? false,
  };
}

export async function listGroceryItems(client: SupabaseClient): Promise<Result<GroceryItem[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_grocery_items')
    .select('*')
    .eq('user_id', u.data)
    .order('position', { ascending: true });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

/** Add items, consolidating into existing UNCHECKED rows where possible. */
export async function addToGroceryList(
  client: SupabaseClient,
  items: GroceryInput[],
): Promise<Result<{ addedCount: number; mergedCount: number }>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const current = await listGroceryItems(client);
  if (!current.ok) return current;
  const unchecked = current.data.filter((i) => !i.checked);

  const { merged, added } = consolidate(unchecked, items);

  // Push qty updates for rows whose totals changed.
  let mergedCount = 0;
  for (let i = 0; i < unchecked.length; i++) {
    const before = normalizeQty(unchecked[i]!.qty, unchecked[i]!.unit);
    const after = merged[i]!;
    if (after.qty !== before.qty || after.unit !== before.unit) {
      const { error } = await client
        .from('basalt_grocery_items')
        .update({ qty: after.qty, unit: after.unit })
        .eq('id', unchecked[i]!.id);
      if (error) return err(error.message);
      mergedCount++;
    }
  }

  if (added.length > 0) {
    const basePos = current.data.length;
    const { error } = await client.from('basalt_grocery_items').insert(
      added.map((a, i) => ({
        user_id: u.data,
        name: a.name,
        qty: a.qty,
        unit: a.unit,
        aisle: aisleFor(a.name),
        position: basePos + i,
      })),
    );
    if (error) return err(error.message);
  }
  return ok({ addedCount: added.length, mergedCount });
}

export async function setGroceryChecked(client: SupabaseClient, id: string, checked: boolean): Promise<Result<void>> {
  const { error } = await client.from('basalt_grocery_items').update({ checked }).eq('id', id);
  if (error) return err(error.message);
  return ok(undefined);
}

export async function clearCheckedGroceries(client: SupabaseClient): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client
    .from('basalt_grocery_items')
    .delete()
    .eq('user_id', u.data)
    .eq('checked', true);
  if (error) return err(error.message);
  return ok(undefined);
}
