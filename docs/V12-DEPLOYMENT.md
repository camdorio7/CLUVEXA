# NADORIO v12 release candidate

Organization software subscriptions come first. Member dues are not included in this release.

## Release order

1. Create a Supabase staging project and a Vercel preview using separate test credentials. Keep production and staging Stripe customers, webhook secrets, Resend keys, and databases separate.
2. Take a recoverable database backup and rehearse restoring it to a separate project. A successful local migration test is not evidence of a production backup or restore.
3. Apply the **entire** `supabase/migrations/020_nadorio_v12_operations.sql` after migrations 001–019. It is one transaction; do not paste individual `IF` statements outside their functions. The migration is intended to run once.
4. Deploy the matching v12 application to staging and complete the checks below.
5. Schedule a short maintenance window for the production migration and matching application promotion. Migration 020 restricts direct website writes: the old builder cannot save after it is applied. New portal tools require 020. Deploy these together.
6. Verify `/api/health` returns HTTP 200, then run the live smoke checks. Record the deployed Git SHA, migration, and test evidence.

The release is a candidate until live identity, billing, mail, and backup checks pass. Production credentials and provider administration must be configured by the project owner; they are never entered into chat or committed to Git.

## Vercel environment variables

Keep these as server-only variables unless their names explicitly start with `NEXT_PUBLIC_`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Target Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project public key |
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS deployment origin; used for billing redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | Server jobs and provider webhook updates |
| `STRIPE_SECRET_KEY` | Stripe test key in staging; live key in production |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this deployment's Stripe endpoint |
| `NADORIO_STRIPE_PLANS` | JSON map of approved software plans to recurring Stripe price IDs |
| `RESEND_API_KEY` | Email sending key for a verified domain |
| `RESEND_WEBHOOK_SECRET` | Resend/Svix endpoint signing secret |
| `NADORIO_EMAIL_FROM` | Verified sender, e.g. `NADORIO <notifications@your-domain.com>` |
| `NADORIO_REPLY_TO` | Optional fallback reply address |
| `CRON_SECRET` | Random secret of at least 24 characters for worker and operational monitoring |

Example **non-secret** plan mapping (replace example IDs with real recurring prices):

```json
{"professional":{"price":"price_REPLACE","name":"Professional"},"enterprise":{"price":"price_REPLACE2","name":"Enterprise"}}
```

Stripe is authoritative for pricing, currency, and recurrence, shown in Checkout before payment. Platform module licensing remains a separate CD7-controlled setting. Changing a subscription does not silently grant or revoke module permissions.

Webhook secrets must be available as actual runtime values: signature verification uses them locally. Proxy-only outbound placeholders cannot verify incoming signatures.

## Stripe setup

- Create recurring products/prices and configure the plan map. Do not reuse member-dues prices.
- Enable Stripe Customer Portal for the same account and mode. Configure payment method changes, invoice access, cancellation policy, and allowed subscription price changes.
- Add endpoint `https://YOUR-DOMAIN/api/webhooks/stripe` with API version `2024-06-20` and events `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `invoice.voided`.
- Test subscription checkout, cancellation before paying, retried checkout, failed card, successful payment, invoice link, portal plan change, scheduled cancellation, and immediate cancellation.
- Verify the subscription row changes from the webhook, not from visiting the success URL. Repeat the same event and send an older event; state must remain correct.
- Checkout reservations expire after 35 minutes and prevent competing plans or duplicate sessions. If the initial provider request fails before creating a session and the reservation has fewer than 30 minutes left, Stripe may require waiting until expiry before starting a new checkout. Existing sessions remain recoverable through idempotent retries. Reconcile uncertain provider outcomes in Stripe before initiating a replacement manually.
- Unknown customers are ignored; conflicting live subscriptions are rejected for operator review. Monitor webhook delivery failures in Stripe and resend after resolving the cause.

## Email scheduling and delivery

The application queues one private delivery per recipient. A queued or accepted message is not reported as delivered. Delivery/bounce webhooks determine that state.

1. Verify the sender domain in Resend and configure SPF/DKIM/DMARC for that domain.
2. Add `https://YOUR-DOMAIN/api/webhooks/resend` for `email.delivered`, `email.bounced`, and `email.complained`; save its signing secret.
3. Schedule an authenticated **GET** to `/api/jobs/email` every minute using `Authorization: Bearer <CRON_SECRET>`. Use Vercel Pro cron or an authenticated external scheduler. Vercel Hobby's daily cron limit is unsuitable for timely email and event reminders. No incompatible cron schedule is forced into the repository's Vercel configuration.
4. For Vercel Pro, merge the following into `vercel.json`, then redeploy after adding `CRON_SECRET`:

```json
{"crons":[{"path":"/api/jobs/email","schedule":"* * * * *"}]}
```

The worker handles up to 20 messages per invocation, with a time budget and pacing for provider rate limits. It retries transient failures up to five attempts and expires uncertain work after 23 hours, inside Resend's 24-hour idempotency window. Do not manually reset exhausted jobs or reuse their keys after this window; reconcile with Resend first. Larger audiences need monitored queue capacity and a dedicated/rate-coordinated worker before promising short delivery times. Overlapping invocations use row leases but provider rate limits still apply globally.

Event registration, waitlist promotion, cancellation, schedule/location changes and 24-hour reminders use the same queue. Already accepted or in-flight mail cannot be recalled; later updates send a correction. Emails queued while the scheduler is disabled remain pending until it is configured, or expire after the retry window. Confirm delivery in staging before inviting a live audience.

## Website and member operations

- Draft saving preserves the current live website. Publish is explicit, validates required content, and uses an optimistic version check. Reload after a conflicting editor save; do not overwrite blindly.
- Revision history retains the last 50 saves. Loading a revision into the editor does not publish it. Preview URLs require administrator access.
- Hero uploads are resized to 1,600 pixels, converted to WebP, and placed in the existing organization-scoped branding bucket. Direct external image URLs are not optimized by NADORIO. Uploaded assets are public: use only public website imagery.
- CSV imports accept 1–500 rows with `full_name,email,phone,member_number`. Review validation before importing; invalid batches add no records. Duplicate email/member numbers are rejected within a file and against current organization records. Imports do not create authentication users or send invitations automatically.
- Membership status/standing controls eligibility; login access is independently managed in People & roles. Review both when offboarding someone.
- Existing member records are preserved, including historical duplicate emails. New inserts or email changes cannot introduce duplicates. Resolve historical duplicates explicitly before merging identities.

## Monitoring and live acceptance

- Public uptime: `GET /api/health` must return 200 and release 12. It checks database connectivity and migration readiness, not all provider services.
- Private operations: `GET /api/operations/health` with the cron bearer secret. Alert on non-200 responses. It flags a worker heartbeat older than 10 minutes, email backlog older than 15 minutes, and delivery failures in the last 24 hours. It exposes counts, not recipient information.
- Set repository variable `NADORIO_HEALTHCHECK_URL` to the **full HTTPS health URL** to activate the optional scheduled uptime workflow. GitHub cron is best effort, not a replacement for a dedicated uptime service. Configure the service owner's normal failure notifications.
- Monitor Vercel function errors, Supabase resource/error logs, Stripe webhook failures, and Resend delivery failures. Avoid logging tokens, raw payment payloads, or member message bodies.
- Rehearse signup/email verification/password reset, invitation acceptance, two-organization isolation, staff permissions, mobile navigation, CSV import, waitlist promotion, website draft/publish/restore, contact submission, and real test-mode checkout.
- Measure production navigation and Core Web Vitals on a real organization dataset. Local fixture tests demonstrate behavior, not real-world latency. Start with p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 and investigate violations before broad rollout.

## Deployment gate and recovery

`Validate release` runs release checks, unit tests, all historical migrations and database authorization tests, browser workflows, type checks, and the production build. Require this check in GitHub branch protection. Use Vercel deployment checks or manual promotion of the validated preview; CI cannot gate a separately configured automatic deployment by itself.

For an application failure after migration, prefer a tested forward fix. Do not roll back to the old site builder while 020's RPC-only publishing policies are active. Restore the pre-release database and matching application together only under a planned recovery procedure; doing so can lose writes since the backup. Pause the email scheduler and checkout during recovery, then reconcile provider events before resuming. Keep the old Vercel deployment available until live smoke checks pass.

Deferred live work: actual provider credentials/configuration, payment and delivery verification, staging promotion, backup restoration, alert destinations, and production load measurement. Repository changes do not complete these external steps.

## Existing-table conflict during migration

Migration 020 now supports the inspected legacy `organization_subscriptions` definition: an `id` primary key, a unique `club_id`, commercial amount/interval fields, and `external_customer_id` / `external_subscription_id`. It preserves existing rows and original fields, adds the v12 provider/job columns, and copies recognizable Stripe `cus_…` and `sub_…` identifiers into the new fields. Original external-ID fields remain historical values; v12 uses `customer_id` and `subscription_id` going forward.

Existing plans/statuses remain intact. New records default to `unconfigured`; unknown provider price mappings can use a null plan. The old `subscriptions tenant` write policy is removed, direct client write privileges are revoked, and administrator-only reads are used. Server webhooks remain responsible for provider state. Unknown external billing identifiers require platform reconciliation before checkout; active legacy statuses continue to block a second subscription. Duplicate Stripe IDs stop the transaction for review instead of deleting or merging records.

For the previously reported conflict, copy the **entire revised 020 file** into a fresh SQL Editor query and run it after the backup/staging steps above. No table deletion or separate cleanup patch is needed for the supplied schema. A failed full-file transaction does not leave the preceding v12 tables committed; the supplied diagnostic confirmed those tables and `v12_health()` were absent.

If another schema conflict occurs, run the read-only [schema diagnostic](../supabase/diagnostics/v12-existing-schema.sql) and return its result. Do not drop a table or skip an unfamiliar definition with `IF NOT EXISTS`. Keep the application on its existing production version until the compatible migration succeeds.
