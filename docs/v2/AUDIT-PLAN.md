# TaxSolutions 2.0 audit and implementation plan

Baseline: main c0f00ad. One merged PR (#1); the retained platform branch predates the theme release. Main has Next.js 16.4.5, TypeScript 7 CLI / TypeScript 6 lint API, Prisma 7.10.1, PostgreSQL 17, transactional booking exclusion, cancellation tokens, Europe/Riga availability, SMTP outbox, translated administration, themes and a separate static Pages export. There is no CRM, task planner, staff identity, MFA, object-scoped authorization or video OAuth integration.

Existing strengths: server validation, exact-origin mutation checks, hashed capability tokens, database overlap constraint, no tracking/AI calls, at-least-once mail queue and retention worker. Gaps: one environment administrator, no MFA or revocable sessions, no audit log, single global consultant resource, no breaks/buffers/rescheduling, unbounded mail retries, no encrypted OAuth storage or tested backup operations. PostgreSQL is currently bound to loopback for development; production must remove the published port entirely. Booking comments are plaintext operational data; financial documents must never be accepted here.

Dependencies / sequence:
1. Additive database migration: staff/session/audit, clients/tasks/FAQ, booking resource and scheduling metadata, video jobs/OAuth.
2. Cryptographic primitives, MFA, database sessions, RBAC and object policies; replace environment-only login without production bypass.
3. Preserve existing booking API; add resource-aware availability, transactional rescheduling, breaks/buffers and event notifications.
4. Workspace API + dashboard, clients, planner, rule-based assignments, approved FAQ.
5. Provider abstraction and durable video jobs; official OAuth adapters remain disabled until configured. Mock provider for isolated tests only.
6. Worker maintenance, minimal notification templates, secure Compose/Caddy, encrypted off-host backups and restore verification.
7. Unit, real PostgreSQL integration, authorization/IDOR, API-error and browser checks; document limits and create Draft PR. Never merge or deploy this branch automatically.

GitHub Pages remains a separate static demo: no staff/customer records, tokens or private API code may enter its export. VPS deployment is the only supported runtime for this platform. No production data, paid accounts, subscriptions or real OAuth credentials are required for implementation tests.
