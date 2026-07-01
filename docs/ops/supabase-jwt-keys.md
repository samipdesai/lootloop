# Supabase JWT keys & secrets — DANGER runbook

**Read this before touching anything under Dashboard → Project Settings → JWT Keys,
API keys, or `supabase secrets` in production.** Getting it wrong takes the whole
app down — it already happened once (2026-07-01, all kid logins broke).

## What signs and verifies what

The prod project (`lootloop-prod`, `tuobznejndvoeicdtasd`) uses **asymmetric
ES256 JWT signing keys**. Its JWKS (`/auth/v1/.well-known/jwks.json`) advertises
only an `EC/ES256` key. But several things still depend on the **Legacy JWT
Secret** (a symmetric HS256 secret):

| Principal                        | Token         | Signed by                    | Verified via                      |
| -------------------------------- | ------------- | ---------------------------- | --------------------------------- |
| **Parent** (GoTrue session)      | ES256 JWT     | GoTrue (current signing key) | JWKS (ES256) — rotates gracefully |
| **Kid** (PIN session)            | **HS256 JWT** | `kid-auth` Edge Function     | **Legacy JWT Secret** ⚠           |
| `anon` / `service_role` API keys | HS256 JWT     | (project creation)           | **Legacy JWT Secret** ⚠           |

So the Legacy JWT Secret is **load-bearing** for kid sessions AND for the anon/
service keys every client sends as `apikey`. It is not a rotate-and-forget value.

## The failure mode (why this is scary)

- **Rotate / revoke the Legacy JWT Secret** → the `anon` key clients send is no
  longer valid → **every request from every client fails**, and `kid-auth`
  tokens 401. Parents (ES256) survive the anon-key breakage only if the anon key
  they ship is reissued everywhere too.
- **`KID_AUTH_JWT_SECRET` wrong/corrupted** (must equal the Legacy JWT Secret) →
  `kid-auth` returns 200 (login "works") but every kid `/rest/v1/*` call 401s →
  app shows "Couldn't load your loot." (This was the 2026-07-01 outage: the
  secret was stored with a stray byte.)
- **`kid-auth` can't find any signing secret** → 500 on every kid login. The
  secret name must be **non-reserved**: the platform blocks `SUPABASE_*` names
  and does not auto-inject `SUPABASE_JWT_SECRET` in prod. We use
  `KID_AUTH_JWT_SECRET`. See `supabase/functions/kid-auth/index.ts`.

## Rules

1. **Do NOT rotate or revoke the Legacy JWT Secret** while `kid-auth` and the
   legacy anon/service keys depend on it. There is no "just rotate the token"
   here — it is a coordinated migration, not a setting change.
2. **`KID_AUTH_JWT_SECRET` must exactly equal the Legacy JWT Secret.** Set it with
   `--env-file` (never inline paste — a trailing newline corrupts it):
   ```bash
   printf 'KID_AUTH_JWT_SECRET=%s\n' 'THE_LEGACY_SECRET' > ~/ll.env
   supabase secrets set --env-file ~/ll.env && rm ~/ll.env
   ```
   Verify it's the right value before deploying (validates it against the anon
   key's real signature, without exposing it):
   ```bash
   SECRET='THE_LEGACY_SECRET'; ANON='<prod anon key>'
   python3 - "$SECRET" "$ANON" <<'PY'
   import sys, hmac, hashlib, base64
   secret, tok = sys.argv[1].encode(), sys.argv[2]
   h, p, s = tok.split(".")
   calc = base64.urlsafe_b64encode(hmac.new(secret,(h+"."+p).encode(),hashlib.sha256).digest()).rstrip(b"=").decode()
   print("MATCH" if calc == s else "NO MATCH")
   PY
   ```
   `supabase secrets list` shows a SHA256 digest of the stored value — a changed
   digest confirms a change actually landed.
3. **The durable fix is the Phase 2 migration** (kid sessions → GoTrue/ES256),
   which removes this dependency. See `lootloop-technical-plan.md` §"Phase 2 —
   Kid session tokens." Until then, treat the Legacy JWT Secret as frozen.

## If you truly must change signing keys

Do it as a staged migration, never a hard swap: add the new key as **standby**
(both old and new are accepted for verification), roll clients/functions to the
new key, confirm no 401 spike, and only then retire the old one. Ship the mobile
build that trusts the new key **before** retiring the old. Never a same-window
cutover.

## Monitoring (catch it fast)

- **`kid-auth` 5xx** → misconfigured/missing signing secret.
- **Spike in kid `/rest/v1/*` 401s** (`get_logs service:"api"`) → token minted
  but rejected → wrong `KID_AUTH_JWT_SECRET` or a signing-key change.

Both should alert (Milestone 7 #61). A green `kid-auth` 200 does **not** mean
kids can use the app — always confirm a follow-up REST read returns 200.
