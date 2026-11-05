# Verification report

Implementation checked on 5 November 2026 using Node.js 24, Next.js 16.4.5, Prisma 7.10.1, PostgreSQL 17, Chromium 1.64.1 (Playwright package version), and Mailpit 1.27.

| Check                                             | Result                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| TypeScript strict typecheck                       | Passed                                                                                                           |
| Production Next.js compilation                    | Passed                                                                                                           |
| Vitest                                            | 10 tests passed                                                                                                  |
| PostgreSQL + SMTP integration                     | 10 checks passed                                                                                                 |
| Playwright browser suite                          | 5 scenarios passed                                                                                               |
| axe WCAG 2 A/AA and 2.1 A/AA on English home page | No violations found                                                                                              |
| Mobile layout at 375 px                           | No horizontal overflow                                                                                           |
| npm audit, production dependencies                | 0 known vulnerabilities at check time                                                                            |
| Full Docker Compose stack                         | Database healthy, migration/seed completed, app healthy, worker running; browser suite passed against containers |
| Docker image                                      | Built successfully, non-root runtime                                                                             |

Unit tests cover both Riga daylight-saving transitions, local dates near midnight, holidays/weekends, working-date overrides, lead time, invalid dates, horizon limits, overlapping intervals, complete appointments before closing, translation completeness and calendar exports.

Integration checks use a dedicated test database. Eight simultaneous requests produce exactly one booking. Direct overlapping SQL inserts fail at the database level. Tests also verify email/booking atomicity, hashed cancellation tokens, invalid tokens, consent/spam validation, idempotent cancellation, slot release and actual SMTP delivery through Mailpit.

Browser scenarios verify three localized home pages and all nine legal pages, language switching, canonical metadata, selecting an available date and time, booking, rejecting a repeated request, ICS export, cancellation, cross-origin rejection, admin authorization/login/logout, price editing, holiday closures, contact form delivery to the queue and localized copy editing. The browser test restores the settings it changes. Screenshots: [desktop](screenshots/desktop.png), [mobile](screenshots/mobile.png).

## Lighthouse

A local mobile Lighthouse run on the production build at `/en` returned:

| Category       | Score |
| -------------- | ----- |
| Performance    | 100   |
| Accessibility  | 100   |
| Best practices | 100   |
| SEO            | 100   |

LCP 0.9 s; CLS 0; total blocking time 90 ms. These are local measurements, **not a guarantee of production performance**. Re-run with the final domain, TLS proxy, real hosting and content. Automated accessibility checks do not replace keyboard, assistive-technology and human review on all devices.

## External configuration limits

No production server, domain or real SMTP credentials were used. Mail acceptance was tested with Mailpit, not external inbox placement. Google Calendar exports are implemented; automatic account synchronization requires a separate authorized integration. Legal/controller/processor details, actual prices, contacts, yearly holidays, backups and production monitoring require operator configuration. GitHub Actions is configured to repeat automated checks on pushes and pull requests.
