// Integration tests for the generate-recurring-chores Edge Function (task #14).
//
// These drive the function over HTTP and assert that the right chore_instances
// are materialized and that a second invocation for the same date is a no-op
// (idempotency). Seeding/teardown go through a direct privileged DB connection.
//
// Run:
//   1. supabase functions serve generate-recurring-chores     (separate shell)
//   2. set:
//        FUNCTION_URL        default http://127.0.0.1:54321/functions/v1/generate-recurring-chores
//        SERVICE_ROLE_KEY    the project service-role key (Authorization bearer)
//        ANON_KEY            a stack anon key (for the 401-rejection assertion)
//        SUPABASE_DB_URL     default postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   3. deno test --allow-net --allow-env supabase/functions/generate-recurring-chores/test.ts
//
// (In environments without a standalone Deno, run-tests.mjs performs the same
//  assertions via Node + `docker exec psql` and is what was used to verify.)

import { assert, assertEquals } from "jsr:@std/assert@1";
import postgres from "npm:postgres@3.4.4";

const FUNCTION_URL = Deno.env.get("FUNCTION_URL") ??
  "http://127.0.0.1:54321/functions/v1/generate-recurring-chores";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("ANON_KEY") ?? "";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// A known Wednesday (UTC): WEEKLY;BYDAY=WE matches, WEEKLY;BYDAY=MO does not.
const WED = "2026-06-17";
const MON = "2026-06-15";

const familyId = crypto.randomUUID();
const dailyId = crypto.randomUUID();
const weeklyWedId = crypto.randomUUID();
const weeklyMonId = crypto.randomUUID();
const oneOffId = crypto.randomUUID();

const sql = postgres(DB_URL, { max: 1, prepare: false });

async function invoke(
  body: unknown,
  { auth = SERVICE_ROLE_KEY, method = "POST" } = {},
): Promise<Response> {
  return await fetch(FUNCTION_URL, {
    method,
    headers: {
      "content-type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

Deno.test("generate-recurring-chores", async (t) => {
  // Seed a throwaway family + four chores.
  await sql`insert into families (id, name) values (${familyId}, 'T14 Test Family')`;
  await sql`
    insert into chores (id, family_id, title, points, assignment, recurrence_rule, active) values
      (${dailyId},     ${familyId}, 'Daily chore',      5, 'shared', 'FREQ=DAILY', true),
      (${weeklyWedId}, ${familyId}, 'Weekly Wed chore', 7, 'shared', 'FREQ=WEEKLY;BYDAY=WE', true),
      (${weeklyMonId}, ${familyId}, 'Weekly Mon chore', 9, 'shared', 'FREQ=WEEKLY;BYDAY=MO', true),
      (${oneOffId},    ${familyId}, 'One-off chore',    3, 'shared', null,         true)
  `;

  try {
    await t.step("non-service bearer -> 401", async () => {
      const noAuth = await invoke({ family_id: familyId, date: WED }, { auth: "" });
      assertEquals(noAuth.status, 401);
      if (ANON_KEY) {
        const anon = await invoke({ family_id: familyId, date: WED }, { auth: ANON_KEY });
        assertEquals(anon.status, 401);
      }
    });

    await t.step("GET -> 405", async () => {
      const res = await invoke(undefined, { method: "GET" });
      assertEquals(res.status, 405);
    });

    await t.step("malformed input -> 400", async () => {
      assertEquals((await invoke({ date: "06/17/2026" })).status, 400);
      assertEquals((await invoke({ family_id: "nope", date: WED })).status, 400);
    });

    await t.step("first run materializes DAILY + WEEKLY-Wed only", async () => {
      const res = await invoke({ family_id: familyId, date: WED });
      assertEquals(res.status, 200);
      const json = await res.json();
      assertEquals(json.date, WED);
      assertEquals(json.generated, 2);

      const rows = await sql<{ title: string; points: number }[]>`
        select c.title, ci.points
          from chore_instances ci join chores c on c.id = ci.chore_id
         where ci.family_id = ${familyId} and ci.due_date = ${WED}
         order by c.title
      `;
      const map = new Map(rows.map((r) => [r.title, r.points]));
      assertEquals(map.get("Daily chore"), 5);
      assertEquals(map.get("Weekly Wed chore"), 7);
      assert(!map.has("Weekly Mon chore"));
      assert(!map.has("One-off chore"));
    });

    await t.step("second run for same date generates 0 (idempotent)", async () => {
      const res = await invoke({ family_id: familyId, date: WED });
      assertEquals(res.status, 200);
      assertEquals((await res.json()).generated, 0);
      const [{ count }] = await sql<{ count: string }[]>`
        select count(*)::text as count from chore_instances
         where family_id = ${familyId} and due_date = ${WED}
      `;
      assertEquals(count, "2");
    });

    await t.step("a Monday materializes DAILY + WEEKLY-Mon", async () => {
      const res = await invoke({ family_id: familyId, date: MON });
      assertEquals((await res.json()).generated, 2);
      const titles = await sql<{ title: string }[]>`
        select c.title from chore_instances ci join chores c on c.id = ci.chore_id
         where ci.family_id = ${familyId} and ci.due_date = ${MON} order by c.title
      `;
      assertEquals(titles.map((r) => r.title), ["Daily chore", "Weekly Mon chore"]);
    });
  } finally {
    await sql`delete from families where id = ${familyId}`;
    await sql.end({ timeout: 5 });
  }
});
