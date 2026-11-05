# V2 validation record

Local checks on the feature branch (synthetic data only):

- ESLint and TypeScript: pass.
- Unit: 28 tests across six suites, including authenticated encryption, TOTP RFC vectors/replay, RBAC/IDOR scope, OAuth binding, SSRF allowlist, provider idempotency/failures, workload assignment and Riga DST/month-end recurrence.
- Existing integration: 10 checks pass, including eight parallel requests with exactly one booking, database overlap constraint, atomic outbox and SMTP via Mailpit.
- Platform integration: 18 checks pass, including MFA concurrency, session revocation, scoped clients/tasks, optimistic versioning, assignment, append-only audit, parallel staff calendars, rescheduling, minimal email, idempotent reminders, mock video lifecycle and last Owner protection.
- V1 → V2 migration: preserves existing booking and backfills resource ranges in a freshly created isolated database.
- Existing browser suite: 11 pass, including languages, legal metadata, booking/cancel, admin editing, theme persistence/early initialization, axe accessibility checks and mobile overflow.
- Added workspace browser suite: 2 pass, including authenticated mobile dashboard, CSRF rejection, no secret fields in API, invalid enrollment and OAuth callback safe failure.
- Next.js production build: pass.
- GitHub Pages static export: pass; 17 HTML files and 473 local links/resources; LV/EN/RU and legal pages; no live data-collection forms/API routes.
- Production dependency audit: zero reported vulnerabilities at test time.
- Backup tool image: builds. Restic encrypted snapshot, repository integrity check and pg_restore into a new isolated `_restore_test` DB succeed (18 public tables). Local test repository only; this does not prove off-host credentials/network or scheduled delivery.

Pending acceptance: final image runtime/least-privilege deployment, branch CI on final SHA, expanded onboarding browser coverage, full manual WCAG 2.2 AA review, actual OAuth/SMTP accounts, off-host recovery and real VPS TLS/firewall/monitoring. Do not treat this record as a security certification or production launch approval. See SECURITY-OPERATIONS.md.

Additional checks: production runtime image builds and serves `/lv` HTTP 200 and `/api/health` OK as UID 10001 with read-only root filesystem and dropped capabilities, using the isolated test DB. Four static Pages browser theme/language/mobile tests also pass. Full Caddy/production-role orchestration remains a staging acceptance step.
