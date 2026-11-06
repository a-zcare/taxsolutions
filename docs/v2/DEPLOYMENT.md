# TaxSolutions V2: operator runbook

V2 is a separate feature release. Do not merge or process real customer data until security and staging acceptance are complete. GitHub Pages continues to serve the static public demonstration; it cannot run PostgreSQL, authenticated CRM, SMTP or booking APIs.

## Ubuntu LTS, fresh installation

Use an EU VPS with at least 2 vCPU, 4 GB RAM and 40 GB SSD; 4 vCPU / 8 GB is preferable for on-host builds. Use an independently administered EU backup destination. Install supported Docker Engine and Compose from Docker's official Ubuntu instructions, enable OS security updates, use SSH keys, restrict SSH by firewall, expose only 80/443 publicly. Never expose PostgreSQL.

1. Clone the approved release into `/opt/taxsolutions`. Pin a reviewed commit and record its SHA. Copy `deploy/production.env.example` to `.env.production`; chmod 600. Generate independent random values locally; never commit the file. Set DOMAIN, APP_URL, SMTP and off-host restic destination. APP_URL is the root HTTPS domain, without the GitHub Pages base path.
2. Validate configuration: `node --env-file=.env.production scripts/ops/check-env.mjs`. Validate Compose: `docker compose --env-file .env.production -f deploy/compose.production.yaml config --quiet`.
3. Build: `docker compose --env-file .env.production -f deploy/compose.production.yaml build app migrate backup`. Start only DB: same Compose command followed by `up -d db`. The initialization script creates separate application, migration and read-only backup roles on a **fresh** volume only.
4. Fresh schema: same Compose command followed by `run --rm migrate`. For an existing installation, first take a verified backup, review SQL, stop writers, then supply `MIGRATION_APPROVED=true` when invoking Compose. The migrator requires a backup receipt less than 24 hours old for existing schemas. Never run `migrate reset` on customer data.
5. Bootstrap the first Owner using the build/migrator image and `npm run owner:bootstrap`. Supply JSON via stdin from a protected temporary file: email, name and password (14+ characters). Use the application database URL; no secret in command arguments. The command prints a one-time authenticator provisioning URI if no TOTP secret was supplied. Enroll it privately, delete temporary input securely, and store recovery material separately. There is no password-only login or public registration.
6. Start `up -d app worker caddy`. DNS must point to the VPS before Caddy obtains a certificate. Check `/api/health`, worker heartbeat, MFA login, synthetic booking/email and all locales/themes. Do not enable video providers before account-specific staging tests.
7. Initialize restic once, using the backup image with an overridden entrypoint. Pin SSH host keys in `deploy/backup-ssh/known_hosts` and use a dedicated backup credential. Install `deploy/taxsolutions-backup.service` and `.timer` under `/etc/systemd/system`; enable the timer. Verify an encrypted off-host snapshot and a separate restore drill before launch.

Compose does not publish a DB port. Runtime containers run without root privileges and with read-only root filesystems. PostgreSQL data and Caddy certificates are persistent volumes. Do not use `down -v` during upgrades.

## Upgrade and rollback

Record image digest, source SHA, DB migration status and snapshot ID. Build/test before maintenance. Stop app and worker, run encrypted backup, review SQL, migrate with explicit approval, start the new image, and smoke-test. Do not blindly roll back database schema: additive migrations may permit the previous image, but test compatibility first. Otherwise restore the pre-upgrade snapshot into a **new isolated database**, validate counts and booking constraints, and switch configuration during maintenance. Keep the original volume intact. Restoring loses writes since the snapshot; communicate the recovery point before proceeding. Never automatically delete old snapshots or data volumes.

`/api/health` checks DB availability and worker freshness. Monitor it from an independent system without authentication tokens or query strings. Alert on non-200, worker staleness, failed mail/video jobs, backup timer failures, disk space and certificate expiry. No third-party error tracker is enabled. Avoid request-body, URL-query and SQL parameter logging.

## Backup drills

Daily encrypted snapshots give a nominal recovery-point objective of 24h; the actual recovery time must be measured on the chosen VPS. Keep encryption keys and restic password outside the VPS, with restricted access. Use a separate restore server/database with a name ending `_restore_test`. Run `scripts/ops/restore-test.sh` in a tool container with `RESTORE_DATABASE` set to that database; never point it at production. Verify table counts, migration version, MFA decryption and appointment exclusion constraints. Record the result and date. Test restoring before every major schema upgrade. Restic checks do not replace restore tests. Consider append-only backup storage with separate retention credentials.

## Existing V1 PostgreSQL installation

Do not rerun `init-db.sh` on an existing volume. A DBA must create the three roles, transfer ownership to `tax_migrator`, grant existing table/sequence privileges and equivalent default privileges, and verify `btree_gist`. Test the V1→V2 migration against a sanitized restored copy. The migration preserves bookings, backfills ranges, and holds legacy unsent email for privacy review. Legacy environment-only admin credentials are replaced by database staff + MFA; bootstrap Owner during maintenance. Verify schedules and opt-in staff booking assignment before reopening appointments.

## GitHub Pages transition

Keep Pages live while staging is tested on a separate EU hostname. Deploy VPS with synthetic data first. Complete restore drill, MFA/RBAC tests, SMTP deliverability, provider account tests, privacy text and operator training. With separate owner authorization, migrate approved data during maintenance, point the chosen domain to VPS, verify HTTPS and bookings, then update Pages with a clear link. Do not pretend the static Pages booking notice is a live form. Keep a rollback DNS/image/DB plan and avoid split writes between installations.

## Required secret names

See `deploy/production.env.example`: independent DB role passwords; DATABASE_URL and MIGRATION_DATABASE_URL; SESSION_SECRET; DATA_ENCRYPTION_KEY; SMTP credentials; RESTIC_PASSWORD plus backup destination credentials/SSH private key and pinned host keys. Optional provider client IDs/secrets and Microsoft tenant ID are needed only after integrations are approved. Never request or share access/refresh tokens manually: OAuth obtains and encrypts them. Losing DATA_ENCRYPTION_KEY prevents recovery of MFA, meeting links and provider tokens; back it up separately. Key rotation requires a controlled decrypt/re-encrypt operation, not replacing the environment variable.
