# Video provider activation

All real providers are disabled by default. The common interface supports create/update/cancel. Mock is restricted to APP_ENV=test plus ENABLE_MOCK_VIDEO=true. Unit tests use mocked HTTP; live account acceptance remains required. No recording or transcription is requested. A consultation stays pending until a valid unique join URL is stored; clients are not sent an unusable confirmation.

Register **Web** OAuth apps. Exact callback: `https://YOUR_DOMAIN/api/oauth/google/callback` (or microsoft / zoom). Configure consent, permitted test users, region and applicable processor terms. Use separate staging apps/secrets. Never paste access or refresh tokens into environment files; obtain through the authenticated workspace OAuth flow. Set comma-separated `VIDEO_ENABLED_PROVIDERS` only after staging succeeds.

| Provider | Required configuration | API and account constraints |
|---|---|---|
| Google | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; enable Calendar API | Delegated calendar.events scope; Calendar primary event with Meet conference data. Check actual account conference creation capability, consent verification and quotas. Deterministic event ID and conference request ID support retry reconciliation. |
| Microsoft | MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID (tenant UUID) | Delegated offline_access + OnlineMeetings.ReadWrite. Work/school account required; personal accounts unsupported. Tenant Teams policies and organizer entitlement must be verified. App-only flow is not implemented. createOrGet uses stable externalId; standalone meeting does not appear in organizer calendar automatically. |
| Zoom | ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET | General user OAuth app and meeting create/read/list/update/delete granular scopes listed in oauth.ts. Check host plan, duration/concurrency restrictions and app approval. Stable topic enables recovery lookup; ambiguous creation stops for operator review rather than blindly recreating. |

Do not assume meeting duration, host licensing or API features are universally free. No subscriptions are purchased by this app. Operator must compare the current account plan with configured service durations before enabling online booking.

Acceptance for each enabled provider: authorize correct staff account; reject invalid state and callback; expire/reuse state; refresh token; create one synthetic consultation twice without duplicate remote meetings; reschedule; cancel; exercise 401/429/timeouts; verify recording off, waiting/lobby policies and participant access; revoke authorization and confirm safe failure. Check actual API responses and provider UI. Delete synthetic remote meetings afterwards.

Jobs have bounded retries, leases and attempt fencing. Google/Teams use provider idempotency identifiers. Zoom has no assumed exactly-once create guarantee: NEEDS_REVIEW requires an operator to reconcile the remote account. Local token disconnect does not remotely revoke the provider grant; revoke it in the provider's account portal as well. Cancel meetings before disabling staff or revoking their tokens.

Official references reviewed during implementation:
- https://developers.google.com/workspace/calendar/api/guides/create-events
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- https://learn.microsoft.com/en-us/graph/api/onlinemeeting-createorget?view=graph-rest-1.0
- https://developers.zoom.us/docs/integrations/oauth/
- https://developers.zoom.us/docs/api/meetings/
