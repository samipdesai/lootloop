// Node-based runner for the generate-recurring-chores tests (task #14), for
// environments without a standalone Deno (the edge-runtime image ships no
// `deno` CLI). Mirrors the assertions in test.ts.
//
// It is SELF-CONTAINED: it seeds a throwaway family + chores directly into the
// local Postgres (via `docker exec <db container> psql`), invokes the served
// function over HTTP with the SERVICE-ROLE key, and asserts the materialized
// chore_instances — including that a second invocation for the same date
// generates 0 (idempotency).
//
// Prereqs:
//   supabase functions serve generate-recurring-chores     # in another shell
//   env (defaults shown):
//     FUNCTION_URL   http://127.0.0.1:54321/functions/v1/generate-recurring-chores
//     SERVICE_ROLE_KEY   <from `supabase status`>  (required)
//     ANON_KEY           <from `supabase status`>  (optional, for the 401 test)
//     DB_CONTAINER       supabase_db_Lootloop
//
//   node supabase/functions/generate-recurring-chores/run-tests.mjs

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const FUNCTION_URL = process.env.FUNCTION_URL ??
  "http://127.0.0.1:54321/functions/v1/generate-recurring-chores";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.ANON_KEY ?? "";
const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_Lootloop";

// A known WEDNESDAY (2026-06-17, UTC) so the WEEKLY;BYDAY=WE chore matches and a
// WEEKLY;BYDAY=MO chore does NOT.
const TEST_DATE = "2026-06-17";

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

async function invoke(body, { auth = SERVICE_ROLE_KEY, method = "POST" } = {}) {
  return fetch(FUNCTION_URL, {
    method,
    headers: {
      "content-type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error("Set SERVICE_ROLE_KEY (see `supabase status`).");
    process.exit(2);
  }

  // ---- Seed a throwaway family + four chores ------------------------------
  const familyId = randomUUID();
  const dailyId = randomUUID();
  const weeklyWedId = randomUUID();
  const weeklyMonId = randomUUID();
  const oneOffId = randomUUID();

  db(`
    insert into families (id, name) values ('${familyId}', 'T14 Test Family');
    insert into chores (id, family_id, title, points, assignment, recurrence_rule, active) values
      ('${dailyId}',     '${familyId}', 'Daily chore',      5, 'shared', 'FREQ=DAILY', true),
      ('${weeklyWedId}', '${familyId}', 'Weekly Wed chore', 7, 'shared', 'FREQ=WEEKLY;BYDAY=WE', true),
      ('${weeklyMonId}', '${familyId}', 'Weekly Mon chore', 9, 'shared', 'FREQ=WEEKLY;BYDAY=MO', true),
      ('${oneOffId}',    '${familyId}', 'One-off chore',    3, 'shared', null,         true);
  `);

  try {
    // ---- auth: missing/anon bearer -> 401 ---------------------------------
    console.log("auth: non-service bearer -> 401");
    {
      const noAuth = await invoke({ family_id: familyId, date: TEST_DATE }, { auth: "" });
      check("no Authorization -> 401", noAuth.status === 401, `got ${noAuth.status}`);
      if (ANON_KEY) {
        const anon = await invoke({ family_id: familyId, date: TEST_DATE }, { auth: ANON_KEY });
        check("anon key -> 401", anon.status === 401, `got ${anon.status}`);
      }
    }

    // ---- method: GET -> 405 -----------------------------------------------
    console.log("method: GET -> 405");
    {
      const res = await invoke(undefined, { method: "GET" });
      check("GET -> 405", res.status === 405, `got ${res.status}`);
    }

    // ---- malformed input -> 400 -------------------------------------------
    console.log("malformed input -> 400");
    {
      const badDate = await invoke({ date: "06/17/2026" });
      check("bad date format -> 400", badDate.status === 400, `got ${badDate.status}`);
      const badFamily = await invoke({ family_id: "not-a-uuid", date: TEST_DATE });
      check("bad family_id -> 400", badFamily.status === 400, `got ${badFamily.status}`);
    }

    // ---- first generation for a known Wednesday ---------------------------
    console.log("first generation -> DAILY + WEEKLY;BYDAY=WE materialize");
    let firstCount;
    {
      const res = await invoke({ family_id: familyId, date: TEST_DATE });
      check("status 200", res.status === 200, `got ${res.status}`);
      const json = await res.json();
      firstCount = json.generated;
      check("date echoed", json.date === TEST_DATE, JSON.stringify(json));
      // DAILY + WEEKLY-Wed = 2 ; WEEKLY-Mon and one-off must NOT generate.
      check("generated == 2", json.generated === 2, `generated=${json.generated}`);
    }

    // Inspect the DB directly.
    {
      const rows = db(`
        select c.title || '|' || ci.points
          from chore_instances ci join chores c on c.id = ci.chore_id
         where ci.family_id = '${familyId}' and ci.due_date = '${TEST_DATE}'
         order by c.title;
      `);
      const set = new Set(rows.split("\n").filter(Boolean));
      check("DAILY instance present w/ points snapshot 5", set.has("Daily chore|5"),
        [...set].join(", "));
      check("WEEKLY-Wed instance present w/ points snapshot 7",
        set.has("Weekly Wed chore|7"), [...set].join(", "));
      check("WEEKLY-Mon instance ABSENT (wrong weekday)",
        !set.has("Weekly Mon chore|9"), [...set].join(", "));
      check("one-off instance ABSENT (no recurrence rule)",
        ![...set].some((s) => s.startsWith("One-off")), [...set].join(", "));
    }

    // ---- idempotency: re-run same date inserts nothing --------------------
    console.log("idempotency -> second run for same date generates 0");
    {
      const res = await invoke({ family_id: familyId, date: TEST_DATE });
      const json = await res.json();
      check("status 200", res.status === 200, `got ${res.status}`);
      check("generated == 0 on re-run", json.generated === 0, `generated=${json.generated}`);

      const total = db(`
        select count(*) from chore_instances
         where family_id = '${familyId}' and due_date = '${TEST_DATE}';
      `);
      check("still exactly 2 rows after re-run", total === "2", `count=${total}`);
    }

    // ---- different date: WEEKLY-Mon now generates --------------------------
    console.log("different date (a Monday) -> DAILY + WEEKLY;BYDAY=MO materialize");
    {
      const MON = "2026-06-15"; // Monday (UTC)
      const res = await invoke({ family_id: familyId, date: MON });
      const json = await res.json();
      check("status 200", res.status === 200, `got ${res.status}`);
      check("generated == 2 (Daily + Mon)", json.generated === 2, `generated=${json.generated}`);
      const titles = db(`
        select c.title from chore_instances ci join chores c on c.id = ci.chore_id
         where ci.family_id = '${familyId}' and ci.due_date = '${MON}' order by c.title;
      `).split("\n").filter(Boolean);
      check("Monday set = [Daily, Weekly Mon]",
        titles.join(",") === "Daily chore,Weekly Mon chore", titles.join(","));
    }
  } finally {
    // Clean up the throwaway family (cascades to chores + instances).
    db(`delete from families where id = '${familyId}';`);
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
