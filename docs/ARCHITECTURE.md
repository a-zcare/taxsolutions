# Architecture and operational boundaries

## Data flow

Public server components load database-backed service, contact and localized copy data. Client calendar components fetch available dates, then slots, from no-store APIs. All mutations validate on the server with Zod, enforce an exact configured Origin and use a PostgreSQL-backed rate limiter. Availability responses contain no client information.

A booking transaction acquires a shared PostgreSQL advisory lock, reloads the active service and schedule, validates the exact offered slot, inserts the booking and queues an email. Administrator schedule/service/status writes and cancellations use the same lock. A PostgreSQL GiST exclusion constraint on `[start,end)` additionally rejects overlapping PENDING/CONFIRMED bookings across every service, including direct SQL inserts. Adjacent appointments are permitted. Dates are stored as UTC instants (`timestamptz`), working hours and local calendar dates are interpreted in Europe/Riga. Existing appointment duration is retained when service duration changes.

The exclusion constraint and its `btree_gist` extension are deliberately included in the SQL migration: Prisma schema DSL does not represent them. Preserve these constraints in subsequent migrations. The migration role needs permission to install `btree_gist`; install it as a database administrator when managed hosting restricts extensions.

Cancellation tokens contain 256 bits of randomness; only SHA-256 hashes live in booking rows. The raw token is delivered once in the response and email queue. Treat links and unsent email bodies as sensitive. The cancel page never mutates data on GET, protecting against email link scanners. Cancellation is idempotent. To reschedule, cancel then book again; there is no atomic move operation.

## Email and scheduled maintenance

Run `npm run worker` continuously. The transactional outbox is safe against normal worker failures and supports exponential retry delays, capped at one day. Multiple workers use row locks and SKIP LOCKED. Delivery is **at least once**: a process crash after SMTP acceptance but before commit may send a duplicate, with a stable Message-ID to help mail systems deduplicate. Pending queue count is visible in administration. Investigate persistent backlog; the worker deliberately logs no personal data or SMTP credentials. Backup SMTP availability, monitoring and bounce handling remain deployment responsibilities.

The worker also performs the documented retention deletes. It does not retain financial accounting documents; these would require a separate retention policy. Contact messages are forwarded via the same outbox. No analytics, tracking scripts or external web fonts are loaded. The only authentication cookie belongs to administrators.

## Google Calendar

Client-side Google Calendar links and authenticated-by-token ICS downloads work without any API key. Exports contain only the service and time, not client contact details. They create independent calendar entries; website cancellation does not delete an exported event.

For automatic synchronization, add a separate CalendarOutbox model with booking ID, event ID, action, retries and error state. Write CREATE/UPDATE/DELETE actions in the existing booking/status/cancellation transaction, then process them in a separate worker using a dedicated Google Calendar account and a user-approved OAuth integration. Store refresh credentials only in a secret manager. Use stable event IDs for idempotent retries. For two-way busy-time synchronization, read external busy intervals into a local table and include them in both calendar availability and the final locked transaction. Do not make paid requests or claim synchronization before credentials and conflict-policy tests are configured.

## Deployment

The app, worker and migration job use the same Docker image. PostgreSQL data lives in a named volume. Use HTTPS behind Caddy or an equivalent proxy; do not expose the database publicly. `/api/health` checks database readiness without leaking connection details. Secrets belong in runtime environment variables or an external secret store, never tracked files or build args.

Public sections currently share one localized page with anchor navigation; privacy, terms and legal information have their own localized URLs. Robots disallows administration, APIs and cancellation pages; robots directives are not an access control mechanism. Canonical, alternate-language links, sitemap and Open Graph are provided. The app sets the document language server-side through Next.js proxy and updates it on language navigation.

The single-admin model intentionally excludes password recovery, multiple roles and staff calendars. Change credentials in the environment and restart to rotate them. Rate limits use a global bucket unless a trusted reverse proxy is explicitly configured to overwrite X-Real-IP. Large installations should add audit logging, per-consultant capacity and independent monitoring.

## References

- [Next.js documentation](https://nextjs.org/docs)
- [Prisma release status](https://www.prisma.io/docs/orm/release-status): Prisma 7.10.1 is pinned; npm's latest tag was an 8.0 release candidate at implementation time.
- [PostgreSQL range exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT)
- [GDPR official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng): operator must review legal basis, controller details and retention before launch.
