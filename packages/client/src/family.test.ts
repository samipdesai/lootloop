// Integration tests for co-parent management (family.ts + the 004 invite RPCs),
// run against the LOCAL Supabase stack (Docker). If the stack is unreachable this
// MUST fail loudly — we never silently skip.
//
// Three principals under REAL RLS:
//   * PARENT A — owns family A; mints/lists/revokes invites, sees the roster.
//   * PARENT B — owns a DIFFERENT family B; proves cross-family isolation
//     (cannot see or revoke A's invites).
//   * JOINER C — a confirmed auth user with NO profile who redeems A's invite via
//     join_family_as_parent and becomes A's co-parent.
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import type { Database } from '@lootloop/types';
import {
  createFamilyInvite,
  joinFamilyAsParent,
  listParents,
  listPendingInvites,
  revokeInvite,
  type LootLoopClient,
} from './index';

const URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const PASSWORD = 'test-password-123';

const admin = createClient<Database>(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DB_URL, { max: 1, prepare: false });

const TAG = `${process.pid}-${Date.now()}`;

let familyA: string;
let familyB: string;
const authUserIds: string[] = [];
let parentA: LootLoopClient;
let parentB: LootLoopClient;
let joinerC: LootLoopClient;

// Create a confirmed auth user + a signed-in anon client for them.
async function makeUser(email: string): Promise<LootLoopClient> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error('createUser returned no user');
  authUserIds.push(created.user.id);

  const client = createClient<Database>(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
  return client;
}

beforeAll(async () => {
  const health = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } });
  if (!health.ok) {
    throw new Error(
      `Local Supabase unreachable at ${URL} (HTTP ${health.status}). Run \`supabase start\`.`,
    );
  }

  parentA = await makeUser(`coparent-a-${TAG}@lootloop.test`);
  parentB = await makeUser(`coparent-b-${TAG}@lootloop.test`);
  joinerC = await makeUser(`coparent-c-${TAG}@lootloop.test`);

  const { data: a, error: aErr } = await parentA.rpc('create_family_and_parent', {
    p_family_name: `Co-Parent Family A ${TAG}`,
    p_display_name: 'Parent A',
  });
  if (aErr || !a) throw aErr ?? new Error('family A bootstrap failed');
  familyA = a;

  const { data: b, error: bErr } = await parentB.rpc('create_family_and_parent', {
    p_family_name: `Co-Parent Family B ${TAG}`,
    p_display_name: 'Parent B',
  });
  if (bErr || !b) throw bErr ?? new Error('family B bootstrap failed');
  familyB = b;
}, 30_000);

afterAll(async () => {
  if (familyA) await sql`delete from families where id = ${familyA}`;
  if (familyB) await sql`delete from families where id = ${familyB}`;
  for (const id of authUserIds) await admin.auth.admin.deleteUser(id);
  await sql.end({ timeout: 5 });
});

test('listParents returns the single founding parent before anyone joins', async () => {
  const { data, error } = await listParents(parentA);
  expect(error).toBeNull();
  expect(data!.length).toBe(1);
  expect(data![0]!.display_name).toBe('Parent A');
});

test('createFamilyInvite mints a code that shows up in listPendingInvites', async () => {
  const { data: code, error } = await createFamilyInvite(parentA);
  expect(error).toBeNull();
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);

  const { data: pending, error: pErr } = await listPendingInvites(parentA);
  expect(pErr).toBeNull();
  expect(pending!.map(i => i.code)).toContain(code);
});

test('a parent in another family cannot see or revoke the invite (RLS isolation)', async () => {
  const { data: code } = await createFamilyInvite(parentA);
  const { data: aPending } = await listPendingInvites(parentA);
  const invite = aPending!.find(i => i.code === code)!;

  // Parent B sees none of family A's invites.
  const { data: bPending } = await listPendingInvites(parentB);
  expect(bPending!.map(i => i.code)).not.toContain(code);

  // Parent B's revoke deletes nothing (DELETE policy is scoped to their family).
  await revokeInvite(parentB, invite.id);
  const [row] = await sql<
    { n: number }[]
  >`select count(*)::int as n from family_invites where id = ${invite.id}`;
  expect(row!.n).toBe(1);
});

test('a new user joins family A as a co-parent; the roster grows and the invite is consumed', async () => {
  const { data: code } = await createFamilyInvite(parentA);

  const { data: joinedFamily, error: joinErr } = await joinFamilyAsParent(
    joinerC,
    code!,
    'Parent C',
  );
  expect(joinErr).toBeNull();
  expect(joinedFamily).toBe(familyA);

  // Both parents now appear in the roster, scoped to family A.
  const { data: roster } = await listParents(parentA);
  const names = roster!.map(p => p.display_name).sort();
  expect(names).toContain('Parent A');
  expect(names).toContain('Parent C');

  // The redeemed invite is single-use → no longer pending.
  const { data: pending } = await listPendingInvites(parentA);
  expect(pending!.map(i => i.code)).not.toContain(code);

  // The redeemed code cannot be reused.
  const { error: reuseErr } = await joinFamilyAsParent(joinerC, code!, 'Parent C again');
  expect(reuseErr).not.toBeNull();
});

test('revokeInvite removes a pending invite for the owning parent', async () => {
  const { data: code } = await createFamilyInvite(parentA);
  const { data: before } = await listPendingInvites(parentA);
  const invite = before!.find(i => i.code === code)!;

  const { error } = await revokeInvite(parentA, invite.id);
  expect(error).toBeNull();

  const { data: after } = await listPendingInvites(parentA);
  expect(after!.map(i => i.code)).not.toContain(code);
});
