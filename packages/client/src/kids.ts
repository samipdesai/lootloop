// Parent-session kid management (tasks #9-client / #15). RPC wrappers over the
// SECURITY DEFINER kid-management functions in migration 005. Mirrors auth.ts /
// chores.ts: each fn takes the Supabase client first and returns the awaited
// rpc / PostgREST result. The RPCs self-authorize (parent-only, own family);
// these wrappers add no client-side authZ. Reuse listKids from chores.ts for
// roster reads — not re-exported here.
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type AgeMode = Database['public']['Enums']['age_mode'];

// The generated RPC Args type declares the optional params as non-nullable
// `string`, but the SQL functions accept SQL NULL (and coalesce it to "leave
// as-is" / "default null"). Passing JS null is the intended call; we widen the
// Args type locally so TS accepts null without changing runtime behavior.

export function createKid(
  client: LootLoopClient,
  input: {
    display_name: string;
    pin: string;
    age_mode: AgeMode;
    birthdate?: string | null;
    avatar_url?: string | null;
  },
) {
  return client.rpc('create_kid', {
    p_display_name: input.display_name,
    p_pin: input.pin,
    p_age_mode: input.age_mode,
    p_birthdate: input.birthdate ?? null,
    p_avatar_url: input.avatar_url ?? null,
  } as Database['public']['Functions']['create_kid']['Args']);
}

export function updateKid(
  client: LootLoopClient,
  kidId: string,
  patch: {
    display_name?: string | null;
    age_mode?: AgeMode | null;
    avatar_url?: string | null;
    birthdate?: string | null;
  },
) {
  return client.rpc('update_kid', {
    p_kid_id: kidId,
    p_display_name: patch.display_name ?? null,
    p_age_mode: patch.age_mode ?? null,
    p_avatar_url: patch.avatar_url ?? null,
    p_birthdate: patch.birthdate ?? null,
  } as Database['public']['Functions']['update_kid']['Args']);
}

export function setKidPin(client: LootLoopClient, kidId: string, pin: string) {
  return client.rpc('set_kid_pin', { p_kid_id: kidId, p_pin: pin });
}

export function deleteKid(client: LootLoopClient, kidId: string) {
  return client.rpc('delete_kid', { p_kid_id: kidId });
}

export function regenerateFamilyCode(client: LootLoopClient) {
  return client.rpc('regenerate_family_code');
}

// The signed-in parent reads their own family's kid_code via the families_select
// RLS policy (id = auth_family_id()). maybeSingle: exactly one family row is
// visible, but stay null-safe before onboarding completes.
export function getFamilyCode(client: LootLoopClient) {
  return client.from('families').select('kid_code').maybeSingle();
}
