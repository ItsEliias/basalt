import { createClient } from '@supabase/supabase-js';

// Live RLS probe for sharing (docs/SHARING-RLS-DESIGN.md testing plan).
// Two real signed-in sessions against the deployed policies:
//
//   1. before a claim, a grantee sees NOTHING
//   2. a code redeems once and only once
//   3. granted domains open; ungranted domains stay closed
//   4. the walks VIEW returns rows WITHOUT a route column, while the
//      walks TABLE stays closed to the grantee
//   5. a grantee cannot write — insert and update both bounce
//   6. revocation kills access at the very next query
//   7. an owner cannot redeem their own code
//
// Needs .env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY (to ensure the second account exists),
// and the seeded owner account (scripts/seedTestAccount.ts).

const OWNER_EMAIL = 'cody.liddell.01@gmail.com';
const OWNER_PASSWORD = 'TEST123';
const GRANTEE_EMAIL = 'basalt.share.probe@example.com';
const GRANTEE_PASSWORD = 'TEST123';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  try { process.loadEnvFile(); } catch { /* env may be set already */ }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !service) {
    console.error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  // Ensure the grantee account exists and is confirmed.
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const created = await admin.auth.admin.createUser({
    email: GRANTEE_EMAIL, password: GRANTEE_PASSWORD, email_confirm: true,
  });
  if (created.error && !/already/i.test(created.error.message)) {
    let page = 1; let id: string | null = null;
    while (!id && page < 10) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      id = data.users.find((u) => u.email === GRANTEE_EMAIL)?.id ?? null;
      page++;
    }
    if (!id) { console.error(`Cannot create probe account: ${created.error.message}`); process.exit(1); }
    await admin.auth.admin.updateUserById(id, { password: GRANTEE_PASSWORD, email_confirm: true });
  }

  const owner = createClient(url, key);
  const grantee = createClient(url, key);
  const o = await owner.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  const g = await grantee.auth.signInWithPassword({ email: GRANTEE_EMAIL, password: GRANTEE_PASSWORD });
  if (o.error || g.error) {
    console.error(`Sign-in failed: ${o.error?.message ?? g.error?.message}`);
    process.exit(1);
  }
  const ownerId = o.data.user!.id;

  // Clean slate: owner deletes any previous probe grants.
  await owner.from('basalt_share_grants').delete().eq('owner_id', ownerId);

  // 1 · before any claim, the grantee sees nothing of the owner's.
  const pre = await grantee.from('basalt_workout_sessions').select('id').eq('user_id', ownerId).limit(1);
  check('pre-claim: grantee sees no sessions', !pre.error && (pre.data ?? []).length === 0);

  // Create the grant (coach preset = training, activity, body).
  const grant = await owner
    .from('basalt_share_grants')
    .insert({ owner_id: ownerId, role: 'coach', domains: ['training', 'activity', 'body'] })
    .select()
    .single();
  if (grant.error || !grant.data) { console.error(`Grant insert failed: ${grant.error?.message}`); process.exit(1); }
  const code = grant.data.invite_code as string;

  // 2 · code redeems once, and only once.
  const claim1 = await grantee.rpc('basalt_redeem_share_code', { p_code: code });
  check('redeem: first claim succeeds', !claim1.error, claim1.error?.message);
  const claim2 = await grantee.rpc('basalt_redeem_share_code', { p_code: code });
  check('redeem: second claim is refused (single-use)', !!claim2.error);

  // 7 · an owner cannot redeem their own code.
  const g2 = await owner
    .from('basalt_share_grants')
    .insert({ owner_id: ownerId, role: 'custom', domains: ['body'] })
    .select()
    .single();
  const selfClaim = await owner.rpc('basalt_redeem_share_code', { p_code: g2.data!.invite_code });
  check('redeem: owner cannot claim their own code', !!selfClaim.error);

  // 3 · granted domains open; ungranted stay closed.
  const sessions = await grantee.from('basalt_workout_sessions').select('id').eq('user_id', ownerId).limit(5);
  check('granted: training readable', !sessions.error && (sessions.data ?? []).length > 0,
    sessions.error?.message ?? `rows=${(sessions.data ?? []).length}`);
  const weights = await grantee.from('basalt_weight_entries').select('id').eq('user_id', ownerId).limit(1);
  check('granted: body readable', !weights.error && (weights.data ?? []).length > 0);
  const vitals = await grantee.from('basalt_vitals').select('id').eq('user_id', ownerId).limit(1);
  check('ungranted: vitals stays closed', !vitals.error && (vitals.data ?? []).length === 0);
  const food = await grantee.from('basalt_food_entries').select('id').eq('user_id', ownerId).limit(1);
  check('ungranted: nutrition stays closed', !food.error && (food.data ?? []).length === 0);

  // 4 · walks: view yes (route-stripped), table no.
  const viewWalks = await grantee.from('basalt_walks_shared').select('*').eq('user_id', ownerId).limit(1);
  const viewRow: any = viewWalks.data?.[0];
  check('walks view: rows visible to grantee', !viewWalks.error && !!viewRow, viewWalks.error?.message);
  check('walks view: route column does not exist', !!viewRow && !('route' in viewRow));
  const tableWalks = await grantee.from('basalt_walks').select('id').eq('user_id', ownerId).limit(1);
  check('walks table: closed to grantee', !tableWalks.error && (tableWalks.data ?? []).length === 0);

  // 5 · a grantee cannot write.
  const insertTry = await grantee
    .from('basalt_weight_entries')
    .insert({ user_id: ownerId, weight_kg: 1, measured_at: new Date().toISOString(), source: 'probe' });
  check('write: insert into owner rows bounces', !!insertTry.error);
  const sid = sessions.data?.[0]?.id;
  if (sid) {
    const updateTry = await grantee.from('basalt_workout_sessions').update({ notes: 'probe' }).eq('id', sid).select();
    check('write: update of owner rows affects nothing', !updateTry.error && (updateTry.data ?? []).length === 0);
  }

  // 6 · revocation kills access at the next query.
  await owner.from('basalt_share_grants').update({ revoked_at: new Date().toISOString() }).eq('id', grant.data.id);
  const post = await grantee.from('basalt_workout_sessions').select('id').eq('user_id', ownerId).limit(1);
  check('revoked: training closes immediately', !post.error && (post.data ?? []).length === 0);
  const postView = await grantee.from('basalt_walks_shared').select('id').eq('user_id', ownerId).limit(1);
  check('revoked: walks view closes immediately', !postView.error && (postView.data ?? []).length === 0);

  // Cleanup.
  await owner.from('basalt_share_grants').delete().eq('owner_id', ownerId);

  console.log(`\n=== sharing RLS probe · ${passed} passed, ${failures.length} failed ===`);
  if (failures.length > 0) process.exit(1);
}

void main();
