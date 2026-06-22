// Node-based runner for the calculate-interest tests (task #34), for
// environments without a standalone Deno (the edge-runtime image ships no
// `deno` CLI). Mirrors generate-recurring-chores/run-tests.mjs.
//
// It is SELF-CONTAINED: it seeds a throwaway family + two kids (with wallets)
// directly into the local Postgres (via `docker exec <db container> psql`),
// invokes the served function over HTTP with the SERVICE-ROLE key, and asserts:
//   * the eligible kid's savings_balance increased by exactly the domain-
//     computed interest (Math.round(balance * 0.05)),
//   * an 'interest' savings_transactions row was written for that kid,
//   * the tiny-balance kid (interest rounds to 0) was SKIPPED,
//   * credited / total in the response are correct,
//   * a non-service-role bearer -> 401, GET -> 405.
//
// Prereqs:
//   supabase functions serve calculate-interest     # in another shell
//   env (defaults shown):
//     FUNCTION_URL   http://127.0.0.1:54321/functions/v1/calculate-interest
//     SERVICE_ROLE_KEY   <from `supabase status`>  (required)
//     ANON_KEY           <from `supabase status`>  (optional, for the 401 test)
//     DB_CONTAINER       supabase_db_Lootloop
//
//   node supabase/functions/calculate-interest/run-tests.mjs

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const FUNCTION_URL = process.env.FUNCTION_URL ??
  "http://127.0.0.1:54321/functions/v1/calculate-interest";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.ANON_KEY ?? "";
const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_Lootloop";

const MONTHLY_RATE = 0.05;
const calculateInterest = (b) => Math.round(b * MONTHLY_RATE);

// Eligible kid: 200 * 0.05 = 10 (credited). Tiny kid: 9 * 0.05 = 0.45 -> 0 (skipped).
const ELIGIBLE_BALANCE = 200;
const TINY_BALANCE = 9;
const EXPECTED_INTEREST = calculateInterest(ELIGIBLE_BALANCE); // 10

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

  // ---- Seed a throwaway family + two kids (each with a wallet) ------------
  const familyId = randomUUID();
  const eligibleKidId = randomUUID();
  const tinyKidId = randomUUID();

  // A trigger auto-creates a wallet (balances 0,0) on kid-profile insert
  // (migration 003), so we UPDATE the savings_balance rather than insert wallets.
  db(`
    insert into families (id, name) values ('${familyId}', 'T34 Test Family');
    insert into profiles (id, family_id, role, display_name, pin_hash, age_mode) values
      ('${eligibleKidId}', '${familyId}', 'kid', 'Saver Kid',  'x', 'detailed'),
      ('${tinyKidId}',     '${familyId}', 'kid', 'Tiny Kid',   'x', 'detailed');
    update wallets set savings_balance = ${ELIGIBLE_BALANCE} where kid_id = '${eligibleKidId}';
    update wallets set savings_balance = ${TINY_BALANCE}     where kid_id = '${tinyKidId}';
  `);

  try {
    // ---- auth: missing/anon bearer -> 401 ---------------------------------
    console.log("auth: non-service bearer -> 401");
    {
      const noAuth = await invoke({ family_id: familyId }, { auth: "" });
      check("no Authorization -> 401", noAuth.status === 401, `got ${noAuth.status}`);
      if (ANON_KEY) {
        const anon = await invoke({ family_id: familyId }, { auth: ANON_KEY });
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
      const badFamily = await invoke({ family_id: "not-a-uuid" });
      check("bad family_id -> 400", badFamily.status === 400, `got ${badFamily.status}`);
      const badKid = await invoke({ kid_id: "nope" });
      check("bad kid_id -> 400", badKid.status === 400, `got ${badKid.status}`);
    }

    // ---- credit interest for this family ----------------------------------
    console.log("credit interest -> eligible kid credited, tiny kid skipped");
    {
      const res = await invoke({ family_id: familyId });
      check("status 200", res.status === 200, `got ${res.status}`);
      const json = await res.json();
      check("scope == family", json.scope === "family", JSON.stringify(json));
      check("credited == 1", json.credited === 1, `credited=${json.credited}`);
      check(`total == ${EXPECTED_INTEREST}`, json.total === EXPECTED_INTEREST,
        `total=${json.total}`);
    }

    // ---- DB: eligible kid's savings grew by exactly the interest ----------
    {
      const newBal = db(`
        select savings_balance from wallets where kid_id = '${eligibleKidId}';
      `);
      check(
        `eligible savings ${ELIGIBLE_BALANCE} -> ${ELIGIBLE_BALANCE + EXPECTED_INTEREST}`,
        newBal === String(ELIGIBLE_BALANCE + EXPECTED_INTEREST),
        `savings_balance=${newBal}`,
      );

      const txn = db(`
        select type || '|' || amount from savings_transactions
         where kid_id = '${eligibleKidId}' and type = 'interest';
      `);
      check("'interest' savings_transactions row written w/ correct amount",
        txn === `interest|${EXPECTED_INTEREST}`, `row=${txn}`);
    }

    // ---- DB: tiny kid was skipped (no change, no ledger row) --------------
    {
      const tinyBal = db(`
        select savings_balance from wallets where kid_id = '${tinyKidId}';
      `);
      check("tiny kid savings unchanged", tinyBal === String(TINY_BALANCE),
        `savings_balance=${tinyBal}`);
      const tinyTxns = db(`
        select count(*) from savings_transactions where kid_id = '${tinyKidId}';
      `);
      check("tiny kid has NO interest ledger row", tinyTxns === "0",
        `count=${tinyTxns}`);
    }

    // ---- kid scope: target only the eligible kid --------------------------
    console.log("kid scope -> only the named kid is credited");
    {
      const res = await invoke({ kid_id: eligibleKidId });
      const json = await res.json();
      check("status 200", res.status === 200, `got ${res.status}`);
      check("scope == kid", json.scope === "kid", JSON.stringify(json));
      check("credited == 1", json.credited === 1, `credited=${json.credited}`);
      // Second run compounds on the now-larger balance (210 -> round(10.5)=11).
      const expected2 = calculateInterest(ELIGIBLE_BALANCE + EXPECTED_INTEREST);
      check(`total == ${expected2} (compounded)`, json.total === expected2,
        `total=${json.total}`);
    }
  } finally {
    // Clean up the throwaway family (cascades to profiles, wallets, txns).
    db(`delete from families where id = '${familyId}';`);
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
