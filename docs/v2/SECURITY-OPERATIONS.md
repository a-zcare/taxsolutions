# Security and privacy acceptance

This implementation is not a GDPR certification or a substitute for the controller's legal review. Do not upload financial documents or identity documents through booking, comments or email. Test only with synthetic data.

## Controls and boundaries

Owner manages staff, data exports and erasure. Admin manages operational records and settings. Accountant sees assigned records and linked clients, with server checks on every workspace action. MFA uses TOTP with replay prevention; opaque revocable sessions expire after eight hours. Mutating browser APIs require an exact configured Origin. Cookies are HttpOnly, Secure in production, SameSite Strict; OAuth uses a separate short-lived Lax browser-binding cookie plus one-use state/PKCE. React renders text as text. Prisma parameterization and bounded server validation protect data paths. Provider HTTP requests have fixed HTTPS endpoint allowlists and timeouts.

Audit events contain actor/object identifiers and changed field names, not free text. The application cannot alter them; DBA access remains privileged and must be separately controlled. Staff are deactivated rather than deleted. Deactivation revokes sessions. Before offboarding a connected staff member, cancel/reassign their meetings and revoke OAuth grants at the provider, then disable the user. Local disconnect removes stored tokens but does not revoke the remote authorization grant.

OAuth secrets and MFA material use authenticated encryption, bound to record context. Database disks are not application-level encrypted for every CRM field: use provider disk encryption, restricted host access and encrypted off-host backups. A compromised application host can read active secrets; MFA does not prevent host compromise. No customer data is sent to AI services.

## Data inventory and retention

Booking: name, email, phone, language, time, service, format, optional non-sensitive comment and consent timestamp. CRM: contact details, assignments, operational tasks/comments and inquiries. OAuth: encrypted access/refresh credentials and meeting join links. No recording/transcription enabled by default.

Worker retention: ended bookings 180 days (remote meetings must be cleaned up first), inquiries 180 days, sent mail 30 days/all mail 180 days, closed eligible tasks 365 days; expired sessions, flows and rate buckets are removed. Client records are not automatically deleted while relationships may be active: Owner reviews dormant clients and uses scoped export/erasure. Configure and document the controller's legal retention policy before production. Audit retention and backup expiry require a separate approved DBA/operator policy; the application cannot silently delete audit history. Deleted data remains in historical encrypted snapshots until their approved expiry. Record erasure requests and prevent restored snapshots from reintroducing previously erased records.

Owner erasure requires exact email confirmation and blocks active appointments or uncleared external meetings. It deletes linked operational data; retained audit identifiers are pseudonymous, not guaranteed anonymous. Exports contain personal data: restrict access, deliver securely, never attach to ordinary email. Verify requester identity outside the public booking form before linking an existing CRM client by email.

## Controller launch checklist

Replace demonstration company/contact/pricing/legal text with verified information. Record processing purposes and lawful bases; review whether consent is appropriate for each purpose. Publish retention, rights/contact process and actual processors. Sign applicable processor agreements and assess international transfers/subprocessors, especially video services. Define breach response, access reviews, retention review and backup access owners. Do not claim WCAG conformance until a complete manual accessibility audit is done; automated checks cover only part of WCAG.

Potential processors, only when enabled: EU VPS operator; independently hosted EU backup destination; SMTP provider; Google/Microsoft/Zoom for meeting metadata and participants. Meeting creation avoids booking comments and financial data. Provider account region, telemetry and participant data handling require review. No external AI processor is used.

## Recovery and incident response

Store Owner authenticator recovery material offline. There is no public MFA reset endpoint; an authorized operator must verify identity, use a reviewed database maintenance procedure to replace encrypted TOTP material, revoke all sessions and record the intervention. Keep two separately secured Owner accounts once staff onboarding is tested. Do not weaken MFA to regain convenience.

On suspected compromise: restrict ingress, revoke sessions/provider grants, preserve minimal evidence securely, rotate affected secrets through a controlled process, restore a verified clean image and database as appropriate, and follow the controller's notification obligations. Do not dump personal data into issue trackers or logs.

## External acceptance still required

Real Google/Teams/Zoom account permissions, license limits, OAuth consent and callback behavior; real SMTP deliverability; host firewall/TLS and off-host monitoring; scheduled backup storage and disaster recovery; manual keyboard/screen-reader/mobile audit; controller-approved retention and legal text. Mock-provider tests do not prove live provider compatibility. Keep providers disabled until these checks succeed. Zoom ambiguous creation is held for operator reconciliation to prevent duplicate paid/remote resources.
