// Integration test for the chore data service (task #11), run against the LOCAL
// Supabase stack (Docker). Acceptance: "Service functions work in tests against
// local Supabase." If the local stack is unreachable this MUST fail loudly — we
// never silently skip.
//
// This codebase deliberately does NOT use service_role PostgREST (it lacks DML
// grants on public tables by design). The established idiom for privileged DB
// access is a DIRECT postgres superuser connection (see
// supabase/functions/kid-auth and generate-recurring-chores). We follow it here.
//
// Everything is exercised through a REAL parent RLS session — which is better
// coverage than a bypass, since it proves the service functions work under the
// actual policies. The ONLY write RLS forbids the parent (inserting the kid's
// chore_completion, a kid-only insert) is done via the direct pg connection.
//
// Flow (parent session unless noted):
//   bootstrap family + parent (admin createUser -> sign in -> create_family_and_parent)
//   create the kid via the parent session (RLS profiles_parent_insert)
//   createChore -> listChores -> updateChore
//   insert a chore_instance via the parent session (RLS chore_instances_parent_insert)
//   insert the pending chore_completion via direct pg (kid-only RLS insert)
//   listPendingCompletions -> approveCompletion (asserts wallet increment)
//   rejectCompletion sets status='rejected'
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import type { Database } from '@lootloop/types';
import {
  approveCompletion,
  createChore,
  getMyParentProfile,
  listChores,
  listKids,
  listPendingCompletions,
  rejectCompletion,
  updateChore,
  type LootLoopClient,
} from './index';

const URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// admin: GoTrue admin API only (createUser/deleteUser). NOT used for PostgREST
// table access — service_role has no DML grants here by design.
const admin = createClient<Database>(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Direct privileged Postgres connection — the codebase idiom for writes RLS
// forbids the client (here: the kid-only chore_completion insert) + teardown.
const sql = postgres(DB_URL, { max: 1, prepare: false });

const TAG = `${process.pid}-${Date.now()}`;
const PARENT_EMAIL = `parent-${TAG}@lootloop.test`;
const PARENT_PASSWORD = 'test-password-123';
const FAMILY_NAME = `Test Family ${TAG}`;
const CHORE_POINTS = 7;
const UPDATED_POINTS = 11;

let parent: LootLoopClient; // RLS-scoped parent session
let parentAuthUserId: string;
let coParentAuthUserId: string; // second parent in the same family (co-parent)
let familyId: string;
let parentProfileId: string;
let kidId: string;
let choreId: string;
let instanceId: string;
let completionId: string;

beforeAll(async () => {
  // Fail loudly if the local stack is down.
  const health = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } });
  if (!health.ok) {
    throw new Error(
      `Local Supabase unreachable at ${URL} (HTTP ${health.status}). Run \`supabase start\`.`,
    );
  }

  // 1. Create a confirmed parent auth user via the admin API (GoTrue).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error('createUser returned no user');
  parentAuthUserId = created.user.id;

  // 2. Sign that parent in with an anon client to get an RLS-scoped session.
  parent = createClient<Database>(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await parent.auth.signInWithPassword({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
  });
  if (signInErr) throw signInErr;

  // 3. Bootstrap the family + parent profile via the onboarding RPC.
  const { data: famId, error: bootErr } = await parent.rpc('create_family_and_parent', {
    p_family_name: FAMILY_NAME,
    p_display_name: 'Test Parent',
  });
  if (bootErr || !famId) throw bootErr ?? new Error('create_family_and_parent returned no id');
  familyId = famId;

  // 4. Create the kid via the PARENT session (RLS profiles_parent_insert). The
  //    after-insert trigger auto-creates the kid's wallet + reading_streak.
  const { data: kid, error: kidErr } = await parent
    .from('profiles')
    .insert({
      family_id: familyId,
      role: 'kid',
      display_name: 'Test Kid',
      pin_hash: '$2a$10$abcdefghijklmnopqrstuv', // bcrypt-shaped placeholder
      age_mode: 'simple',
    })
    .select('id')
    .single();
  if (kidErr || !kid) throw kidErr ?? new Error('kid insert returned no row');
  kidId = kid.id;
}, 30_000);

afterAll(async () => {
  // Deleting the family cascades to profiles/chores/instances/completions/wallets.
  if (familyId) await sql`delete from families where id = ${familyId}`;
  if (parentAuthUserId) await admin.auth.admin.deleteUser(parentAuthUserId);
  if (coParentAuthUserId) await admin.auth.admin.deleteUser(coParentAuthUserId);
  await sql.end({ timeout: 5 });
});

test('getMyParentProfile returns the signed-in parent with family_id', async () => {
  const { data, error } = await getMyParentProfile(parent);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.family_id).toBe(familyId);
  expect(data!.display_name).toBe('Test Parent');
  parentProfileId = data!.id;
});

// Co-parent regression (multi-parent family): getMyParentProfile must resolve to
// the CALLER's own profile, not error on maybeSingle() when the family has >1
// parent. Add a second parent to the same family, then re-run as the first parent.
test('getMyParentProfile still returns the caller when a co-parent exists', async () => {
  const { data: co, error: coErr } = await admin.auth.admin.createUser({
    email: `coparent-${TAG}@lootloop.test`,
    password: PARENT_PASSWORD,
    email_confirm: true,
  });
  if (coErr || !co.user) throw coErr ?? new Error('co-parent createUser returned no user');
  coParentAuthUserId = co.user.id;

  // Insert the co-parent profile via the direct pg connection (a second parent
  // row is exactly the state the co-parent invite flow produces in production).
  await sql`
    insert into profiles (family_id, role, display_name, auth_user_id)
    values (${familyId}, 'parent', 'Co Parent', ${coParentAuthUserId})
  `;

  const { data, error } = await getMyParentProfile(parent);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.id).toBe(parentProfileId); // still the caller, not the co-parent
  expect(data!.display_name).toBe('Test Parent');
});

test('listKids returns the family kid', async () => {
  const { data, error } = await listKids(parent);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.map(k => k.id)).toContain(kidId);
  const k = data!.find(x => x.id === kidId)!;
  expect(k.display_name).toBe('Test Kid');
  expect(k.age_mode).toBe('simple');
});

test('createChore inserts a chore assigned to the kid', async () => {
  const { data, error } = await createChore(parent, {
    family_id: familyId,
    title: 'Take out the trash',
    points: CHORE_POINTS,
    assignment: 'assigned',
    assigned_kid_id: kidId,
    icon: 'trash-2',
  });
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.title).toBe('Take out the trash');
  expect(data!.points).toBe(CHORE_POINTS);
  choreId = data!.id;
});

test('listChores returns the created chore', async () => {
  const { data, error } = await listChores(parent);
  expect(error).toBeNull();
  expect(data!.map(c => c.id)).toContain(choreId);
});

test('updateChore changes the points', async () => {
  const { data, error } = await updateChore(parent, choreId, { points: UPDATED_POINTS });
  expect(error).toBeNull();
  expect(data!.points).toBe(UPDATED_POINTS);
});

test('listPendingCompletions returns a seeded pending completion (flattened)', async () => {
  // Instance via the parent session (RLS chore_instances_parent_insert).
  const { data: inst, error: instErr } = await parent
    .from('chore_instances')
    .insert({
      family_id: familyId,
      chore_id: choreId,
      due_date: '2026-06-21',
      points: UPDATED_POINTS, // award snapshot = instance points
    })
    .select('id')
    .single();
  if (instErr || !inst) throw instErr ?? new Error('instance insert returned no row');
  instanceId = inst.id;

  // The kid-only completion insert (RLS forbids the parent) → direct pg.
  const [comp] = await sql<{ id: string }[]>`
    insert into chore_completions (family_id, chore_instance_id, kid_id, status)
    values (${familyId}, ${instanceId}, ${kidId}, 'pending')
    returning id
  `;
  if (!comp) throw new Error('completion insert returned no row');
  completionId = comp.id;

  const { data, error } = await listPendingCompletions(parent);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  const row = data!.find(r => r.id === completionId);
  expect(row).toBeDefined();
  expect(row!.kid_id).toBe(kidId);
  expect(row!.status).toBe('pending');
  expect(row!.points).toBe(UPDATED_POINTS);
  expect(row!.due_date).toBe('2026-06-21');
  expect(row!.chore_title).toBe('Take out the trash');
  expect(row!.chore_icon).toBe('trash-2');
  expect(row!.kid_display_name).toBe('Test Kid');
});

test('approveCompletion awards instance points to the kid wallet', async () => {
  // Parent can read family wallets (RLS wallets_select).
  const { data: before, error: beforeErr } = await parent
    .from('wallets')
    .select('wallet_balance')
    .eq('kid_id', kidId)
    .single();
  expect(beforeErr).toBeNull();
  const startBalance = before!.wallet_balance;

  const { error } = await approveCompletion(parent, completionId, parentProfileId);
  expect(error).toBeNull();

  const { data: after, error: afterErr } = await parent
    .from('wallets')
    .select('wallet_balance')
    .eq('kid_id', kidId)
    .single();
  expect(afterErr).toBeNull();
  expect(after!.wallet_balance).toBe(startBalance + UPDATED_POINTS);

  // Completion is now approved with the snapshot awarded.
  const { data: comp } = await parent
    .from('chore_completions')
    .select('status, awarded_points')
    .eq('id', completionId)
    .single();
  expect(comp!.status).toBe('approved');
  expect(comp!.awarded_points).toBe(UPDATED_POINTS);
});

test('rejectCompletion sets status to rejected', async () => {
  // Seed a second pending completion to reject (one completion per (instance,kid)).
  const { data: inst, error: instErr } = await parent
    .from('chore_instances')
    .insert({ family_id: familyId, chore_id: choreId, due_date: '2026-06-22', points: 3 })
    .select('id')
    .single();
  if (instErr || !inst) throw instErr ?? new Error('instance insert returned no row');

  const [comp] = await sql<{ id: string }[]>`
    insert into chore_completions (family_id, chore_instance_id, kid_id, status)
    values (${familyId}, ${inst.id}, ${kidId}, 'pending')
    returning id
  `;
  if (!comp) throw new Error('completion insert returned no row');

  const { error } = await rejectCompletion(parent, comp.id, parentProfileId);
  expect(error).toBeNull();

  const { data: after } = await parent
    .from('chore_completions')
    .select('status, reviewed_by')
    .eq('id', comp.id)
    .single();
  expect(after!.status).toBe('rejected');
  expect(after!.reviewed_by).toBe(parentProfileId);
});
