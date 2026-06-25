# DB backup & restore (Free-tier keep-alive)

We run a daily GitHub Actions job — `.github/workflows/db-backup.yml` — instead of
paying for Supabase Pro. It does two jobs at once:

1. **Keep-alive** — a daily request to the project's auth health endpoint so the
   Free-tier project never idles into the 7-day auto-pause. This step needs **no
   secrets** and always runs.
2. **Encrypted backup** — `pg_dump` of prod, gpg-encrypted (AES-256), uploaded as
   a private GitHub artifact retained 90 days. Runs only when `SUPABASE_DB_URL` is
   set. The dump holds real family/kids data, so it is **never** written
   unencrypted.

## Required secrets (repo → Settings → Secrets and variables → Actions)

| Secret | What | Where to get it |
| --- | --- | --- |
| `SUPABASE_DB_URL` | **Session-pooler** connection string (IPv4 — GitHub runners have no IPv6) | Supabase dashboard → Project Settings → Database → **Connection pooling** → **Session** mode (port 5432). Fill in the DB password. |
| `BACKUP_GPG_PASSPHRASE` | Passphrase used to encrypt/decrypt the dump | Generated and stored when the workflow was set up — **keep a copy somewhere safe; without it the backups are unrecoverable.** |

> Use the **Session** pooler (port 5432), not Transaction (6543) — `pg_dump` needs
> a session.

## Run it manually / test
GitHub → Actions → **DB Backup + Keep-Alive** → **Run workflow**. The encrypted
`.dump.gpg` appears under the run's **Artifacts**.

## Restore a backup
1. Download the `db-backup-*` artifact from the workflow run and unzip it.
2. Decrypt:
   ```bash
   gpg --batch --passphrase "$BACKUP_GPG_PASSPHRASE" \
     --decrypt -o restored.dump lootloop-prod-YYYYMMDD-HHMMSSZ.dump.gpg
   ```
3. Restore into a target Postgres (e.g. a fresh Supabase project's session-pooler URL):
   ```bash
   pg_restore --no-owner --clean --if-exists -d "$TARGET_DB_URL" restored.dump
   ```
   Review carefully before restoring over a live database; for full-disaster
   recovery, restore into a new project and re-point the apps.

## Limitations (why this isn't a full substitute for Pro)
- **Best-effort, not an SLA.** A silent failure for 7 days still pauses the project.
- **GitHub disables scheduled workflows after 60 days of repo inactivity** — if the
  repo goes quiet post-launch, add a free external pinger (e.g. cron-job.org hitting
  the same health URL) or push a commit to re-enable the schedule.
- Free tier still has size/bandwidth/MAU ceilings you'll eventually outgrow.
