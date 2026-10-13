# NADORIO 10.0 — Website Expansion & Release Hardening

## Deploy order
1. In Supabase SQL Editor, run `supabase/migrations/015_nadorio_website_pages.sql` (after the existing 014 migration).
2. Copy all other files in this ZIP to the same paths in the GitHub repository.
3. Deploy on Vercel. Existing environment variables remain unchanged.
4. In CD7 licensing, ensure `website_builder` and `email_center` are licensed and enabled for the test organization.
5. In Admin → Website Builder, create a page with a unique slug, save/publish, and verify `/site/<organization-id>/<slug>` is visible.
6. Verify unpublished sites are private and that unauthorized users cannot edit pages or read contact inquiries.
7. Send a test contact form inquiry and verify it appears in the Email Center; test searching it.

## Included
- Multi-page public sites with navigation and editable content
- Database validation for page slugs and content
- Inbox search for the 100 most recent inquiries
- Contact request-size limit even without Content-Length
- Expanded release-file checks

## Not included / not verified
- Custom domains, advanced template editor, image uploads, automated outgoing email campaigns, and production-grade anti-spam controls.
- Full Next.js production build and live Supabase permission / cross-tenant tests were not performed.
- This package is NOT a claim that the complete platform is production-ready.

## Known limitations
- Public pages are published with the parent site; there is no per-page draft workflow.
- Inquiry search covers only the 100 most recently loaded messages.
- The contact endpoint still requires production rate limiting, abuse monitoring and CAPTCHA or equivalent anti-spam protection before broad public launch.
