// Integration tests for kid management (#9-client / #15) and kid-session chores
// (#15 / #16), run against the LOCAL Supabase stack (Docker). If the stack is
// unreachable this MUST fail loudly — we never silently skip.
//
// Two principals are exercised under REAL RLS:
//   * PARENT — admin createUser -> sign in (anon client) -> create_family_and_parent,
//     then the kid-management RPCs (create/update/setPin/getCode/regen/delete).
//   * KID — NOT an auth.users row. We MINT a kid JWT in-test with `jose` honoring
//     migration 002's claim contract (ll_role='kid', family_id, profile_id, sub,
//     role/aud='authenticated', HS256 with the local project JWT secret). This
//     decouples the kid-session data layer from the kid-auth Edge Function (tested
//     separately). createKidClient attaches it as a bearer header.
//
// bcrypt pin_hash verification + the kid-only completion checks use a DIRECT
// postgres superuser connection (the codebase idiom for anything RLS forbids the
// client + teardown).
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import type { Database } from '@lootloop/types';
import {
  approveCompletion,
  bindFamilyByCode,
  claimChore,
  completeChore,
  createKid,
  createKidClient,
  deleteKid,
  getFamilyCode,
  listKidChores,
  listKids,
  regenerateFamilyCode,
  setKidPin,
  signInKid,
  updateKid,
  type LootLoopClient,
} from './index';

const URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
// The local project JWT secret PostgREST verifies HS256 tokens against. Same
// value the kid-auth Edge Function signs with locally.
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

const admin = createClient<Database>(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DB_URL, { max: 1, prepare: false });

const TAG = `${process.pid}-${Date.now()}`;
const PARENT_EMAIL = `kidmgmt-${TAG}@lootloop.test`;
const PARENT_PASSWORD = 'test-password-123';
const FAMILY_NAME = `Kid Mgmt Family ${TAG}`;
const KID_PIN = '4242';
const DUE_DATE = '2026-06-21';
const ASSIGNED_POINTS = 5;
const SHARED_POINTS = 8;

let parent: LootLoopClient;
let parentAuthUserId: string;
let familyId: string;
let parentProfileId: string;
let kidId: string;

// Mint a kid JWT honoring migration 002's claim contract.
async function mintKidJwt(famId: string, profileId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: 'authenticated',
    ll_role: 'kid',
    family_id: famId,
    profile_id: profileId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(profileId)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(secret);
}

beforeAll(async () => {
  const health = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } });
  if (!health.ok) {
    throw new Error(
      `Local Supabase unreachable at ${URL} (HTTP ${health.status}). Run \`supabase start\`.`,
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error('createUser returned no user');
  parentAuthUserId = created.user.id;

  parent = createClient<Database>(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await parent.auth.signInWithPassword({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
  });
  if (signInErr) throw signInErr;

  const { data: famId, error: bootErr } = await parent.rpc('create_family_and_parent', {
    p_family_name: FAMILY_NAME,
    p_display_name: 'Test Parent',
  });
  if (bootErr || !famId) throw bootErr ?? new Error('create_family_and_parent returned no id');
  familyId = famId;

  const { data: prof } = await parent.from('profiles').select('id').eq('role', 'parent').single();
  parentProfileId = prof!.id;
}, 30_000);

afterAll(async () => {
  if (familyId) await sql`delete from families where id = ${familyId}`;
  if (parentAuthUserId) await admin.auth.admin.deleteUser(parentAuthUserId);
  await sql.end({ timeout: 5 });
});

// --- Kid management (parent session) ----------------------------------------

test('createKid inserts a kid with a verifiable bcrypt pin_hash + auto wallet', async () => {
  const { data, error } = await createKid(parent, {
    display_name: 'Kiddo',
    pin: KID_PIN,
    age_mode: 'simple',
    birthdate: '2018-01-01',
  });
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  kidId = data!;

  // Visible via the roster (RLS profiles_select) with the right fields.
  const { data: kids } = await listKids(parent);
  const k = kids!.find(x => x.id === kidId)!;
  expect(k.display_name).toBe('Kiddo');
  expect(k.age_mode).toBe('simple');

  // pin_hash verifies against KID_PIN via pgcrypto crypt() (bcrypt MCF). Checked
  // over the direct pg connection — pin_hash is never exposed to the client.
  const [row] = await sql<{ ok: boolean; pin_hash: string }[]>`
    select pin_hash, crypt(${KID_PIN}, pin_hash) = pin_hash as ok
      from profiles where id = ${kidId}
  `;
  expect(row!.ok).toBe(true);
  expect(row!.pin_hash.startsWith('$2')).toBe(true);

  // The 003 after-insert trigger auto-created the kid's wallet.
  const { data: wallet, error: wErr } = await parent
    .from('wallets')
    .select('wallet_balance')
    .eq('kid_id', kidId)
    .single();
  expect(wErr).toBeNull();
  expect(wallet!.wallet_balance).toBe(0);
});

test('updateKid changes display_name + age_mode', async () => {
  const { error } = await updateKid(parent, kidId, {
    display_name: 'Kiddo Renamed',
    age_mode: 'detailed',
  });
  expect(error).toBeNull();

  const { data: kids } = await listKids(parent);
  const k = kids!.find(x => x.id === kidId)!;
  expect(k.display_name).toBe('Kiddo Renamed');
  expect(k.age_mode).toBe('detailed');
});

test('setKidPin re-hashes to the new PIN', async () => {
  const NEW_PIN = '987654';
  const { error } = await setKidPin(parent, kidId, NEW_PIN);
  expect(error).toBeNull();

  const [row] = await sql<{ ok: boolean }[]>`
    select crypt(${NEW_PIN}, pin_hash) = pin_hash as ok
      from profiles where id = ${kidId}
  `;
  expect(row!.ok).toBe(true);
});

test('getFamilyCode returns the family code; regenerateFamilyCode changes it', async () => {
  const { data: before, error: beforeErr } = await getFamilyCode(parent);
  expect(beforeErr).toBeNull();
  expect(before!.kid_code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);

  const { data: newCode, error: regenErr } = await regenerateFamilyCode(parent);
  expect(regenErr).toBeNull();
  expect(newCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  expect(newCode).not.toBe(before!.kid_code);

  const { data: after } = await getFamilyCode(parent);
  expect(after!.kid_code).toBe(newCode);
});

// --- Kid-session chores (#15/#16) end-to-end under real RLS ------------------

test('kid-session chores: list, claim shared, complete both, approve increments wallet', async () => {
  // Parent seeds an ASSIGNED chore (to this kid) and a SHARED chore, plus an
  // instance of each for DUE_DATE.
  const { data: assignedChore } = await parent
    .from('chores')
    .insert({
      family_id: familyId,
      title: 'Make bed',
      points: ASSIGNED_POINTS,
      assignment: 'assigned',
      assigned_kid_id: kidId,
      icon: 'bed',
    })
    .select('id')
    .single();
  const { data: sharedChore } = await parent
    .from('chores')
    .insert({
      family_id: familyId,
      title: 'Dishes',
      points: SHARED_POINTS,
      assignment: 'shared',
      icon: 'utensils',
    })
    .select('id')
    .single();

  const { data: assignedInst } = await parent
    .from('chore_instances')
    .insert({
      family_id: familyId,
      chore_id: assignedChore!.id,
      due_date: DUE_DATE,
      points: ASSIGNED_POINTS,
    })
    .select('id')
    .single();
  const { data: sharedInst } = await parent
    .from('chore_instances')
    .insert({
      family_id: familyId,
      chore_id: sharedChore!.id,
      due_date: DUE_DATE,
      points: SHARED_POINTS,
    })
    .select('id')
    .single();

  // Also seed a chore assigned to a DIFFERENT (nonexistent-for-this-kid) kid to
  // prove listKidChores excludes it. Create a second kid for that.
  const { data: otherKidId } = await createKid(parent, {
    display_name: 'Sibling',
    pin: '1111',
    age_mode: 'simple',
  });
  const { data: otherChore } = await parent
    .from('chores')
    .insert({
      family_id: familyId,
      title: 'Not mine',
      points: 3,
      assignment: 'assigned',
      assigned_kid_id: otherKidId!,
    })
    .select('id')
    .single();
  await parent
    .from('chore_instances')
    .insert({ family_id: familyId, chore_id: otherChore!.id, due_date: DUE_DATE, points: 3 });

  // Build the KID client from a minted JWT.
  const token = await mintKidJwt(familyId, kidId);
  const kidClient = createKidClient(URL, ANON_KEY, token);

  // listKidChores shows the assigned + shared instances, excludes the sibling's.
  const { data: list1, error: list1Err } = await listKidChores(kidClient, kidId, DUE_DATE);
  expect(list1Err).toBeNull();
  const ids1 = list1!.map(c => c.instance_id);
  expect(ids1).toContain(assignedInst!.id);
  expect(ids1).toContain(sharedInst!.id);
  expect(list1!.length).toBe(2);
  const assignedRow = list1!.find(c => c.instance_id === assignedInst!.id)!;
  expect(assignedRow.title).toBe('Make bed');
  expect(assignedRow.status).toBeNull();
  expect(assignedRow.assignment).toBe('assigned');

  // Claim the shared one → status 'claimed'.
  const { error: claimErr } = await claimChore(kidClient, sharedInst!.id, kidId);
  expect(claimErr).toBeNull();

  const { data: list2 } = await listKidChores(kidClient, kidId, DUE_DATE);
  const sharedRow2 = list2!.find(c => c.instance_id === sharedInst!.id)!;
  expect(sharedRow2.status).toBe('claimed');
  expect(sharedRow2.completion_id).not.toBeNull();

  // Complete both: assigned (no prior claim → insert pending), shared (update → pending).
  const { error: c1 } = await completeChore(kidClient, assignedInst!.id, kidId);
  expect(c1).toBeNull();
  const { error: c2 } = await completeChore(kidClient, sharedInst!.id, kidId);
  expect(c2).toBeNull();

  const { data: list3 } = await listKidChores(kidClient, kidId, DUE_DATE);
  expect(list3!.find(c => c.instance_id === assignedInst!.id)!.status).toBe('pending');
  expect(list3!.find(c => c.instance_id === sharedInst!.id)!.status).toBe('pending');

  // Parent approves the assigned completion → kid wallet increments by its points.
  const { data: before } = await parent
    .from('wallets')
    .select('wallet_balance')
    .eq('kid_id', kidId)
    .single();
  const start = before!.wallet_balance;

  const assignedCompletionId = list3!.find(c => c.instance_id === assignedInst!.id)!.completion_id!;
  const { error: approveErr } = await approveCompletion(
    parent,
    assignedCompletionId,
    parentProfileId,
  );
  expect(approveErr).toBeNull();

  const { data: after } = await parent
    .from('wallets')
    .select('wallet_balance')
    .eq('kid_id', kidId)
    .single();
  expect(after!.wallet_balance).toBe(start + ASSIGNED_POINTS);
});

// --- Edge-function login wrappers (served locally) --------------------------
// Thin invoke wrappers; full e2e is covered by the function-level tests. Here we
// confirm the wrappers parse the served responses into the documented shapes.
// (The kid's PIN was rotated to 987654 by the setKidPin test above.)

test('bindFamilyByCode returns the family roster for the current code', async () => {
  const { data: codeRow } = await getFamilyCode(parent);
  const { data, error } = await bindFamilyByCode(parent, codeRow!.kid_code);
  expect(error).toBeNull();
  expect(data!.family_id).toBe(familyId);
  expect(data!.family_name).toBe(FAMILY_NAME);
  expect(data!.kids.map(k => k.profile_id)).toContain(kidId);
});

test('signInKid mints a token for the right PIN; errors on a wrong PIN', async () => {
  const { data, error } = await signInKid(parent, {
    family_id: familyId,
    profile_id: kidId,
    pin: '987654',
  });
  expect(error).toBeNull();
  expect(typeof data!.access_token).toBe('string');
  expect(data!.token_type).toBe('bearer');
  expect(data!.profile.id).toBe(kidId);

  const bad = await signInKid(parent, { family_id: familyId, profile_id: kidId, pin: '000000' });
  expect(bad.data).toBeNull();
  expect(bad.error).not.toBeNull();
});

// --- deleteKid (last, removes the kid) --------------------------------------

test('deleteKid removes the kid from the family', async () => {
  const { data: tempKidId } = await createKid(parent, {
    display_name: 'Temp',
    pin: '5555',
    age_mode: 'teen',
  });
  const { error } = await deleteKid(parent, tempKidId!);
  expect(error).toBeNull();

  const { data: kids } = await listKids(parent);
  expect(kids!.map(k => k.id)).not.toContain(tempKidId);
});
