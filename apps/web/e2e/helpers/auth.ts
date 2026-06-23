// Local-Supabase auth + Mailpit helpers for the E2E specs.
//
// SERVICE_ROLE_KEY is the well-known local Supabase demo key (same value the
// Maestro flows use); it never reaches a client bundle — it lives only in this
// test helper. The signup spec drives the REAL email flow via Mailpit; specs 2
// and 3 create a pre-confirmed parent directly through the GoTrue admin API so
// they don't have to re-run signup each time.

const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';

// Local Supabase demo service_role key (public, non-secret for local dev).
const SERVICE_ROLE_KEY =
  process.env.E2E_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export interface AuthUser {
  id: string;
  email: string;
  password: string;
}

// Create an email-confirmed parent auth user via the GoTrue admin API. Returns
// the auth user id (used to bind a parent profile in the seed).
export async function createConfirmedAuthUser(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) {
    throw new Error(`createConfirmedAuthUser failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { id: string };
  return { id: body.id, email, password };
}

// Poll Mailpit for the newest confirmation email sent to `email` and extract the
// GoTrue verify link (the one the user would click). Throws if none arrives.
export async function fetchConfirmationLink(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const searchRes = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    if (searchRes.ok) {
      const { messages } = (await searchRes.json()) as { messages: { ID: string }[] };
      if (messages.length > 0) {
        const id = messages[0].ID;
        const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
        if (msgRes.ok) {
          const msg = (await msgRes.json()) as { HTML?: string; Text?: string };
          const link = extractVerifyLink(msg.HTML ?? '') ?? extractVerifyLink(msg.Text ?? '');
          if (link) return link;
        }
      }
    }
    await sleep(500);
  }
  throw new Error(`No confirmation email for ${email} within ${timeoutMs}ms`);
}

// Pull the GoTrue /auth/v1/verify link out of an HTML or text email body.
function extractVerifyLink(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/);
  if (!match) return null;
  return match[0].replace(/&amp;/g, '&');
}

// Delete every Mailpit message addressed to `email`, so a re-run's poll can't
// match a stale confirmation mail from a previous run.
export async function deleteMailFor(email: string): Promise<void> {
  const searchRes = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!searchRes.ok) return;
  const { messages } = (await searchRes.json()) as { messages: { ID: string }[] };
  if (messages.length === 0) return;
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: messages.map(m => m.ID) }),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
