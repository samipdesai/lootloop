// Node-based runner for the family-roster tests, for environments without a
// standalone Deno (the edge-runtime image ships no `deno` CLI). Mirrors the
// kid-auth runner: seeds throwaway data via `docker exec ... psql`, drives the
// served function over HTTP, asserts, and cleans up.
//
// This runner is SELF-CONTAINED: it seeds + cleans up the fixtures itself.
//
// Prereqs:
//   supabase functions serve family-roster --no-verify-jwt   # in another shell
//   env (all optional, defaults shown):
//     FUNCTION_URL  http://127.0.0.1:54321/functions/v1/family-roster
//     ANON_KEY      (gateway Authorization bearer; not needed with --no-verify-jwt)
//     DB_CONTAINER  supabase_db_Lootloop
//
//   node supabase/functions/family-roster/run-tests.mjs

import { execFileSync } from "node:child_process";

const URL = process.env.FUNCTION_URL ??
  "http://127.0.0.1:54321/functions/v1/family-roster";
const ANON_KEY = process.env.ANON_KEY ?? "";
const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_Lootloop";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    failures++;
    console.log(`  FAIL- ${name} ${extra}`);
  }
}

// Run SQL in the local Postgres container, returning trimmed stdout.
// -t -A => tuples-only, unaligned; -q suppresses command tags (INSERT 0 1 etc.)
// so a `... returning id` yields ONLY the scalar value on stdout.
function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

async function call(body, method = "POST") {
  return fetch(URL, {
    method,
    headers: {
      "content-type": "application/json",
      ...(ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

// Unique marker so cleanup only removes THIS run's rows.
const TAG = `roster-test-${Date.now()}`;

function seed() {
  // Family A with 2 kids; Family B with 1 kid. The 005 trigger auto-fills
  // kid_code on insert; we read it back. Names chosen so display_name ordering
  // is observable (Bella before Zane within Family A).
  const famA = psql(
    `insert into families (name) values ('${TAG}-A') returning id;`,
  );
  const famB = psql(
    `insert into families (name) values ('${TAG}-B') returning id;`,
  );
  const codeA = psql(`select kid_code from families where id = '${famA}';`);
  const codeB = psql(`select kid_code from families where id = '${famB}';`);

  // Kids. pin_hash NOT NULL? create_kid normally hashes; here we insert directly
  // with a fixed bcrypt hash (roster never reads pin_hash, value is irrelevant).
  const DUMMY_HASH = "$2a$10$WrEQ7qDH14lb9vK.FP.EjOESMIIciE/qIG/6OxUs996pcRIg7vCaG";
  psql(
    `insert into profiles (family_id, role, display_name, pin_hash, age_mode, avatar_url) values
      ('${famA}', 'kid', 'Zane', '${DUMMY_HASH}', 'teen', 'https://x/z.png'),
      ('${famA}', 'kid', 'Bella', '${DUMMY_HASH}', 'simple', null),
      ('${famB}', 'kid', 'Other', '${DUMMY_HASH}', 'detailed', null);`,
  );

  return { famA, famB, codeA, codeB };
}

function cleanup() {
  // profiles cascade via family_id FK, but delete explicitly to be safe across
  // FK configs, then the families.
  psql(
    `delete from profiles where family_id in (select id from families where name like '${TAG}-%');`,
  );
  psql(`delete from families where name like '${TAG}-%';`);
}

async function main() {
  // Verify the DB container is reachable before seeding.
  try {
    psql("select 1;");
  } catch (e) {
    console.error(
      `Cannot reach Postgres in container '${DB_CONTAINER}'. Is the local stack up?\n${e.message}`,
    );
    process.exit(2);
  }

  let fx;
  try {
    fx = seed();
  } catch (e) {
    console.error(`Seed failed: ${e.message}`);
    process.exit(2);
  }

  try {
    console.log("valid code -> 200 with ONLY that family's kids, correct fields, ordered");
    {
      const res = await call({ code: fx.codeA });
      check("status 200", res.status === 200, `got ${res.status}`);
      const j = await res.json();
      check("family_id matches", j.family_id === fx.famA, `${j.family_id}`);
      check("family_name matches", j.family_name === `${TAG}-A`, `${j.family_name}`);
      check("exactly 2 kids (not family B's)", Array.isArray(j.kids) && j.kids.length === 2,
        `len ${j.kids?.length}`);
      const names = (j.kids ?? []).map((k) => k.display_name);
      check("ordered by display_name (Bella, Zane)",
        names[0] === "Bella" && names[1] === "Zane", JSON.stringify(names));
      const bella = (j.kids ?? []).find((k) => k.display_name === "Bella");
      const zane = (j.kids ?? []).find((k) => k.display_name === "Zane");
      check("kid fields present (profile_id, age_mode, avatar_url)",
        !!bella?.profile_id && bella?.age_mode === "simple" && bella?.avatar_url === null &&
          zane?.age_mode === "teen" && zane?.avatar_url === "https://x/z.png",
        JSON.stringify({ bella, zane }));
      const idsAreFamilyA = (j.kids ?? []).every((k) => typeof k.profile_id === "string");
      check("no family B leakage", idsAreFamilyA &&
        !names.includes("Other"), JSON.stringify(names));
    }

    console.log("lowercase code still matches (case-insensitive)");
    {
      const res = await call({ code: fx.codeA.toLowerCase() });
      check("status 200", res.status === 200, `got ${res.status}`);
      const j = await res.json();
      check("same family_id", j.family_id === fx.famA, `${j.family_id}`);
    }

    console.log("family B code -> only family B's single kid (isolation)");
    {
      const res = await call({ code: fx.codeB });
      const j = await res.json();
      check("1 kid named Other", res.status === 200 && j.kids?.length === 1 &&
        j.kids[0].display_name === "Other", JSON.stringify(j.kids));
    }

    console.log("unknown code -> generic 404");
    {
      // 'ZZZZZZZZ' is valid-alphabet but astronomically unlikely to be a live code.
      const res = await call({ code: "ZZZZZZZZ" });
      check("status 404", res.status === 404, `got ${res.status}`);
      const j = await res.json();
      check("error not_found", j.error === "not_found", JSON.stringify(j));
    }

    console.log("GET -> 405");
    {
      const res = await call(undefined, "GET");
      check("status 405", res.status === 405, `got ${res.status}`);
    }

    console.log("missing/empty code -> 400");
    for (const body of [{}, { code: "" }, { code: "   " }, { code: 123 }]) {
      const res = await call(body);
      check(`400 for ${JSON.stringify(body)}`, res.status === 400, `got ${res.status}`);
    }

    console.log("oversized code (>64 chars) -> 400");
    {
      const res = await call({ code: "A".repeat(65) });
      check("status 400", res.status === 400, `got ${res.status}`);
    }

    console.log("rate limit -> 429 once threshold exceeded from one client");
    {
      // The earlier requests already consumed part of the window from this IP.
      // Fire well past the limit (20/min) and assert at least one 429 appears.
      let saw429 = false;
      let last200or404 = 0;
      for (let i = 0; i < 40; i++) {
        const res = await call({ code: "ZZZZZZZZ" });
        if (res.status === 429) saw429 = true;
        else last200or404 = res.status;
        // drain body to free the connection
        await res.text();
      }
      check("eventually returns 429 under sustained load", saw429,
        `last non-429 status ${last200or404}`);
    }
  } finally {
    try {
      cleanup();
      console.log("\n(cleaned up seeded rows)");
    } catch (e) {
      console.error(`Cleanup failed (manual cleanup may be needed): ${e.message}`);
    }
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
