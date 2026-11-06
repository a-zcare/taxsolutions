# Product readiness snapshot

Evidence snapshot: feature work after CRM commit `1313146` and PWA commit `1849f1c`; this is an engineering status, not a security certification. PR #2 is the secure-platform prerequisite, PR #3 is the CRM interface, and PR #4 is the PWA/privacy layer. All are drafts and must be reviewed in dependency order.

| Feature | Status | Tested evidence | Remaining risk / release blocker |
|---|---|---|---|
| LV/EN/RU public site, light/dark, static Pages | Implemented | Pages export and static link checks passed; 21 HTML pages and 624 local links/resources | Public prices/contact/legal defaults still need owner verification |
| Booking calendar, Riga timezone, DST, conflict protection | Implemented | Unit, PostgreSQL integration, migration and existing E2E coverage | SMTP/booking operational monitoring and real-world schedule verification |
| MFA, sessions, RBAC, object scoping, audit | Implemented in prerequisite PR #2 | Platform checks pass locally: TOTP replay/concurrency, deactivation, IDOR, audit append-only | PR #2 not merged; owner/security review and final CI required |
| CRM dashboard/calendar/services | Implemented in PR #3 | CRM integration, production build; day/week/month and authorization browser scenarios exist | Remote browser run pending; role policy and usability review required |
| CRM clients/tasks | Core persistence and scoped APIs/UI present | CRM/platform integration tests cover scopes, IDOR, stale versions, assignment and KPI | Client portal and document vault are not implemented |
| PWA installability | Implemented foundation | Manifest/icon/offline static assertions and export validation | Native install behavior not verified on physical iOS/Android or installed desktop apps |
| PWA cache isolation | Implemented with public allowlist | Unit tests assert admin/workspace/API/query/external requests are not intercepted | Verify after deployment on the final HTTPS origin and supported browsers |
| Privacy and cookies | Privacy center and cookie policy implemented | Source inspection and static checks; no optional tracking code found | No consent banner is needed while there are no optional technologies. Controller, processors, retention, legal grounds and data-subject request workflow require owner/privacy review and implementation |
| Analytics | Not enabled | Repository inspection found no analytics/marketing scripts | Add only with privacy review and prior-consent gating if required |
| Video meetings | Provider interfaces and mock lifecycle exist in PR #2 | Mock and failure/idempotency platform checks | Real OAuth providers require account credentials, consent scopes, review and operational testing |
| Document upload/client portal | Not implemented | No route or storage facility exposed | Design and threat model before accepting client files or portal access |
| Backup/restore | Runbooks and local restore evidence documented | Isolated local restore test documented in `docs/v2/VALIDATION.md` | Off-host credentials, schedule, retention and recovery exercise remain staging work |
| Docker/VPS production runtime | Prepared, not deployed | Container/runtime/Compose checks documented in V2 validation | Real EU VPS, TLS, firewall, monitoring and backups require owner provisioning/approval |

## Backlog

### P0 — before production

- Review and merge PR #2, then PR #3, then PR #4 after green CI and owner review.
- Confirm the legal controller, processors/DPAs, lawful bases and actual retention/deletion schedule; replace all placeholders and obtain professional review.
- Configure and test real SMTP delivery, worker monitoring, encrypted off-host backup credentials, restore and recovery objectives in staging.
- Complete MFA recovery procedure, account lockout/rate-limit operations, CSP review, and role-by-role security review against the actual deployment.
- Implement and verify data-subject access/export/deletion workflows and enforce the owner-approved retention schedule, including backup expiry.
- Verify PWA registration, cache behavior, privacy choices, and responsive flows on supported live HTTPS devices/browsers.
- Verify real contacts, prices, holiday schedule, service duration and booking policies before making public claims.

### P1 — complete before broad customer onboarding

- Add client portal only after dedicated account lifecycle, object scoping, session revocation, and security review.
- Implement private document intake/storage only after MIME/size limits, malware scanning, encryption, access audit and retention/deletion are operational.
- Add Google/Microsoft/Zoom integrations only after each provider's OAuth consent, scope, retry, cancellation and failure path is verified with test accounts.
- Add repeatable staging E2E for concurrent booking and real migration upgrades; run accessibility review across every CRM screen and role.

### P2 — product follow-up

- Consider self-hosted analytics only if there is a measured need and the privacy review approves the configuration.
- Add CSV/report refinements, broader calendar subscriptions and further install/update education after operational feedback.

## Current verification record

At this snapshot: unit `35/35`; lint and TypeScript pass; production build passes; Pages export and link/PWA validation pass; booking integration `10/10`; platform integration `18/18`; CRM integration passes; additive migration preserves a synthetic V1 appointment; production dependency audit reports zero high-level findings. The latest local Playwright static E2E attempt could not launch Chromium because this environment lacks `libnspr4.so`. GitHub Actions uses preinstalled Chrome; the new branch's remote workflow is the remaining browser evidence. No merge, production data migration or production deployment has been performed.
