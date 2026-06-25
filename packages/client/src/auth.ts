// Parent-auth helpers (task #8), shared by web + mobile. Each takes a Supabase
// client so the caller controls how it's created (web @supabase/ssr browser
// client, mobile plain client, etc.). RPC wrappers call the SECURITY DEFINER
// bootstrap functions from migration 004.
import type {
  AuthError,
  AuthResponse,
  PostgrestError,
  SupabaseClient,
} from '@supabase/supabase-js';
import type { Database } from '@lootloop/types';
import { checkPasswordPwned } from './pwned';

export type LootLoopClient = SupabaseClient<Database>;

// --- Supabase Auth (email/password, parents) ---------------------------------

export async function signUpParent(
  client: LootLoopClient,
  email: string,
  password: string,
  emailRedirectTo?: string,
): Promise<AuthResponse> {
  // Reject passwords found in known breaches before creating the account
  // (security audit L-2). Fail-open lives inside checkPasswordPwned.
  if (await checkPasswordPwned(password)) {
    const error = {
      name: 'AuthApiError',
      message: 'This password appeared in a known data breach.',
      status: 400,
      code: 'pwned_password',
    } as unknown as AuthError;
    return { data: { user: null, session: null }, error };
  }

  return client.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
}

export function signInParent(client: LootLoopClient, email: string, password: string) {
  return client.auth.signInWithPassword({ email, password });
}

export function signOut(client: LootLoopClient) {
  return client.auth.signOut();
}

export function requestPasswordReset(client: LootLoopClient, email: string, redirectTo?: string) {
  return client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
}

export function updatePassword(client: LootLoopClient, password: string) {
  return client.auth.updateUser({ password });
}

// --- Family bootstrap RPCs (migration 004) -----------------------------------

export function createFamilyAndParent(
  client: LootLoopClient,
  familyName: string,
  displayName: string,
) {
  return client.rpc('create_family_and_parent', {
    p_family_name: familyName,
    p_display_name: displayName,
  });
}

export function createFamilyInvite(client: LootLoopClient) {
  return client.rpc('create_family_invite');
}

export function joinFamilyAsParent(client: LootLoopClient, code: string, displayName: string) {
  return client.rpc('join_family_as_parent', {
    p_code: code,
    p_display_name: displayName,
  });
}

// --- Friendly error mapping ---------------------------------------------------
// Supabase Auth errors carry a `code`; the 004 RPCs surface their raised message
// (used/expired both use the same SQLSTATE, so we discriminate on message text).
export function mapAuthError(error: AuthError | PostgrestError | null | undefined): string {
  if (!error) return '';
  const code = 'code' in error && error.code ? error.code : '';
  const msg = error.message ?? '';

  // Supabase Auth
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    return 'Incorrect email or password.';
  if (code === 'user_already_exists' || /already registered|already exists/i.test(msg))
    return 'An account with this email already exists.';
  if (code === 'email_not_confirmed') return 'Please confirm your email before logging in.';
  if (code === 'weak_password') return 'Password is too weak — use at least 8 characters.';
  if (code === 'pwned_password')
    return 'This password appeared in a known data breach — please choose a different one.';
  if (code === 'over_email_send_rate_limit' || /rate limit|too many/i.test(msg))
    return 'Too many attempts. Please wait a moment and try again.';

  // Family invite / bootstrap RPCs (004)
  if (/invalid invite code/i.test(msg)) return "That invite code isn't valid.";
  if (/already used/i.test(msg)) return 'That invite code has already been used.';
  if (/expired/i.test(msg)) return 'That invite code has expired.';
  if (/already belongs to a family/i.test(msg)) return "You're already part of a family.";

  return 'Something went wrong. Please try again.';
}
