# v12 validation evidence

Validated locally on Node 24, Next.js 16.4, PostgreSQL 16, and Chromium. Provider credentials were absent; automated checks use fixtures and disposable databases.

| Check | Result |
| --- | --- |
| Release integrity | 65 checks passed |
| Unit tests | 25 passed |
| Browser workflows | 34 passed |
| PostgreSQL authorization/workflow assertions | 122 passed (63 existing + 59 v12) |
| Concurrent database scenarios | 5 passed |
| TypeScript | Passed |
| Production compilation | Passed |

Database tests apply every checked-in historical migration in order, including migration 020, before exercising real RLS as authenticated, anonymous, and service roles. The local bootstrap supplies lightweight Supabase Auth/storage schemas; it is not the hosted Supabase service.

Concurrency checks open separate database connections to race the last event seat, website saves, duplicate member imports, competing checkout plans, and email job claims. They verify outcomes under real PostgreSQL locks rather than mocking them.

Browser checks cover prior authentication and portal behavior plus launch checklist/billing navigation, CSV validation before import, draft-versus-published behavior, protected previews, waitlist interaction, calendar download, API role checks, and public/private health responses. UI provider responses are fixtures. Tests do not demonstrate a real payment, email delivery, hosted database migration, or production latency.

Unit checks include Stripe and Resend signature binding, timestamp replay windows, tampering, rotated signatures, CSV quoting and limits, calendar escaping/folding, private email addressing, retry idempotency, provider error classification, and invoice minor-unit formatting.

Reviewed mobile portal screenshot: navigation remains usable without horizontal overflow. Existing automated tests verify persistent desktop shells and mobile navigation closing/focus behavior.

## Still requires live evidence

- Supabase upgrade rehearsal against a copy of the actual data, followed by coordinated deployment.
- Real signup/verification/invitation/reset flows with the configured mail system.
- Stripe test-mode checkout, portal changes, invoices, failed payment, cancellation, and webhook replay against the deployed service.
- Resend verified sender, two mailbox recipients, delivery/bounce webhooks, and scheduled queue processing.
- Backup restore rehearsal, alert routing, production measurements, and GitHub/Vercel deployment gate settings.

See [V12-DEPLOYMENT.md](V12-DEPLOYMENT.md) for exact configuration and rollout order. Passing local tests does not establish that these external services are configured.

## Hosted legacy billing upgrade regression

The schema supplied in the production diagnostic is reproduced in `tests/database-legacy-billing.sql`. Run `NADORIO_TEST_LEGACY_BILLING=1 npm run test:database` to apply 020 to that definition, verify existing IDs, amounts, billing intervals and dates survive, verify Stripe identifiers are carried forward and tenant write access is removed, then run the same 122 database assertions and five concurrency scenarios. Both fresh-schema and legacy-schema runs passed locally. No hosted customer records were copied into the fixtures.
