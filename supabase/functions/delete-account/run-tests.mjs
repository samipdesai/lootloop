// Node-based runner for the delete-account Edge Function tests (task #52).
// Dependency-free (mirrors calculate-interest/run-tests.mjs): seeds throwaway
// data via `docker exec <db> psql`, creates real GoTrue parent users + signs
// them in over HTTP (so the function authorizes off a real parent token), and
// drives the served function over HTTP.
//
// It asserts the full contract:
//   * leave  -> 200; the leaving parent's profile AND auth.users row are gone,
//               the family + co-parent + kid remain.
//   * leave by the LAST parent -> 403 last_parent; nothing changes.
//   * a NON-PARENT bearer (anon key) -> 401 (the SQL fn rejects it).
//   * delete_family -> 200; the whole family (profiles, kid, wallet) + every
//                      parent auth.users row are gone, while a second unrelated
//                      family is fully intact (cross-family isolation).
//   * GET -> 405; missing bearer -> 401; bad action -> 400.
//
// Prereqs:
//   supabase functions serve delete-account     # in another shell
//   env (defaults shown):
//     FUNCTION_URL       http://127.0.0.1:54321/functions/v1/delete-account
//     AUTH_URL           http://127.0.0.1:54321/auth/v1
//     SERVICE_ROLE_KEY   <from `supabase status`>  (required: GoTrue admin)
//     ANON_KEY           <from `supabase status`>  (required: gateway + non-parent test)
//     DB_CONTAINER       supabase_db_Lootloop
//
//   node supabase/functions/delete-account/run-tests.mjs

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const FUNCTION_URL = process.env.FUNCTION_URL ??
  "http://127.0.0.1:54321/functions/v1/delete-account";
const AUTH_URL = process.env.AUTH_URL ?? "http://127.0.0.1:54321/auth/v1";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.ANON_KEY ?? "";
const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_Lootloop";

const PASSWORD = "test-password-123";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    failures++;
    console.log(`  FAIL- ${name} ${extra}`);
  }
}

// Run SQL inside the local DB container, returning trimmed stdout.
function db(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
     "-tA", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

// Create a confirmed GoTrue auth user (admin API) -> returns its id.
async function createAuthUser(email) {
  const res = await fetch(`${AUTH_URL}/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`createUser ${email} -> ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

// Password grant -> returns the user's access_token.
async function signIn(email) {
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`signIn ${email} -> ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function invoke(body, { token, method = "POST", omitAuth = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (!omitAuth) headers.Authorization = `Bearer ${token ?? ANON_KEY}`;
  return fetch(FUNCTION_URL, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  if (!SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error("Set SERVICE_ROLE_KEY and ANON_KEY (see `supabase status`).");
    process.exit(2);
  }

  const tag = `${process.pid}-${Date.now()}`;
  // Family A: two parents (a1, a2) + a kid. Family B: one parent (b1) + a kid.
  const famA = randomUUID();
  const famB = randomUUID();
  const kidA = randomUUID();
  const kidB = randomUUID();
  const profA1 = randomUUID();
  const profA2 = randomUUID();
  const profB1 = randomUUID();

  const emailA1 = `del-a1-${tag}@lootloop.test`;
  const emailA2 = `del-a2-${tag}@lootloop.test`;
  const emailB1 = `del-b1-${tag}@lootloop.test`;

  const authA1 = await createAuthUser(emailA1);
  const authA2 = await createAuthUser(emailA2);
  const authB1 = await createAuthUser(emailB1);

  // Seed profiles/families. Parents link to their real auth.users rows.
  db(`
    insert into families (id, name) values ('${famA}', 'Del Family A ${tag}'), ('${famB}', 'Del Family B ${tag}');
    insert into profiles (id, family_id, role, display_name, auth_user_id) values
      ('${profA1}', '${famA}', 'parent', 'A1', '${authA1}'),
      ('${profA2}', '${famA}', 'parent', 'A2', '${authA2}'),
      ('${profB1}', '${famB}', 'parent', 'B1', '${authB1}');
    insert into profiles (id, family_id, role, display_name, pin_hash, age_mode) values
      ('${kidA}', '${famA}', 'kid', 'Kid A', 'x', 'detailed'),
      ('${kidB}', '${famB}', 'kid', 'Kid B', 'x', 'detailed');
  `);

  const userExists = (id) =>
    db(`select count(*) from auth.users where id = '${id}';`) === "1";
  const profileExists = (id) =>
    db(`select count(*) from profiles where id = '${id}';`) === "1";

  try {
    // ---- method / auth / validation guards --------------------------------
    console.log("guards: method / bearer / action");
    {
      const get = await invoke(undefined, { method: "GET" });
      check("GET -> 405", get.status === 405, `got ${get.status}`);

      const noAuth = await invoke({ action: "leave" }, { omitAuth: true });
      check("missing bearer -> 401", noAuth.status === 401, `got ${noAuth.status}`);

      const tokenA1 = await signIn(emailA1);
      const badAction = await invoke({ action: "nope" }, { token: tokenA1 });
      check("bad action -> 400", badAction.status === 400, `got ${badAction.status}`);
    }

    // ---- non-parent (anon) bearer is rejected by the SQL fn ---------------
    console.log("authz: non-parent bearer -> 401");
    {
      // anon key as bearer: gateway accepts it, but auth_role() is null -> the
      // SQL fn raises insufficient_privilege -> the function maps it to 401.
      const res = await invoke({ action: "leave" }, { token: ANON_KEY });
      check("anon bearer leave -> 401", res.status === 401, `got ${res.status}`);
      const res2 = await invoke({ action: "delete_family" }, { token: ANON_KEY });
      check("anon bearer delete_family -> 401", res2.status === 401, `got ${res2.status}`);
      check("family A still intact after anon attempts",
        db(`select count(*) from profiles where family_id = '${famA}';`) === "3");
    }

    // ---- leave: co-parent A1 leaves --------------------------------------
    console.log("leave: co-parent removes themselves");
    {
      const tokenA1 = await signIn(emailA1);
      const res = await invoke({ action: "leave" }, { token: tokenA1 });
      check("status 200", res.status === 200, `got ${res.status}`);
      const j = await res.json().catch(() => ({}));
      check("ok:true action:leave deleted_users:1",
        j.ok === true && j.action === "leave" && j.deleted_users === 1,
        JSON.stringify(j));

      check("A1 profile deleted", !profileExists(profA1));
      check("A1 auth.users row deleted", !userExists(authA1));
      check("co-parent A2 profile remains", profileExists(profA2));
      check("A2 auth.users row remains", userExists(authA2));
      check("kid A remains", profileExists(kidA));
      check("family A still exists",
        db(`select count(*) from families where id = '${famA}';`) === "1");
    }

    // ---- leave: the LAST parent (A2) cannot leave -> 403 ------------------
    console.log("leave: last parent -> 403 last_parent");
    {
      const tokenA2 = await signIn(emailA2);
      const res = await invoke({ action: "leave" }, { token: tokenA2 });
      check("status 403", res.status === 403, `got ${res.status}`);
      const j = await res.json().catch(() => ({}));
      check("error == last_parent", j.error === "last_parent", JSON.stringify(j));
      check("A2 profile NOT deleted", profileExists(profA2));
      check("A2 auth.users row NOT deleted", userExists(authA2));
    }

    // ---- delete_family: A2 deletes the whole family ----------------------
    console.log("delete_family: wipes own family, other family intact");
    {
      const tokenA2 = await signIn(emailA2);
      const res = await invoke({ action: "delete_family" }, { token: tokenA2 });
      check("status 200", res.status === 200, `got ${res.status}`);
      const j = await res.json().catch(() => ({}));
      // Only A2 remains as a parent in family A by now -> 1 auth user deleted.
      check("ok:true action:delete_family deleted_users:1",
        j.ok === true && j.action === "delete_family" && j.deleted_users === 1,
        JSON.stringify(j));

      check("family A row gone",
        db(`select count(*) from families where id = '${famA}';`) === "0");
      check("family A profiles gone (cascade)",
        db(`select count(*) from profiles where family_id = '${famA}';`) === "0");
      check("family A wallets gone (cascade)",
        db(`select count(*) from wallets where family_id = '${famA}';`) === "0");
      check("A2 auth.users row gone", !userExists(authA2));

      // Cross-family isolation: family B fully intact.
      check("family B row intact",
        db(`select count(*) from families where id = '${famB}';`) === "1");
      check("family B profiles intact (parent + kid)",
        db(`select count(*) from profiles where family_id = '${famB}';`) === "2");
      check("family B parent auth.users row intact", userExists(authB1));
    }
  } finally {
    // Clean up: whatever survived (e.g. family B, any auth users).
    db(`delete from families where id in ('${famA}', '${famB}');`);
    for (const id of [authA1, authA2, authB1]) {
      await fetch(`${AUTH_URL}/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      }).catch(() => {});
    }
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
