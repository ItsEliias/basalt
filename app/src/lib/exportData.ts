import { supabase } from './supabase';
import type { ExportBundle } from './exportFormat';

// Export everything — one tap, no email-us nonsense. RLS scopes every query
// to the signed-in user; what you get is exactly what the ledger holds.

export const EXPORT_TABLES = [
  'basalt_profiles',
  'basalt_targets',
  'basalt_daily_logs',
  'basalt_food_entries',
  'basalt_food_favorites',
  'basalt_workout_sessions',
  'basalt_session_exercises',
  'basalt_set_entries',
  'basalt_walks',
  'basalt_step_logs',
  'basalt_vitals',
  'basalt_checkins',
  'basalt_fasts',
  'basalt_beacons',
  'basalt_weight_entries',
  'basalt_sleep_sessions',
  'basalt_sleep_stages',
  'basalt_hydration_logs',
  'basalt_mindfulness_sessions',
  'basalt_recipes',
  'basalt_recipe_ingredients',
  'basalt_recipe_steps',
  'basalt_meal_plans',
  'basalt_grocery_items',
] as const;

/**
 * Progress-photo records are excluded unless explicitly included — the
 * vault is private-by-default all the way into exports.
 */
export async function collectExport(includeProgressPhotos = false): Promise<ExportBundle> {
  const bundle: ExportBundle = {};
  const tables = includeProgressPhotos ? [...EXPORT_TABLES, 'basalt_progress_photos'] : [...EXPORT_TABLES];
  for (const table of tables) {
    const { data } = await supabase.from(table).select('*').limit(10000);
    bundle[table] = (data ?? []) as Record<string, unknown>[];
  }
  return bundle;
}
