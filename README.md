# TaxSolutions

Multilingual accounting and tax services website with online appointment booking, availability calendar, and transparent pricing.

Next.js App Router + TypeScript + Tailwind CSS + PostgreSQL + Prisma. Public website: `/lv` (default), `/en`, `/ru`; administration: `/admin`. Free, open-source runtime; no paid APIs. Not deployed to production.

## V2 feature branch

V2 adds a staff workspace at `/workspace`: Owner/Admin/Accountant roles, mandatory TOTP, scoped CRM records, tasks/Kanban/calendar, recurring deadlines and rule-based assignment, approved multilingual FAQ, inquiries, audit events and optional video integrations. This branch is for review; do not merge or deploy with real customer data without separate approval. Existing GitHub Pages remains a static demonstration.

- [Accounting CRM interface, calendar and migration notes](docs/CRM-INTERFACE.md)
- [Audit and module plan](docs/v2/AUDIT-PLAN.md)
- [Ubuntu/Docker deployment, upgrades, backup and recovery](docs/v2/DEPLOYMENT.md)
- [Security boundaries, retention and privacy acceptance](docs/v2/SECURITY-OPERATIONS.md)
- [Video account requirements and activation](docs/v2/VIDEO-PROVIDERS.md)
- [Validation record and pending acceptance](docs/v2/VALIDATION.md)
- [VPS capacity and operating budget](docs/v2/COSTS.md)
- [PWA, service worker cache rules and privacy center](docs/PWA-PRIVACY.md)

## Local development

Use Node.js 24, npm and Docker Compose. Checkout `feat/taxsolutions-v2-secure-platform`, copy `.env.example` to `.env`, run `npm ci`. Generate independent SESSION_SECRET (48 random bytes hex) and DATA_ENCRYPTION_KEY (32 random bytes base64), and set matching POSTGRES_PASSWORD/DATABASE_URL. Keep `.env` private.

```bash
docker compose --profile dev up -d db mailpit
npx prisma generate
npm run db:migrate
npm run db:seed
# Supply private JSON email/name/password via stdin; enroll the one-time authenticator URI.
npm run owner:bootstrap < /path/to/protected-owner-input.json
npm run dev
```

Start `npm run worker` in another terminal. Visit `/lv`, `/en`, `/ru`, `/admin` or `/workspace`; Mailpit is http://localhost:8025. The bootstrap command is first-Owner only; subsequent staff use Owner invitations with one-use enrollment links. Password plus authenticator code are mandatory. There is no environment-password login fallback. Database sessions are opaque and revoked on deactivation/role changes; rotating SESSION_SECRET also invalidates derived session hashes.

The contact form stores a CRM inquiry; email contains only its identifier and workspace link. Booking uses resource-specific exclusion constraints, staff schedules, breaks, buffer and Europe/Riga time. Unassigned appointments share the default resource. Set verified holidays/vacations explicitly. Confirmed online bookings require a successfully created meeting. Provider configuration is optional and disabled by default; mock is test-only.

The legacy `compose.yaml` is for development. For production use **deploy/compose.production.yaml** and its runbook, which includes Caddy, separate database roles, no public DB port and controlled migrations. Do not use automatic destructive schema resets or `down -v` on customer data.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
npm run build:pages
npm run test:pages
npm run test:pages:e2e
```

Database/integration/browser tests require a separate local database containing `taxsolutions_test` in its name. Apply migrations and seed to that database and configure TEST_DATABASE_URL, APP_ENV=test, TEST_ADMIN_PASSWORD, TEST_TOTP_SECRET and DATA_ENCRYPTION_KEY in the ignored local environment. Run `scripts/test-fixtures.ts` with the **test** DATABASE_URL; do not use fixtures on development/customer data. Run `npm run test:integration`, `npm run test:platform`, `npm run test:migrations`. SMTP integration uses local Mailpit. Browser tests require the built app started with the test DATABASE_URL and Playwright Chromium (`npx playwright install --with-deps chromium`). Tests create synthetic appointments and exercise MFA, themes, languages, origin checks and mobile layout. CI supplies isolated PostgreSQL and Mailpit.

Prices, contacts and legal texts remain demonstration defaults until verified by the operator. Review retention, processors, rights handling and manual accessibility before production. See the V2 runbooks for the safe transition from Pages to an EU VPS. No VPS, domain or paid plan is purchased by the project.

## GitHub Pages

The public demo at https://a-zcare.github.io/taxsolutions/ uses a separate static export. Run `npm run build:pages` and `npm run test:pages`. Output: `.pages-build/out`. The adapter copies only existing public presentation code and translations into an ignored build directory, configures Next.js `output: 'export'`, `basePath: '/taxsolutions'`, and `trailingSlash: true`. It does not change the primary Next.js application or require database/SMTP credentials. Each localized page is exported with its own HTML language.

The Pages edition displays localized notices instead of booking/contact forms and an informational `/admin/` page. No form data is collected, bookings are not created, and database prices/content are not synchronized. The complete PostgreSQL application, availability calendar, authenticated administration, SMTP worker and Docker deployment remain available in the main project. Changes to shared public presentation code/default translations appear on the next static build. The adapter fails if the expected source data loader changes.

The public site includes an installable PWA manifest, app icons and an offline notice. Its service worker caches only public language pages and immutable static assets; admin/workspace routes and all API requests stay network-only. iPhone/iPad users can use Safari **Share → Add to Home Screen**; supported desktop browsers show their native install action. The privacy center is linked from the footer. Since no optional analytics or marketing scripts are currently present, no misleading analytics consent banner or unused opt-in categories are shown. Review [PWA/privacy behavior and legal release blockers](docs/PWA-PRIVACY.md) before enabling third-party tracking or production data processing.

`.github/workflows/pages.yml` validates and packages Pages on pull requests, then automatically deploys **only main** using the `github-pages` environment. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions** is required (already configured at setup). The environment permits main. Deployment needs the standard workflow `pages: write` and `id-token: write` permissions; no access tokens or runtime secrets are uploaded. `.nojekyll` preserves `_next` resources. Root redirects to `/taxsolutions/lv/`, with EN/RU available from the language switcher.

For a local static preview, serve the export mounted at `/taxsolutions/` using any ordinary static HTTP server. Do not use `next start` for an exported site or a SPA fallback; deep links resolve to exported `index.html` files. The build is intentionally noindex while contacts/prices/legal information remain illustrative.

## Appearance

The header theme button supports light (default) and dark appearances. It stores only the explicit selection under `taxsolutions-theme` in localStorage. A small synchronous head script restores the preference before body content is displayed; blocked storage falls back to light and the toggle still works. All public pages, the primary app administration/calendar/forms and the static Pages demo share semantic CSS variables. Theme selection survives reloads, language changes and page navigation.

Run `npm run lint` for Next.js/TypeScript ESLint checks. ESLint needs the TypeScript 6 API compatibility package (`typescript` npm alias); the `@typescript/native` alias retains TypeScript 7's `tsc` for type checking. These are development tools only.

Theme browser checks: `npm run test:pages:e2e` starts a local static server and verifies both themes, localized navigation, persistence, first paint without hydration, blocked storage, WCAG contrast and widths 320–1440 px. Set `PAGES_TEST_URL=https://a-zcare.github.io` to run the same checks against the published site. GitHub-hosted runners use their preinstalled Google Chrome through Playwright's supported `chrome` channel; local checks use Playwright Chromium. This avoids re-downloading the browser on every deployment.
