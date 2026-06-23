import { sql, sqlScalar } from './db';
import { createConfirmedAuthUser, deleteMailFor, type AuthUser } from './auth';

// Deterministic-but-unique fixture seeding for the E2E specs. Each spec gets its
// own family (unique name per run) plus a pre-confirmed parent bound to it, so
// specs are isolated and re-runnable. Runs as the postgres superuser (bypasses
// RLS) — test infra only, never touched by the app.

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export interface SeededFamily {
  parent: AuthUser;
  familyId: string;
  familyName: string;
  kidId: string;
  kidName: string;
}

export interface SeedOptions {
  // A unique token (e.g. timestamp) to keep the family/email distinct per run.
  token: string;
  kidName?: string;
}

// Create a confirmed parent auth user, a fresh family, a parent profile bound to
// the auth user, and one kid (whose wallet/streak are auto-created by trigger).
export async function seedFamilyWithParentAndKid(opts: SeedOptions): Promise<SeededFamily> {
  const familyName = `E2E Family ${opts.token}`;
  const kidName = opts.kidName ?? 'Ava';
  const email = `e2e-${opts.token}@lootloop.test`;
  const password = 'E2eTest1234!';

  // Clear any prior run's mail + rows for this email/family (idempotent re-run).
  await deleteMailFor(email);
  sql(`delete from auth.users where email = '${esc(email)}';`);
  sql(`delete from families where name = '${esc(familyName)}';`);

  const parent = await createConfirmedAuthUser(email, password);

  const familyId = sqlScalar(
    `insert into families (name, kid_code) values ('${esc(familyName)}', 'E2E${opts.token.slice(-5).toUpperCase()}') returning id;`,
  );

  // Parent profile bound to the GoTrue user so the web session resolves to this
  // family via the RLS helpers / middleware profile lookup.
  sql(
    `insert into profiles (family_id, role, display_name, auth_user_id)
     values ('${familyId}', 'parent', 'Parent', '${parent.id}');`,
  );

  // Kid (PIN hashed via pgcrypto, matching the Maestro seed). The
  // profiles_ensure_kid_wallet_and_streak trigger creates the wallet + streak.
  const kidId = sqlScalar(
    `insert into profiles (family_id, role, display_name, pin_hash, age_mode)
     values ('${familyId}', 'kid', '${esc(kidName)}', crypt('1234', gen_salt('bf', 10)), 'detailed')
     returning id;`,
  );

  return { parent, familyId, familyName, kidId, kidName };
}

// Seed a chore + today's instance + a PENDING completion from the kid, so the
// Approvals queue has a card to approve. Returns the chore points.
export function seedPendingCompletion(
  family: SeededFamily,
  title: string,
  points: number,
): { points: number; choreId: string } {
  const choreId = sqlScalar(
    `insert into chores (family_id, title, points, assignment, assigned_kid_id, active, icon)
     values ('${family.familyId}', '${esc(title)}', ${points}, 'assigned', '${family.kidId}', true, '🧹')
     returning id;`,
  );
  const instanceId = sqlScalar(
    `insert into chore_instances (family_id, chore_id, due_date, points)
     values ('${family.familyId}', '${choreId}', current_date, ${points})
     returning id;`,
  );
  sql(
    `insert into chore_completions (family_id, chore_instance_id, kid_id, status, submitted_at)
     values ('${family.familyId}', '${instanceId}', '${family.kidId}', 'pending', now());`,
  );
  return { points, choreId };
}

// Seed a reward and a kid PURCHASE of it (status 'purchased' = awaiting
// fulfillment), so the Rewards → Fulfillment queue has a row to mark given.
export function seedPurchasedReward(
  family: SeededFamily,
  title: string,
  cost: number,
  emoji = '🍦',
): { rewardId: string; purchaseId: string } {
  const rewardId = sqlScalar(
    `insert into rewards (family_id, title, emoji, cost, active)
     values ('${family.familyId}', '${esc(title)}', '${esc(emoji)}', ${cost}, true)
     returning id;`,
  );
  const purchaseId = sqlScalar(
    `insert into reward_purchases (family_id, reward_id, kid_id, cost, status, purchased_at)
     values ('${family.familyId}', '${rewardId}', '${family.kidId}', ${cost}, 'purchased', now())
     returning id;`,
  );
  return { rewardId, purchaseId };
}

// Current spendable balance for a kid (used to assert points appeared after an
// approval).
export function kidWalletBalance(kidId: string): number {
  return Number(sqlScalar(`select wallet_balance from wallets where kid_id = '${kidId}';`));
}

// Tear down a seeded family (cascades to kid, chores, rewards, purchases,
// wallets) and its parent auth user.
export async function teardownFamily(family: SeededFamily): Promise<void> {
  sql(`delete from families where id = '${family.familyId}';`);
  sql(`delete from auth.users where id = '${family.parent.id}';`);
  await deleteMailFor(family.parent.email);
}
