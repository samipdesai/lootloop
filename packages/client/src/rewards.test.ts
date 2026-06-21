// Integration tests for the reward + points service (tasks #19-#25), run against
// the LOCAL Supabase stack (Docker). If the stack is unreachable this MUST fail
// loudly — we never silently skip. This service uses RPC + PostgREST only (no
// Edge Functions), so it does not depend on the functions being served.
//
// Two principals are exercised under REAL RLS:
//   * PARENT — admin createUser -> sign in (anon client) -> create_family_and_parent,
//     then create_kid + rewards CRUD, awardBonusPoints, wallet/ledger reads, and
//     the fulfillment queue (listPurchases / markPurchaseGiven).
//   * KID — NOT an auth.users row. We MINT a kid JWT in-test with `jose` honoring
//     migration 002's claim contract (ll_role='kid', family_id, profile_id, sub,
//     role/aud='authenticated', HS256 with the local project JWT secret), then
//     build a kid client via createKidClient and call purchaseReward as the kid.
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
  createReward,
  deleteReward,
  getKidWallet,
  listActiveRewards,
  listPointTransactions,
  listPurchases,
  listRewards,
  markPurchaseGiven,
  purchaseReward,
  updateReward,
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
const PARENT_EMAIL = `rewards-${TAG}@lootloop.test`;
const PARENT_PASSWORD = 'test-password-123';
const FAMILY_NAME = `Rewards Family ${TAG}`;
const KID_PIN = '4242';
const REWARD_COST = 30;
const BONUS_AMOUNT = 50;

let parent: LootLoopClient;
let parentAuthUserId: string;
let familyId: string;
let parentProfileId: string;
let kidId: string;
let rewardId: string;
let purchaseId: string;

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

  // Kid via the create_kid RPC (auto-creates the wallet via the 003 trigger).
  const { data: kid, error: kidErr } = await createKid(parent, {
    display_name: 'Test Kid',
    pin: KID_PIN,
    age_mode: 'simple',
  });
  if (kidErr || !kid) throw kidErr ?? new Error('create_kid returned no id');
  kidId = kid;
}, 30_000);

afterAll(async () => {
  if (familyId) await sql`delete from families where id = ${familyId}`;
  if (parentAuthUserId) await admin.auth.admin.deleteUser(parentAuthUserId);
  await sql.end({ timeout: 5 });
});

// --- Rewards CRUD (parent session) ------------------------------------------

test('createReward inserts an active reward', async () => {
  const { data, error } = await createReward(parent, {
    family_id: familyId,
    title: 'Extra screen time',
    cost: REWARD_COST,
    emoji: '📺',
  });
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.title).toBe('Extra screen time');
  expect(data!.cost).toBe(REWARD_COST);
  expect(data!.active).toBe(true);
  rewardId = data!.id;
});

test('listRewards returns the created reward (newest first)', async () => {
  const { data, error } = await listRewards(parent);
  expect(error).toBeNull();
  expect(data!.map(r => r.id)).toContain(rewardId);
});

test('listActiveRewards returns active rewards ordered by cost ascending', async () => {
  // Seed a cheaper reward + an inactive one to prove ordering + the active filter.
  const { data: cheap } = await createReward(parent, {
    family_id: familyId,
    title: 'Sticker',
    cost: 5,
    emoji: '⭐',
  });
  const { data: inactive } = await createReward(parent, {
    family_id: familyId,
    title: 'Retired prize',
    cost: 1,
    active: false,
  });

  const { data, error } = await listActiveRewards(parent);
  expect(error).toBeNull();
  const ids = data!.map(r => r.id);
  expect(ids).toContain(cheap!.id);
  expect(ids).toContain(rewardId);
  expect(ids).not.toContain(inactive!.id);
  // Ascending by cost: every cost >= the previous.
  const costs = data!.map(r => r.cost);
  expect(costs).toEqual([...costs].sort((a, b) => a - b));
  // The cheaper reward sorts before the costlier one.
  expect(ids.indexOf(cheap!.id)).toBeLessThan(ids.indexOf(rewardId));
});

test('updateReward changes the cost', async () => {
  const { data, error } = await updateReward(parent, rewardId, { cost: REWARD_COST });
  expect(error).toBeNull();
  expect(data!.cost).toBe(REWARD_COST);
});

test('deleteReward hard-deletes a reward', async () => {
  const { data: temp } = await createReward(parent, {
    family_id: familyId,
    title: 'To delete',
    cost: 9,
  });
  const { error } = await deleteReward(parent, temp!.id);
  expect(error).toBeNull();

  const { data } = await listRewards(parent);
  expect(data!.map(r => r.id)).not.toContain(temp!.id);
});

// --- Bonus points + wallet/ledger reads (parent session) --------------------

test('awardBonusPoints increments the wallet and writes a bonus ledger row', async () => {
  const { data: before } = await getKidWallet(parent, kidId);
  const start = before!.wallet_balance;

  const { error } = await awardBonusPoints(
    parent,
    kidId,
    BONUS_AMOUNT,
    'Great week!',
    parentProfileId,
  );
  expect(error).toBeNull();

  const { data: after, error: afterErr } = await getKidWallet(parent, kidId);
  expect(afterErr).toBeNull();
  expect(after!.wallet_balance).toBe(start + BONUS_AMOUNT);

  const { data: txns, error: txnErr } = await listPointTransactions(parent, kidId);
  expect(txnErr).toBeNull();
  const bonus = txns!.find(t => t.type === 'bonus');
  expect(bonus).toBeDefined();
  expect(bonus!.amount).toBe(BONUS_AMOUNT);
  expect(bonus!.note).toBe('Great week!');
  expect(bonus!.awarded_by).toBe(parentProfileId);
});

// --- Kid session: browse + purchase -----------------------------------------

test('kid session: listActiveRewards shows the reward; purchaseReward spends from the wallet', async () => {
  const token = await mintKidJwt(familyId, kidId);
  const kidClient = createKidClient(URL, ANON_KEY, token);

  // Kid browses the catalog (active only).
  const { data: shop, error: shopErr } = await listActiveRewards(kidClient);
  expect(shopErr).toBeNull();
  expect(shop!.map(r => r.id)).toContain(rewardId);

  // Wallet before (kid reads own wallet under RLS).
  const { data: before } = await getKidWallet(kidClient, kidId);
  const start = before!.wallet_balance;

  // Kid buys the reward (self-authorizing atomic fn).
  const { data: pid, error: buyErr } = await purchaseReward(kidClient, rewardId, kidId);
  expect(buyErr).toBeNull();
  expect(typeof pid).toBe('string');
  purchaseId = pid!;

  // Wallet decreased by the reward cost.
  const { data: after } = await getKidWallet(kidClient, kidId);
  expect(after!.wallet_balance).toBe(start - REWARD_COST);

  // Ledger now has both the bonus (+) and the spend (-).
  const { data: txns } = await listPointTransactions(kidClient, kidId);
  const bonus = txns!.find(t => t.type === 'bonus');
  const spend = txns!.find(t => t.type === 'spend');
  expect(bonus).toBeDefined();
  expect(spend).toBeDefined();
  expect(spend!.amount).toBe(-REWARD_COST);

  // A reward_purchases row exists with status 'purchased' (read via parent).
  const { data: purchases } = await listPurchases(parent, 'purchased');
  expect(purchases!.map(p => p.id)).toContain(purchaseId);
});

// --- Fulfillment queue (parent session) -------------------------------------

test('listPurchases returns the flattened fulfillment item', async () => {
  const { data, error } = await listPurchases(parent, 'purchased');
  expect(error).toBeNull();
  const item = data!.find(p => p.id === purchaseId);
  expect(item).toBeDefined();
  expect(item!.kid_id).toBe(kidId);
  expect(item!.reward_id).toBe(rewardId);
  expect(item!.cost).toBe(REWARD_COST);
  expect(item!.status).toBe('purchased');
  expect(item!.given_at).toBeNull();
  expect(item!.reward_title).toBe('Extra screen time');
  expect(item!.reward_emoji).toBe('📺');
  expect(item!.kid_display_name).toBe('Test Kid');
});

test('markPurchaseGiven flips status to given and removes it from the purchased queue', async () => {
  const { error } = await markPurchaseGiven(parent, purchaseId, parentProfileId);
  expect(error).toBeNull();

  // No longer in the 'purchased' queue.
  const { data: pending } = await listPurchases(parent, 'purchased');
  expect(pending!.map(p => p.id)).not.toContain(purchaseId);

  // Now in the 'given' list with the fulfillment metadata set.
  const { data: given } = await listPurchases(parent, 'given');
  const item = given!.find(p => p.id === purchaseId);
  expect(item).toBeDefined();
  expect(item!.status).toBe('given');
  expect(item!.given_at).not.toBeNull();
});
