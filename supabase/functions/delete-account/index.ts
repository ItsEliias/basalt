import { createClient } from 'npm:@supabase/supabase-js@2';

// delete-account — the full cascade, server-side (Play/App Store compliance).
//
// 1. Verifies the caller's JWT and resolves their user id.
// 2. Deletes every basalt_ row belonging to them (service role bypasses RLS;
//    children cascade from parents, but each table is deleted explicitly so
//    the wipe stays complete even if an FK ever changes).
// 3. The auth record is deleted UNCONDITIONALLY (Play account-deletion
//    compliance). The project is shared with the Arise app until the
//    decommission: Arise tables carry no foreign keys to auth.users
//    (verified 2026-09-07), so deleting the auth record orphans any Arise
//    rows without touching them — and this function never touches
//    un-prefixed tables. An account that also used Arise loses sign-in;
//    accepted for the closed test, resolved for good by the decommission.

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
  'basalt_mobility_sessions',
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
  // V2/V3 additions — the wipe list is append-only and audited against the
  // migrations directory; a table missing here is a compliance bug.
  'basalt_workout_templates',
  'basalt_challenge_progress',
  'basalt_challenge_members',
  'basalt_friend_days',
  'basalt_template_exercises',
  'basalt_programs',
  'basalt_race_plans',
  'basalt_shoes',
  'basalt_cycle_entries',
  'basalt_ppg_calibration',
  'basalt_pair_days',
];

// Tables where the user can be EITHER party — keyed on their own columns,
// wiped in both directions (a grant is dead without its grantee; a pair is
// dead without its member; pair_days cascade from the pair for both sides).
const TWO_SIDED: { table: string; columns: string[] }[] = [
  { table: 'basalt_share_grants', columns: ['owner_id', 'grantee_id'] },
  { table: 'basalt_pairs', columns: ['a_id', 'b_id'] },
  { table: 'basalt_friends', columns: ['user_a', 'user_b'] },
];

// V4 social tables keyed on something other than user_id.
const KEYED: { table: string; column: string }[] = [
  { table: 'basalt_friend_invites', column: 'owner_id' },
  { table: 'basalt_challenges', column: 'creator_id' },
];

// Private storage buckets holding the user's files under a `${uid}/` prefix.
const BASALT_BUCKETS = ['basalt-food-photos', 'basalt-progress-photos', 'basalt-recipe-photos'];

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
  for (const { table, column } of KEYED) {
    const { error } = await admin.from(table).delete().eq(column, uid);
    if (error) {
      return new Response(JSON.stringify({ error: `Wipe failed at ${table}: ${error.message}` }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }
  for (const { table, columns } of TWO_SIDED) {
    for (const column of columns) {
      const { error } = await admin.from(table).delete().eq(column, uid);
      if (error) {
        return new Response(JSON.stringify({ error: `Wipe failed at ${table}.${column}: ${error.message}` }), {
          status: 500,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
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

  // 3. Delete the auth record — unconditionally. If this fails the caller
  // must know: their rows are gone but the account is not, which is a
  // compliance-relevant half-state we refuse to report as success.
  const { error: authError } = await admin.auth.admin.deleteUser(uid);
  if (authError) {
    return new Response(
      JSON.stringify({
        dataDeleted: true,
        authDeleted: false,
        error: `Every Basalt row is gone, but deleting the sign-in record failed: ${authError.message}. Try again or contact support.`,
      }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      dataDeleted: true,
      authDeleted: true,
      note: 'Every Basalt row and your sign-in record are gone.',
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
