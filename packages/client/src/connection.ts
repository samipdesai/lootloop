// Shared Supabase reachability check. Both apps call this on startup to log a
// connection status (task #7 acceptance: "Both apps connect to Supabase, log connected").
// Hits the unauthenticated /auth/v1/health endpoint, so it works before any schema/RLS exists.
export async function checkConnection(
  url: string | undefined,
  anonKey: string | undefined,
  label: string,
): Promise<boolean> {
  if (!url || !anonKey) {
    console.warn(`[LootLoop] Supabase env missing (${label}); skipping connection check`);
    return false;
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    if (res.ok) {
      console.log(`[LootLoop] Supabase connected (${label})`);
      return true;
    }
    console.error(`[LootLoop] Supabase unreachable (${label}): HTTP ${res.status}`);
    return false;
  } catch (err) {
    console.error(`[LootLoop] Supabase unreachable (${label}):`, err);
    return false;
  }
}
