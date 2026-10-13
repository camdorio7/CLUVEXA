# NADORIO 10.0 release readiness (RC1)

This patch repairs a missing source-controlled database migration and adds repeatable repository checks. **It does not certify the whole platform as production-ready.**

## Deploy
1. Back up the Supabase database. Review and run `supabase/migrations/014_nadorio_universal_websites.sql` only if the equivalent website tables/policies are not already installed. If migration 014 was previously run from an earlier ZIP, compare definitions before reapplying; this script drops and recreates only the named website/inbox policies.
2. Copy changed files preserving paths. Run `npm install`, `npm run check:release`, `npm run typecheck`, and `npm run build` in an environment with valid configuration.
3. Confirm Vercel has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` configured for the deployment environment.
4. In CD7, license/enable Website Builder and Email Center for a test organization. Test draft -> publish -> public visit -> inquiry -> admin inbox -> unpublish.
5. Test CD7 owner, organization admin, staff, member, anonymous visitor, and users from a different organization. Confirm blocked routes and RLS enforcement.
6. Add durable abuse prevention (IP rate limiting / CAPTCHA) to the public contact endpoint before wide public launch. Review legal/privacy requirements, monitoring, backups, accessibility, email delivery, and custom-domain provisioning separately.

## Known remaining scope
- Website builder currently supports one basic public page, not a multi-page drag-and-drop site.
- Email Center is a stored-inquiry inbox with mailto replies, not a full email sending platform.
- Custom domains, automated email campaigns, templates, image uploads, billing, weather and complete platform-wide button verification are not proven complete.
- No live Supabase/Vercel tests were possible from this repository alone.

**Do not advertise NADORIO as fully operational until these workflows and the live deployment have passed acceptance testing.**
