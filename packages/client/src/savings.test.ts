// Integration tests for the savings service (tasks #31-#33), run against the
// LOCAL Supabase stack (Docker). Fails loudly if the stack is unreachable. Uses
// RPC + PostgREST only (no Edge Functions).
//
// PARENT seeds the kid's wallet (awardBonusPoints). KID (minted JWT ->
// createKidClient) moves points to/from savings via the atomic
// transfer_to_savings RPC and reads own wallet + savings ledger under RLS.
//
// Teardown uses a DIRECT postgres superuser connection (the codebase idiom).
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import type { Database } from '@lootloop/types';
import {
  awardBonusPoints,
  createKid,
  createKidClient,
  getKidWallet,
  listSavingsTransactions,
  transferToSavings,
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
const PARENT_EMAIL = `savings-${TAG}@lootloop.test`;
const PARENT_PASSWORD = 'test-password-123';
const FAMILY_NAME = `Savings Family ${TAG}`;
const KID_PIN = '4242';
const SEED = 100;
const DEPOSIT = 40;
const WITHDRAW = 15;

let parent: LootLoopClient;
let parentAuthUserId: string;
let familyId: string;
let parentProfileId: string;
let kidId: string;
let kidClient: LootLoopClient;

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

  // Seed the kid's spendable wallet so they have something to deposit.
  const { error: seedErr } = await awardBonusPoints(parent, kidId, SEED, 'Seed', parentProfileId);
  if (seedErr) throw seedErr;

  const token = await mintKidJwt(familyId, kidId);
  kidClient = createKidClient(URL, ANON_KEY, token);
}, 30_000);

afterAll(async () => {
  if (familyId) await sql`delete from families where id = ${familyId}`;
  if (parentAuthUserId) await admin.auth.admin.deleteUser(parentAuthUserId);
  await sql.end({ timeout: 5 });
});

// --- Deposit (#32/#33) -------------------------------------------------------

test('kid transferToSavings deposit moves wallet -> savings and writes a deposit row', async () => {
  const { data: before } = await getKidWallet(kidClient, kidId);
  expect(before!.wallet_balance).toBe(SEED);
  expect(before!.savings_balance).toBe(0);

  const { error } = await transferToSavings(kidClient, kidId, DEPOSIT, 'deposit');
  expect(error).toBeNull();

  const { data: after } = await getKidWallet(kidClient, kidId);
  expect(after!.wallet_balance).toBe(SEED - DEPOSIT);
  expect(after!.savings_balance).toBe(DEPOSIT);

  const { data: txns, error: txnErr } = await listSavingsTransactions(kidClient, kidId);
  expect(txnErr).toBeNull();
  const deposit = txns!.find(t => t.type === 'deposit');
  expect(deposit).toBeDefined();
  expect(deposit!.amount).toBe(DEPOSIT);
});

// --- Withdraw reverses the move ----------------------------------------------

test('kid transferToSavings withdraw moves savings -> wallet and writes a withdraw row', async () => {
  const { data: before } = await getKidWallet(kidClient, kidId);
  const walletStart = before!.wallet_balance;
  const savingsStart = before!.savings_balance;

  const { error } = await transferToSavings(kidClient, kidId, WITHDRAW, 'withdraw');
  expect(error).toBeNull();

  const { data: after } = await getKidWallet(kidClient, kidId);
  expect(after!.wallet_balance).toBe(walletStart + WITHDRAW);
  expect(after!.savings_balance).toBe(savingsStart - WITHDRAW);

  const { data: txns } = await listSavingsTransactions(kidClient, kidId);
  const withdraw = txns!.find(t => t.type === 'withdraw');
  expect(withdraw).toBeDefined();
  // newest first: the withdraw is the most recent entry.
  expect(txns![0]!.type).toBe('withdraw');
});

// --- Overdraft is rejected ---------------------------------------------------

test('depositing more than the wallet balance returns an error', async () => {
  const { data: before } = await getKidWallet(kidClient, kidId);
  const { error } = await transferToSavings(
    kidClient,
    kidId,
    before!.wallet_balance + 1,
    'deposit',
  );
  expect(error).not.toBeNull();

  // Balances unchanged after the failed transfer.
  const { data: after } = await getKidWallet(kidClient, kidId);
  expect(after!.wallet_balance).toBe(before!.wallet_balance);
});
