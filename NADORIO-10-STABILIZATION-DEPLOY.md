# NADORIO 10.0 — Stabilization update

## Deploy order
1. Back up the Supabase database and review `supabase/migrations/016_nadorio_contact_protection.sql`.
2. Apply that migration in the NADORIO Supabase project (after migration 014).
3. Copy the changed app and script files to the same paths in GitHub.
4. Deploy to a Vercel preview environment first, then Production after verification.

## Changes
- Announcements use Resend's batch API with **one distinct message per recipient**; members cannot see other recipients' email addresses.
- Partial delivery failures return HTTP 502 and counts; logs still capture totals.
- Announcement subject/body size validation.
- Contact form database rate limits: 5 submissions per email per organization per hour, 100 total per organization per hour. The server returns HTTP 429 when exceeded.
- Public website lookup errors return 503 rather than masquerading as unpublished websites.
- Release script checks that email delivery does not regress to shared `to` recipients.

## Verification
- `npm run check:release` and `npm run typecheck`; run `npm run build` with dependencies and environment configured.
- Send a test announcement to at least two **consenting** test addresses. Confirm each receives an individual email and does not see the other address.
- Submit a website contact inquiry and confirm it appears in the correct organization's Email Center.
- Send six test inquiries from one test email within one hour; the sixth should return 429.
- Verify member, staff, admin and platform-owner workflows in two different organizations.
- Check Vercel function logs and Resend logs for failures.

## Limitations
This patch does not certify all modules, billing, website domains, or staff/member flows as production ready. Database trigger limits can be bypassed by changing sender email, so edge/WAF rate limiting and CAPTCHA should be added before unrestricted public traffic. The Resend API key and verified sender domain must be configured for announcements. This release requires live Supabase and Resend verification.
