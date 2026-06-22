// Integration tests for the reading service (tasks #27-#30), run against the
// LOCAL Supabase stack (Docker). Fails loudly if the stack is unreachable. Uses
// RPC + PostgREST only (no Edge Functions).
//
// Two principals under REAL RLS:
//   * PARENT — admin createUser -> sign in (anon) -> create_family_and_parent,
//     then create_kid, the approval queue (listPendingReadingLogs), and the
//     atomic approve/reject paths.
//   * KID — minted JWT (jose) honoring 002's claim contract -> createKidClient;
//     logs reading + reads own logs/streak.
//
// Teardown uses a DIRECT postgres superuser connection (the codebase idiom).
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import type { Database } from '@lootloop/types';
import {
  approveReadingLog,
  createKid,
  createKidClient,
  createReadingLog,
  getKidWallet,
  getReadingStreak,
  listKidReadingLogs,
  listPendingReadingLogs,
  listPointTransactions,
  rejectReadingLog,
  type LootLoopClient,
} from './index';

const URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

const admin = createClient<Database>(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DB_URL, { max: 1, prepare: false });

const TAG = `${process.pid}-${Date.now()}`;
const PARENT_EMAIL = `reading-${TAG}@lootloop.test`;
const PARENT_PASSWORD = 'test-password-123';
const FAMILY_NAME = `Reading Family ${TAG}`;
const KID_PIN = '4242';
const AWARD_POINTS = 20;

let parent: LootLoopClient;
let parentAuthUserId: string;
let familyId: string;
let parentProfileId: string;
let kidId: string;
let kidClient: LootLoopClient;
let approvedLogId: string;

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

  const { data: kid, error: kidErr } = await createKid(parent, {
    display_name: 'Test Kid',
    pin: KID_PIN,
    age_mode: 'simple',
  });
  if (kidErr || !kid) throw kidErr ?? new Error('create_kid returned no id');
  kidId = kid;

  const token = await mintKidJwt(familyId, kidId);
  kidClient = createKidClient(URL, ANON_KEY, token);
}, 30_000);

afterAll(async () => {
  if (familyId) await sql`delete from families where id = ${familyId}`;
  if (parentAuthUserId) await admin.auth.admin.deleteUser(parentAuthUserId);
  await sql.end({ timeout: 5 });
});

// --- Kid logs reading; parent sees it in the queue (#27/#28) -----------------

test('kid createReadingLog inserts a pending log for themselves', async () => {
  const { data, error } = await createReadingLog(kidClient, {
    family_id: familyId,
    kid_id: kidId,
    book_title: 'The Gruffalo',
    minutes: 25,
  });
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.book_title).toBe('The Gruffalo');
  expect(data!.minutes).toBe(25);
  expect(data!.status).toBe('pending');
  approvedLogId = data!.id;
});

test('listPendingReadingLogs (parent) returns the flattened pending log with kid name', async () => {
  const { data, error } = await listPendingReadingLogs(parent);
  expect(error).toBeNull();
  const item = data!.find(l => l.id === approvedLogId);
  expect(item).toBeDefined();
  expect(item!.kid_id).toBe(kidId);
  expect(item!.book_title).toBe('The Gruffalo');
  expect(item!.minutes).toBe(25);
  expect(item!.kid_display_name).toBe('Test Kid');
});

// --- Parent approves: points + ledger + streak (#28/#29) ---------------------

test('approveReadingLog awards points, writes an earn ledger row, sets streak to 1', async () => {
  const { data: before } = await getKidWallet(parent, kidId);
  const start = before!.wallet_balance;

  const { error } = await approveReadingLog(parent, approvedLogId, parentProfileId, AWARD_POINTS);
  expect(error).toBeNull();

  const { data: after } = await getKidWallet(parent, kidId);
  expect(after!.wallet_balance).toBe(start + AWARD_POINTS);

  const { data: txns } = await listPointTransactions(parent, kidId);
  const earn = txns!.find(t => t.type === 'earn' && t.reading_log_id === approvedLogId);
  expect(earn).toBeDefined();
  expect(earn!.amount).toBe(AWARD_POINTS);

  const { data: streak, error: streakErr } = await getReadingStreak(parent, kidId);
  expect(streakErr).toBeNull();
  expect(streak!.current_streak).toBe(1);
});

test('listKidReadingLogs shows the log as approved', async () => {
  const { data, error } = await listKidReadingLogs(kidClient, kidId);
  expect(error).toBeNull();
  const item = data!.find(l => l.id === approvedLogId);
  expect(item).toBeDefined();
  expect(item!.status).toBe('approved');
  expect(item!.awarded_points).toBe(AWARD_POINTS);
});

// --- Reject path -------------------------------------------------------------

test('rejectReadingLog flips a second pending log to rejected', async () => {
  const { data: second } = await createReadingLog(kidClient, {
    family_id: familyId,
    kid_id: kidId,
    book_title: 'Where the Wild Things Are',
    minutes: 15,
  });
  const secondId = second!.id;

  const { error } = await rejectReadingLog(parent, secondId, parentProfileId);
  expect(error).toBeNull();

  const { data: logs } = await listKidReadingLogs(parent, kidId);
  const item = logs!.find(l => l.id === secondId);
  expect(item!.status).toBe('rejected');
  expect(item!.reviewed_by).toBe(parentProfileId);

  // It is no longer in the pending queue.
  const { data: pending } = await listPendingReadingLogs(parent);
  expect(pending!.map(l => l.id)).not.toContain(secondId);
});
