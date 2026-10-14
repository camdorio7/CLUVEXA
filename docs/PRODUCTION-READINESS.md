# NADORIO: path to a production pilot

The recommended first release is the core platform, organization administration, staff/member access, events, announcements, and public websites. Payments, reservations, automation, and a full booking engine are separate product work, not configuration switches. See V11-AUDIT.md for the complete scope.

## Changes in this hardening pass

- Login recovers from network/configuration failures and distinguishes missing access from failed access queries.
- A server `/auth/callback` exchanges PKCE codes, honors the SDK's flow-specific verifier, preserves session cookies, and rejects off-site redirects. Relative redirects preserve the incoming browser origin behind hosting proxies.
- Invitations explicitly support new accounts, existing accounts, email-confirmation pending, and the wrong signed-in account. Invalid invitation errors are no longer reported as successful account creation.
- Password recovery has an actionable expired-link state, matching-password validation, and an explicit busy/retry state. Signup, invitations, and recovery all use the callback.
- Browser Supabase requests, proxy authorization requests, callback exchange, and platform health requests have a 12-second timeout per fetch attempt. Cancellation is preserved. This helper does not retry writes; SDK-internal authentication retry behavior still applies.
- Platform dashboard loads only the 12 most recent organizations; exact organization/active/member totals are queried independently from displayed rows. This bounds the payload, not the database cost of an exact count at very large scale.
- The proxy exposes an `authorization` Server-Timing duration to diagnose authorization latency without logging credentials or skipping permission checks.
- Portal error boundaries provide retry controls. Dependency versions are pinned to the already verified lockfile and Node 24 is declared.
- GitHub Actions checks the release, unit tests, disposable PostgreSQL migrations/RLS, browser flows, TypeScript, and production build. The workflow uses fixtures and a disposable database; it requires no production secrets.

## Required deployment configuration

1. Choose one stable production domain in Vercel. Set `NEXT_PUBLIC_APP_URL` to that exact HTTPS origin and redeploy. A changing deployment-specific URL should not be the canonical email-link destination.
2. In Supabase Authentication URL Configuration, set Site URL to the same origin. Add the callback URL to Redirect URLs, allowing its query parameters: `https://YOUR-DOMAIN/auth/callback**`. Keep this pattern restricted to your exact production host; add separate controlled staging origins if needed. Keep the previously used join/reset URLs during the transition for already-sent email links.
3. Confirm that Supabase email templates use `{{ .ConfirmationURL }}` or an equivalent verified flow which preserves the supplied redirect. These PKCE flows must be completed in the browser where signup or recovery started. Configure Supabase's own SMTP/confirmation delivery separately from the app's Resend announcement/invitation API.
4. Keep the existing Supabase URL/anon key, server-only service role key, Resend key, and verified sender configured. Never use service-role credentials in browser variables.
5. Migration 019 is still the required schema. The user reported that it has been applied; this environment cannot independently query that deployment. This hardening pass adds no SQL migration.
6. Confirm the new GitHub Actions run succeeds. Require `validate` for pull requests using branch protection. Vercel's direct main-branch auto-deploy may start before CI completes; adding this workflow alone does not configure deployment gating or branch protection.

## Launch gate

| Gate              | Evidence required                                                                                                      | Current limitation                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment        | Vercel Ready on the intended commit/domain; login, authenticated health and public website load                        | Deployment URL is blocked by this workspace's network proxy; live behavior is not independently verified here                               |
| Account lifecycle | Real signup/confirmation, existing-account invite, expired/wrong-account invitation, reset-password email and sign-out | Local automated Auth tests use fixtures; mailbox delivery and hosted Auth still need testing                                                |
| Tenant boundaries | Two unrelated organizations, each role, disabled licenses, revoked grants, and direct URL/REST attempts                | PostgreSQL suite verifies checked-in policies with local Auth/storage shims; existing hosted data/custom policies need staging verification |
| Daily workflows   | Create member, review application, clock in/out, publish/register/cancel event, check in, publish a website            | Use a small controlled pilot and record actual results                                                                                      |
| Email and contact | Two real recipient mailboxes show isolated recipients; inquiry enters only its intended organization's inbox           | Real provider delivery, sender reputation, and rate limits are not tested by fixtures                                                       |
| Recovery          | Backups enabled, a restore rehearsal completed, known rollback steps, an identified operator                           | Cannot configure or certify backups without project access                                                                                  |
| Monitoring        | Vercel runtime errors, Supabase errors, uptime alerts, and Core Web Vitals reviewed by an owner                        | Local retry UI is not an alerting/incident-management service                                                                               |
| Scale             | Representative customer data, slow-network/mobile measurements, and expected peak concurrent requests                  | No production load benchmark has been run                                                                                                   |

## Speed targets and next optimizations

Measure before expanding caches: target p75 LCP at or below 2.5 s, INP at or below 200 ms, and CLS at or below 0.1. For portal clicks, record p50/p95 route timings and separate the authorization Server-Timing value from page data and browser rendering. Test on real mobile and a throttled network.

Keep Vercel compute near the Supabase database region. Paginate or virtualize other large organization/member/event lists as representative data exposes bottlenecks. Check database query plans and relevant indexes before adding caches. Never reuse authorization results between users/organizations or make membership revocation depend on a long browser cache.

For large announcement audiences, implement a durable delivery queue with idempotency, provider retries, delivery status, and background jobs before treating bulk email as scalable. Online payments need an actual provider integration, signed/idempotent webhooks, reconciliation, failed-payment handling, and sandbox-to-live acceptance tests. Reservations need inventory, overlap/concurrency controls, cancellation policies, and notifications.

## Recommended release sequence

1. Finish the live configuration and launch gate with controlled accounts in two organizations.
2. Run a limited pilot using the supported core workflows, capture errors/slow routes, and fix those findings.
3. Open production to additional organizations once restore, monitoring, permission revocation, and daily workflows have evidence.
4. Add payments or booking as a separately tested release if they are required for the next customer cohort.

This is a production-readiness improvement, not a declaration that every advertised module is complete or that hosted production has passed acceptance.
