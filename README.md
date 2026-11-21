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
- [Verified product readiness, release blockers and P0/P1/P2 backlog](docs/PRODUCTION-READINESS.md)

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

## Document AI

Sign in to `/workspace` and open **Document AI**. Select up to 20 PDF, PNG or JPEG files (default 10 MiB each, up to 12 pages per PDF). Select a CRM client and an accounting month before uploading to save files to the review queue. Uploads with no client selected remain temporary. Field settings are saved per staff account in the current browser. Shared fields apply by default and each document type can override them. Staff can add custom fields, change a document type, override the fields for an individual file, correct values and export the corrected fields with the raw OCR text.

The Docker runtime includes Tesseract, Latvian, Russian and English language models, Poppler and `prlimit`. For native development on Debian or Ubuntu, install `poppler-utils tesseract-ocr tesseract-ocr-lav tesseract-ocr-rus tesseract-ocr-eng util-linux`. The authenticated application reads embedded PDF text and uses local Tesseract on scans and images. Temporary files are removed after each operation. The archive encrypts original bytes, filenames and field data in PostgreSQL using the existing DATA_ENCRYPTION_KEY. Files and OCR results are not written to application logs. GitHub Pages runs the public static demo.

### Review workflow

1. Pick the client and the accounting month and upload a batch. Identical files are rejected for that client across all months. A matching supplier and invoice number produces a warning for manual review.
2. Open a row from the queue. Use **Save draft** to retain corrections and resume later. Use **Confirm and open next** to lock the checked values and select the next pending document from the same client and month.
3. Download **Export confirmed CSV** for the selected client and month. The export uses UTF-8, a stable core set of accounting columns and any additional confirmed fields. It is a general CSV, so accounting software may require mapping the columns.
4. Use **Extract PDF pages** on a multi-page PDF to open the chosen range as a new document. The original remains available.

The module uses the CRM client access rules for lists, originals, review writes and exports. It is staff-only. Archive and review changes are audited. Keep the existing application encryption key with a recoverable backup. Run Prisma migrations before starting the upgraded app. Existing client erasure refuses to remove clients with archived accounting documents to prevent accidental loss.

The engine and rule matching live in `document-ocr.ts` and `document-ai-regions.ts`. Archive persistence, client scoping and review transitions live in `document-archive.ts`; the HTTP routes and CRM components consume these modules. An integration into a multi-tenant platform must supply the target workspace's tenant and client authorization.

### Recognition rules

An owner or administrator can select **Mark on document** beside a field, drag a region around its value, then enter the supplier name or registration number printed on the document. Optionally enter a unique nearby label such as `Amount due`. The server reads the example region before saving. It uses the document type and supplier text to match later documents and, when a label was provided, follows that label if its position shifts on the same page. Without a label, the rule uses the marked coordinates on that page. Suggestions can be accepted or corrected by staff. A missing or ambiguous label or a low-confidence value remains flagged for review. Rules store the coordinates, field and matching text in PostgreSQL. The training file and its extracted value are not stored. Replace a rule by marking the same field for the same document type and supplier, or delete it under **Saved recognition rules**.

### Processing limits

Owners and administrators can change the upload size, PDF page count and OCR timeout under **Document AI → Processing limits**. The server stores one shared setting for the workspace and applies it to new requests. Defaults are 10 MiB, 12 pages and 90 seconds. The supported ranges are 1–30 MiB, 1–50 pages and 15–300 seconds. The OCR timer starts after upload. The optional Ollama request has its own timeout.

### Optional local AI review

Set `DOCUMENT_AI_OLLAMA_URL=http://ollama:11434` in `.env` for the local Docker Compose setup. Start the private Ollama service and download the local vision model:

```bash
docker compose --profile ai up -d ollama
docker compose --profile ai exec ollama ollama pull qwen3-vl:4b-instruct
docker compose --profile ai up -d --build app
```

For native development, use `http://127.0.0.1:11434` with a local Ollama instance. In production, configure an Ollama instance reachable on a private network from the app container, with cloud features disabled. Use `DOCUMENT_AI_OLLAMA_MODEL` to select a different installed local vision model. Leave the URL empty to run OCR without AI review.

TaxSolutions sends a page image and the names of uncertain fields to the configured Ollama instance. It flags missing fields, conflicting matches and words with low Tesseract confidence. Suggestions appear separately from OCR values. Staff can accept them or type their own corrections. If the model is unavailable or a field is still ambiguous, review the field in the preview.

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
