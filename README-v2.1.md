# NADORIO v2.1 — Automated Email

Adds Resend-powered transactional email to NADORIO.

## New
- Club Admin / Manager / Staff / Member invitations are emailed automatically.
- Invitation fallback still copies the join link if email delivery fails.
- Communications can email announcements to staff, members, or everyone.
- Email Center shows recent NADORIO delivery activity.
- Club contact email is used as Reply-To when available.
- Branded NADORIO transactional HTML email templates.

## Vercel environment variables
Required: `RESEND_API_KEY`
Recommended: `NADORIO_EMAIL_FROM=NADORIO <notifications@nadorio.com>`
Optional: `NADORIO_REPLY_TO`
Recommended: `NEXT_PUBLIC_APP_URL=https://app.nadorio.com`

## Supabase
Run only `supabase/migrations/010_nadorio_email_center.sql` after prior migrations 001–009 have already been applied.
