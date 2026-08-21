import { createClient } from 'npm:@supabase/supabase-js@2';

// delete-account — the full cascade, server-side (Play/App Store compliance).
//
// 1. Verifies the caller's JWT and resolves their user id.
// 2. Deletes every basalt_ row belonging to them (service role bypasses RLS;
//    children cascade from parents, but each table is deleted explicitly so
//    the wipe stays complete even if an FK ever changes).
// 3. Shared-project caveat: this Supabase project also hosts the Arise app
//    with the same auth pool. The auth user record is deleted ONLY when the
//    caller has no Arise rows — otherwise deleting it would destroy their
//    Arise account too. The response says plainly which happened.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASALT_TABLES = [
  'basalt_set_entries',
  'basalt_session_exercises',
  'basalt_workout_sessions',
  'basalt_sleep_stages',
  'basalt_sleep_sessions',
  'basalt_food_entries',
  'basalt_food_favorites',
  'basalt_daily_logs',
  'basalt_hydration_logs',
  'basalt_mindfulness_sessions',
  'basalt_walks',
  'basalt_step_logs',
  'basalt_vitals',
  'basalt_checkins',
  'basalt_fasts',
  'basalt_beacons',
  'basalt_progress_photos',
  'basalt_weight_entries',
  'basalt_meal_plans',
  'basalt_grocery_items',
  'basalt_recipe_ingredients',
  'basalt_recipe_steps',
  'basalt_recipes',
  'basalt_targets',
];

// Private storage buckets holding the user's files under a `${uid}/` prefix.
const BASALT_BUCKETS = ['basalt-food-photos', 'basalt-progress-photos'];

// Arise-app tables sharing this project's auth pool; user_profiles keys on id.
const ARISE_TABLES: { table: string; column: string }[] = [
  { table: 'user_profiles', column: 'id' },
  { table: 'daily_logs', column: 'user_id' },
  { table: 'food_entries', column: 'user_id' },
  { table: 'workout_logs', column: 'user_id' },
  { table: 'step_logs', column: 'user_id' },
  { table: 'sleep_logs', column: 'user_id' },
  { table: 'walks', column: 'user_id' },
  { table: 'weight_entries', column: 'user_id' },
  { table: 'wellbeing_logs', column: 'user_id' },
  { table: 'habits', column: 'user_id' },
  { table: 'habit_logs', column: 'user_id' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const uid = userData.user.id;

  // 1. Wipe every Basalt table.
  for (const table of BASALT_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', uid);
    if (error) {
      return new Response(JSON.stringify({ error: `Wipe failed at ${table}: ${error.message}` }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }
  const { error: profileError } = await admin.from('basalt_profiles').delete().eq('id', uid);
  if (profileError) {
    return new Response(JSON.stringify({ error: `Wipe failed at basalt_profiles: ${profileError.message}` }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Wipe the user's folder in every Basalt bucket. Pagination-safe: keep
  // listing until the folder is empty.
  for (const bucket of BASALT_BUCKETS) {
    for (;;) {
      const { data: objects, error } = await admin.storage.from(bucket).list(uid, { limit: 100 });
      if (error || !objects || objects.length === 0) break;
      const { error: rmError } = await admin.storage
        .from(bucket)
        .remove(objects.map((o) => `${uid}/${o.name}`));
      if (rmError) {
        return new Response(
          JSON.stringify({ error: `Storage wipe failed in ${bucket}: ${rmError.message}` }),
          { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  // 3. Delete the auth record only when no Arise data depends on it.
  let hasAriseData = false;
  for (const { table, column } of ARISE_TABLES) {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, uid);
    if (!error && (count ?? 0) > 0) {
      hasAriseData = true;
      break;
    }
  }

  let authDeleted = false;
  if (!hasAriseData) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    authDeleted = !error;
  }

  return new Response(
    JSON.stringify({
      dataDeleted: true,
      authDeleted,
      note: authDeleted
        ? 'Every Basalt row and your sign-in record are gone.'
        : 'Every Basalt row is gone. Your sign-in record remains because this account also holds Arise data.',
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
