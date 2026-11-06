# Accounting CRM interface

## Baseline and scope

Reviewed `feat/taxsolutions-platform` (`7737b02`), main and the secure-platform feature branch (`0af76cb`). The original platform has booking and settings editors but no Client/Task models. Draft PR #2 adds staff MFA/RBAC, clients, tasks and audit infrastructure. This feature branch is **based on PR #2**, and its Draft PR targets that branch so reviewers see the interface/calendar delta without duplicate CRM models. Neither PR is merged. Apply/review the prerequisite before releasing this UI to main.

`/admin` now opens the authenticated CRM for all staff, with role-appropriate navigation; `/workspace` remains a compatible entry. Owner/Admin settings use the existing Admin.tsx and AdminEditors.tsx embedded in the same shell. Accountant permissions remain checked on the server, independent of hidden navigation.

## Interface

- Responsive sidebar with current section, keyboard focus, Escape and mobile drawer.
- Database-backed KPI: pending bookings, upcoming confirmed consultations, open tasks due today, overdue tasks, scoped clients, unassigned tasks and failed mail/video jobs. No revenue, growth or other invented business metrics.
- Upcoming consultation and due-task previews use scoped database queries. Counts/lists reflect the request time, shown in Europe/Riga.
- Calendar day/week/month with Monday-first weeks and 42-day month grid. Actual consultations include records overlapping local midnight. Filters: appointments/tasks, staff and status. Existing cancelled/completed records remain visible when not filtered out. Event details expose only the fields needed for operations. Status changes/rescheduling reuse the existing authenticated, validated, audited transaction paths and booking exclusion constraint.
- Services use collapsed rows; all LV/EN/RU fields, eurocent prices, pricing types, active state and duration remain editable. Schedule, contacts and copy editors are retained.
- Shared theme variables and scoped spacing/form/button styles preserve public pages. Loading, retry/error, empty-list and result-limit states are explicit. Requests are aborted on view/filter changes to avoid stale results.

Calendar APIs return at most 500 events and disclose truncation. Choose a narrower period or staff/status filter if needed. Month on narrow screens is compact; day and week remain readable agenda cards. This is operational CRM data, not an accounting ledger or financial reporting product.

## Database migrations and data safety

No existing migration is rewritten. The prerequisite V2 migration creates Client/Task/staff/audit tables and preserves V1 appointments with a backfill of resource ranges. This branch adds `20261106010000_crm_calendar_indexes`: two indexes on Booking(start) and Booking(staffId,start), inside one transaction. No DELETE/UPDATE/DROP/backfill is performed by the new migration. Normal CREATE INDEX can briefly block writes; apply in a maintenance window. The schema remains additive and existing booking IDs/statuses/notes are retained.

Before any upgrade, stop writers, take an encrypted off-host PostgreSQL custom-format dump and verify a restore to a **new isolated database**. Record source/image SHA, `prisma migrate status`, snapshot identifier and application encryption-key backup. Follow [VPS runbook](v2/DEPLOYMENT.md) and [privacy/security operations](v2/SECURITY-OPERATIONS.md). Never run migrate reset or Compose down -v on existing data.

Deploy: review both prerequisite SQL files plus this index migration, run `prisma migrate deploy` using the migration role, then start the reviewed image and smoke-test MFA, role scopes, bookings and calendar. Runtime role must not own the schema or alter audit history. The UI does not introduce new secrets and does not require .env changes.

Rollback: the preceding secure-platform image can run with these extra indexes in place, so roll back the image and leave the additive database changes intact. Do not automatically reverse the V2 schema or drop client/task tables. If a full database rollback is necessary, restore the pre-upgrade snapshot into a new database, validate it and switch during maintenance with explicit approval of the recovery-point/data-loss implications. Keep the original database/volume and test records. Removing optional indexes is a separately reviewed DBA action; no destructive down-migration is shipped.

## Verification and isolation

Local browser and CRM integration tests use a newly created `taxsolutions_test_crm_*` database. Existing development databases, records and .env are untouched. CRM integration fixtures are synthetic and retained; tests never need real client information. CI uses its own ephemeral PostgreSQL/Mailpit services.

Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:crm`, `npm run build`, `npm run test:e2e`, `npm run build:pages`, `npm run test:pages`. For integration/browser tests configure an isolated test environment in the process, as described in README; do not point them at existing customer/development data. Unit tests cover DST, week/year boundaries, month navigation and invalid local times. CRM integration covers cross-midnight records, staff scopes, filter validation, task IDOR, KPI and response minimization. Browser tests cover both themes, mobile navigation/keyboard, locales, day/week/month, existing appointment management, compact services, preserved editors and error recovery.

GitHub Pages remains a separate static demonstration with no CRM or live forms. No merge, production migration or deployment is part of this change.

## MFA browser-test isolation

Playwright now provisions one synthetic Owner per authenticated browser scenario, with a unique email/password and an encrypted fixture TOTP secret. Fixture rows are retained in the isolated test database; no existing users or rate-limit rows are reset. The regular login endpoint, replay counter, bcrypt verification, CSRF Origin check, cookies and both rate-limit buckets are exercised unchanged. CI uses a fresh ephemeral PostgreSQL database; local reruns should also use a fresh `taxsolutions_test_*` database when cumulative legitimate test logins reach the configured global throttle. This addresses test isolation without a runtime bypass.
