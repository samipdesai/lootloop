// Integration tests for the schedule service (tasks #36-#37), run against the
// LOCAL Supabase stack (Docker). If the stack is unreachable this MUST fail
// loudly — we never silently skip. PostgREST only (no Edge Functions).
//
// Two principals are exercised under REAL RLS:
//   * PARENT — admin createUser -> sign in (anon client) -> create_family_and_parent,
//     then create_kid + schedule CRUD (parent-only insert/update/delete per 002).
//   * KID — NOT an auth.users row. We MINT a kid JWT in-test with `jose` honoring
//     migration 002's claim contract (ll_role='kid', family_id, profile_id, sub,
//     role/aud='authenticated', HS256 with the local project JWT secret), then
//     build a kid client via createKidClient and read the family's items
//     (whole-family SELECT) for the timeline.
//
// Teardown uses a DIRECT postgres superuser connection (the codebase idiom).
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import type { Database } from '@lootloop/types';
import {
  createKid,
  createKidClient,
  createScheduleItem,
  deleteScheduleItem,
  listKidScheduleItems,
  listScheduleItems,
  updateScheduleItem,
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
const PARENT_EMAIL = `schedule-${TAG}@lootloop.test`;
const PARENT_PASSWORD = 'test-password-123';
const FAMILY_NAME = `Schedule Family ${TAG}`;
const KID_PIN = '4242';
const WEEKDAYS = [1, 2, 3, 4, 5];

let parent: LootLoopClient;
let parentAuthUserId: string;
let familyId: string;
let kidId: string;
let brushId: string;
let homeworkId: string;

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

// --- Schedule CRUD (parent session) -----------------------------------------

test('createScheduleItem inserts an active schedule item', async () => {
  const { data, error } = await createScheduleItem(parent, {
    family_id: familyId,
    kid_id: kidId,
    title: 'Brush teeth',
    icon: '🪥',
    start_time: '08:00',
    days_of_week: WEEKDAYS,
  });
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.title).toBe('Brush teeth');
  expect(data!.kid_id).toBe(kidId);
  expect(data!.active).toBe(true);
  expect(data!.start_time).toBe('08:00:00');
  expect(data!.days_of_week).toEqual(WEEKDAYS);
  brushId = data!.id;
});

test('listScheduleItems / listKidScheduleItems return items ordered by start_time', async () => {
  // Seed a later item to prove start_time ordering.
  const { data: hw, error: hwErr } = await createScheduleItem(parent, {
    family_id: familyId,
    kid_id: kidId,
    title: 'Homework',
    start_time: '16:30',
    end_time: '17:30',
    days_of_week: WEEKDAYS,
  });
  expect(hwErr).toBeNull();
  homeworkId = hw!.id;

  const { data: all, error: allErr } = await listScheduleItems(parent);
  expect(allErr).toBeNull();
  const allIds = all!.map(s => s.id);
  expect(allIds).toContain(brushId);
  expect(allIds).toContain(homeworkId);

  const { data: kidItems, error: kidErr } = await listKidScheduleItems(parent, kidId);
  expect(kidErr).toBeNull();
  const ids = kidItems!.map(s => s.id);
  expect(ids).toContain(brushId);
  expect(ids).toContain(homeworkId);
  // Ascending by start_time: the morning item sorts before the afternoon one.
  const times = kidItems!.map(s => s.start_time);
  expect(times).toEqual([...times].sort());
  expect(ids.indexOf(brushId)).toBeLessThan(ids.indexOf(homeworkId));
});

test('updateScheduleItem changes the title and start_time', async () => {
  const { data, error } = await updateScheduleItem(parent, brushId, {
    title: 'Brush teeth + floss',
    start_time: '08:15',
  });
  expect(error).toBeNull();
  expect(data!.title).toBe('Brush teeth + floss');
  expect(data!.start_time).toBe('08:15:00');
});

// --- Kid timeline (kid session, whole-family SELECT) -------------------------

test('kid session: listKidScheduleItems reads the family schedule', async () => {
  const token = await mintKidJwt(familyId, kidId);
  const kidClient = createKidClient(URL, ANON_KEY, token);

  const { data, error } = await listKidScheduleItems(kidClient, kidId);
  expect(error).toBeNull();
  const ids = data!.map(s => s.id);
  expect(ids).toContain(brushId);
  expect(ids).toContain(homeworkId);
  // Still earliest-first under the kid's RLS session.
  const times = data!.map(s => s.start_time);
  expect(times).toEqual([...times].sort());
});

// --- Delete (parent session) ------------------------------------------------

test('deleteScheduleItem hard-deletes an item', async () => {
  const { error } = await deleteScheduleItem(parent, homeworkId);
  expect(error).toBeNull();

  const { data } = await listScheduleItems(parent);
  expect(data!.map(s => s.id)).not.toContain(homeworkId);
});
