// delete-account Edge Function (task #52, Milestone 7).
//
// Parent-facing account & family deletion. HARD delete (no soft-delete). Two
// operations selected by the request body's `action`:
//
//   * "leave"         -> the calling parent removes ONLY themselves. The SQL fn
//                        leave_family() deletes their profile (rejecting the LAST
//                        parent) and returns their auth_user_id.
//   * "delete_family" -> any parent deletes the ENTIRE family. The SQL fn
//                        delete_family() deletes the families row (FK CASCADE
//                        wipes everything family-scoped) and returns the set of
//                        parent auth_user_ids.
//
// This function then deletes each returned auth_user_id from GoTrue via the
// SERVICE-ROLE admin client (auth.admin.deleteUser) — the supported way to drop
// an auth user. (deleteUser is the GoTrue admin API, NOT PostgREST table DML, so
// it is allowed for service_role and does not depend on any table grant.)
//
// ============================================================================
// REQUEST / RESPONSE CONTRACT
// ============================================================================
//   POST  Authorization: Bearer <PARENT's GoTrue access token>   (REQUIRED)
//         (JSON body)  { "action": "leave" | "delete_family" }
//
//   The caller's token IS the authorization. The SQL functions are SECURITY
//   DEFINER and SELF-AUTHORIZE off the caller's JWT (auth_role()='parent', own
//   family), so we forward the caller's token to PostgREST (the rpc call below
//   carries it) — PostgREST sets request.jwt.claims from the verified token and
//   the DB does the real authZ. We do NOT use the service-role key for the DB
//   call; the service-role client is used ONLY for the GoTrue admin deletes.
//
//   200 -> { "ok": true, "action": <action>, "deleted_users": <int> }
//          deleted_users = number of auth.users rows removed from GoTrue.
//   400 -> { "error": "invalid_request", "message": ... }   bad/missing action
//   401 -> { "error": "unauthorized", "message": ... }      missing bearer, OR
//          the SQL fn rejected the caller (not a parent / unauthenticated)
//   403 -> { "error": "last_parent", "message": ... }       leave by the LAST
//          parent (must delete_family instead) — maps the SQL check_violation
//   405 -> { "error": "method_not_allowed" }
//   500 -> { "error": "server_error" }                      never a stack trace
//
// SECURITY: tokens/keys are never logged. A DB authZ failure is surfaced as 401/
// 403 with a generic message; unexpected failures are an opaque 500.

import { createClient } from "npm:@supabase/supabase-js@2.43.4";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type Action = "leave" | "delete_family";

interface DeleteInput {
  action: Action;
}

// Strict parse: body must be an object with action in the allowed set.
function parseInput(body: unknown): DeleteInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { action } = body as Record<string, unknown>;
  if (action !== "leave" && action !== "delete_family") return null;
  return { action };
}

// Postgres SQLSTATEs raised by the SQL functions (see migration 009).
const INSUFFICIENT_PRIVILEGE = "42501"; // not a parent / unauthenticated
const CHECK_VIOLATION = "23514"; // last-parent guard in leave_family

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // The caller's bearer token is REQUIRED — it carries the parent identity the
  // SQL functions authorize against. (The gateway already required some project
  // JWT to reach here; we re-read it to forward to PostgREST.)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+.+$/i.test(authHeader)) {
    return json({ error: "unauthorized", message: "Missing bearer token." }, 401);
  }

  let parsed: DeleteInput | null;
  try {
    parsed = parseInput(await req.json());
  } catch {
    parsed = null; // not JSON
  }
  if (!parsed) {
    return json(
      { error: "invalid_request", message: 'Expected { action: "leave" | "delete_family" }.' },
      400,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: "server_error" }, 500);
  }

  // Caller-scoped client: forwards the parent's token to PostgREST so the
  // SECURITY DEFINER SQL fn self-authorizes off the caller's JWT.
  const callerClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  // Collect the auth_user_id(s) the SQL fn says to delete from GoTrue.
  let authUserIds: string[];
  try {
    if (parsed.action === "leave") {
      // leave_family() returns a single uuid (the caller's auth_user_id).
      const { data, error } = await callerClient.rpc("leave_family");
      if (error) return mapRpcError(error);
      authUserIds = data ? [data as string] : [];
    } else {
      // delete_family() returns setof uuid -> an array of parent auth_user_ids.
      const { data, error } = await callerClient.rpc("delete_family");
      if (error) return mapRpcError(error);
      authUserIds = Array.isArray(data) ? (data as string[]) : [];
    }
  } catch {
    return json({ error: "server_error" }, 500);
  }

  // Delete each auth.users row via the GoTrue admin API (service-role).
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let deleted = 0;
  for (const id of authUserIds) {
    if (!id) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    // The profile/family is already gone (the SQL fn committed). If GoTrue can't
    // find the user it's effectively already deleted — treat as success. Any
    // other admin error is a real failure.
    if (!error) {
      deleted += 1;
    } else if (!/not.?found/i.test(error.message ?? "")) {
      return json({ error: "server_error" }, 500);
    }
  }

  return json({ ok: true, action: parsed.action, deleted_users: deleted }, 200);
});

// Map a PostgREST rpc error to the function's HTTP contract. The SQL functions
// raise insufficient_privilege (non-parent / unauthenticated) and, for the
// last-parent guard, check_violation.
function mapRpcError(error: { code?: string; message?: string }): Response {
  if (error.code === CHECK_VIOLATION) {
    return json(
      {
        error: "last_parent",
        message: "You are the last parent — delete the family instead of leaving.",
      },
      403,
    );
  }
  if (error.code === INSUFFICIENT_PRIVILEGE) {
    return json({ error: "unauthorized", message: "Not permitted." }, 401);
  }
  return json({ error: "server_error" }, 500);
}
