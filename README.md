# TaxSolutions

Multilingual accounting and tax services website with online appointment booking, availability calendar, and transparent pricing.

Next.js App Router + TypeScript + Tailwind CSS + PostgreSQL + Prisma. Public website: `/lv` (default), `/en`, `/ru`; administration: `/admin`. Free, open-source runtime; no paid APIs. Not deployed to production.

## Local development

Prerequisites: Node.js 24, npm, Docker Engine with **Docker Compose v2**.

```bash
git clone https://github.com/a-zcare/taxsolutions.git
cd taxsolutions
git switch feat/taxsolutions-platform
cp .env.example .env
npm ci
node scripts/password-hash.mjs
```

Set `ADMIN_EMAIL`, paste the generated base64-encoded bcrypt hash as `ADMIN_PASSWORD_HASH_B64` in `.env`, and generate `SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Do not reuse example secrets. Use a URL-safe PostgreSQL password in `POSTGRES_PASSWORD` and the same password in `DATABASE_URL`.

```bash
docker compose --profile dev up -d db mailpit
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal: `npm run worker`. Open <http://localhost:3000/lv>, `/admin`, and Mailpit at <http://localhost:8025>. Local SMTP is `localhost:1025`. The seed is idempotent and preserves existing content.

The contact form requires a verified recipient email in **Admin → Contacts**. Without one, requests fail validation rather than pretending to deliver. Booking emails are queued transactionally and sent by the worker. Keep the worker running.

## Docker deployment (prepare only)

1. Copy `.env.example` to `.env`; set real secrets, `APP_URL=https://your-domain`, admin credentials, PostgreSQL password and SMTP configuration.
2. Run `docker compose build`, then `docker compose up -d`. The migration job applies schema changes and seeds missing defaults before the app and worker start.
3. Put a TLS reverse proxy (for example Caddy) in front of `127.0.0.1:3000`. HTTPS is required for administrator session cookies in production.
4. Set the proxy's upstream request limit (for example 32 KB), timeouts and request logging to omit booking cancellation query tokens. Keep database and SMTP ports private. `TRUST_PROXY=false` is safe by default with global rate limits; only enable it when the proxy **overwrites** `X-Real-IP` and direct upstream access is blocked.
5. Configure SMTP SPF/DKIM/DMARC and test a real booking, status notification and cancellation. For Docker development with Mailpit use `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, and start with `--profile dev`.
6. Configure and test encrypted PostgreSQL backups and restores. The database volume is persistent; do not run `docker compose down -v` on real data.

No domain, hosting, SMTP account or paid service is provisioned by this repository. Production publication and merging require the owner's approval.

## Administration

The panel supports LV/EN/RU and uses one environment-configured administrator. No public registration or default password. A signed, HttpOnly, SameSite=Strict session expires after eight hours; password verification uses bcrypt. Rotating `SESSION_SECRET` invalidates sessions.

- Appointments: upcoming/all/status filters, client details, confirm/cancel/complete. Cancelled appointments cannot be reopened; create a new booking instead.
- Services: add a service (inactive until reviewed), edit names/descriptions in all three languages, enable/disable, duration and price. Prices are integer eurocents; FIXED/FROM/HOURLY/MONTHLY supported. Public values are explicitly illustrative.
- Schedule: Validated form. `start`/`end` are whole hours, `weekdays` are Sunday=0 through Saturday=6; `closedDates` supports holidays and vacations, `openDates` supports exceptional working dates. Closed dates win. Set Latvian public holidays and shifted working days explicitly each year; no unverified holiday feed is used. Existing bookings remain valid after schedule changes.
- Contacts: verified phone, email, address and legal details. Empty fields display localized placeholders.
- Content: all public copy and legal templates, separately for LV/EN/RU. Text fields support all labels and FAQ entries. Service copy is edited in Services. Editors render plain text, never HTML.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Integration tests require an **isolated database** whose name contains `taxsolutions_test`, with migrations applied:

```bash
# Example with the local database container already running:
docker compose exec db createdb -U taxsolutions taxsolutions_test
DATABASE_URL=postgresql://taxsolutions:YOUR_PASSWORD@localhost:5432/taxsolutions_test npm run db:migrate
# Add TEST_DATABASE_URL with this connection string to .env, then:
npm run test:integration
```

Keep Mailpit running for integration SMTP checks. Tests create and remove their own service, appointments and email rows. They exercise concurrent booking, database overlap exclusion, cancellation, validation and actual SMTP delivery.

Browser tests: `npx playwright install --with-deps chromium`, start the built app (`npm start`), add `TEST_ADMIN_PASSWORD` to the ignored `.env` matching the configured admin hash, then `node --env-file=.env node_modules/@playwright/test/cli.js test`. Run only against a development database; tests submit and cancel a real test booking. The suite verifies languages/legal pages, canonical URLs, calendar/booking/cancellation, origin protection, administrator authorization, axe WCAG A/AA and mobile overflow. Browser report artifacts are ignored; representative reviewed screenshots are committed in `docs/screenshots/`. CI runs unit, integration, build and browser checks against isolated PostgreSQL/Mailpit services.

## Before public launch

- Replace demonstration prices, finalize tax/VAT treatment, contacts, registration details and legal texts; the supplied legal text is a **template requiring operator review**, not a certification of GDPR compliance.
- Verify controller/processor information, data processing agreements, retention policy and business terms. The worker deletes appointments after 180 days, sent mail after 30 days and all mail after 180 days. Align backups with your retention obligations.
- Set working days, holidays, vacation dates and service durations. Current capacity is **one consultant**, shared across services, using 30-minute start increments and Europe/Riga daylight saving rules.
- Provide domain/DNS and a server supporting Docker, HTTPS, persistent storage and outbound SMTP. Configure SMTP credentials and sender verification. No access details are stored in Git.
- Google Calendar export works via `.ics` and a prefilled Google Calendar link after booking. It is **not** automatic two-way synchronization. See [architecture](docs/ARCHITECTURE.md) for the extension point.

See [verification report](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md) and [deployment example](docs/Caddyfile).

## GitHub Pages

The public demo at https://a-zcare.github.io/taxsolutions/ uses a separate static export. Run `npm run build:pages` and `npm run test:pages`. Output: `.pages-build/out`. The adapter copies only existing public presentation code and translations into an ignored build directory, configures Next.js `output: 'export'`, `basePath: '/taxsolutions'`, and `trailingSlash: true`. It does not change the primary Next.js application or require database/SMTP credentials. Each localized page is exported with its own HTML language.

The Pages edition displays localized notices instead of booking/contact forms and an informational `/admin/` page. No form data is collected, bookings are not created, and database prices/content are not synchronized. The complete PostgreSQL application, availability calendar, authenticated administration, SMTP worker and Docker deployment remain available in the main project. Changes to shared public presentation code/default translations appear on the next static build. The adapter fails if the expected source data loader changes.

`.github/workflows/pages.yml` validates and packages Pages on pull requests, then automatically deploys **only main** using the `github-pages` environment. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions** is required (already configured at setup). The environment permits main. Deployment needs the standard workflow `pages: write` and `id-token: write` permissions; no access tokens or runtime secrets are uploaded. `.nojekyll` preserves `_next` resources. Root redirects to `/taxsolutions/lv/`, with EN/RU available from the language switcher.

For a local static preview, serve the export mounted at `/taxsolutions/` using any ordinary static HTTP server. Do not use `next start` for an exported site or a SPA fallback; deep links resolve to exported `index.html` files. The build is intentionally noindex while contacts/prices/legal information remain illustrative.

## Appearance

The header theme button supports light (default) and dark appearances. It stores only the explicit selection under `taxsolutions-theme` in localStorage. A small synchronous head script restores the preference before body content is displayed; blocked storage falls back to light and the toggle still works. All public pages, the primary app administration/calendar/forms and the static Pages demo share semantic CSS variables. Theme selection survives reloads, language changes and page navigation.

Run `npm run lint` for Next.js/TypeScript ESLint checks. ESLint needs the TypeScript 6 API compatibility package (`typescript` npm alias); the `@typescript/native` alias retains TypeScript 7's `tsc` for type checking. These are development tools only.

Theme browser checks: `npm run test:pages:e2e` starts a local static server and verifies both themes, localized navigation, persistence, first paint without hydration, blocked storage, WCAG contrast and widths 320–1440 px. Set `PAGES_TEST_URL=https://a-zcare.github.io` to run the same checks against the published site. GitHub-hosted runners use their preinstalled Google Chrome through Playwright's supported `chrome` channel; local checks use Playwright Chromium. This avoids re-downloading the browser on every deployment.
