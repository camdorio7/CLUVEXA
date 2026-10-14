# Deploying NADORIO v11 RC1

## Before deployment

1. Back up the database and storage metadata. Rehearse the upgrade against a staging copy containing representative existing organizations, members, licenses, and permissions.
2. Review `019_nadorio_v11_access.sql` against any custom policies/functions. It replaces core-table policies deliberately and tightens access. Existing unsupported features may become inaccessible; see V11-AUDIT.md. No organization/member records are intentionally deleted by this migration.
3. Install the locked dependencies with `npm ci`. Use Node 24, as used for local verification. Copy `.env.example` to a private environment configuration and fill in your own values. Never expose the service role key through a `NEXT_PUBLIC_` variable or commit credentials.
4. Required app settings: Supabase URL and anon key. Public contact insertion additionally requires the server-side service role key. Set `NEXT_PUBLIC_APP_URL` to the canonical application origin and configure Supabase allowed redirect URLs for signup, join, and password recovery. Configure Resend and a verified sender to enable delivery.
5. Apply historical migrations 001–018 in filename order only if not already applied. There are TWO different 010 migrations; both are required. Apply migration 019 once after those migrations. Do not rerun all historical migrations blindly on production.
6. Coordinate migration 019 and the new application deployment. Public website reads now use projection RPCs; old code and new database policies are not a supported mixed-version state. Schedule a controlled cutover after staging verification.
7. Run `npm run check:release`, `npm test`, `npm run typecheck`, and `npm run build`. Configure deployment environment variables before the build, because public Next.js variables are embedded at build time. Start with `npm start` in a non-production preview first.

## Local deeper checks

The database suite expects a running disposable PostgreSQL 16 Docker container named `nadorio-v11-db`, or set `NADORIO_TEST_CONTAINER`. It creates and drops a uniquely named test database in that container. It never points at the configured application Supabase URL. Run `npm run test:database`.

The browser suite runs its own Next development server and local fake Supabase service. Install Chromium and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if it is not `/usr/bin/chromium`. Run `npm run test:browser`. Ports 3100 and 54321 must be available. Do not substitute production credentials into these fixtures.

## Staging acceptance: two unrelated organizations

Use organization A (golf club) and B (HOA or school), with platform owner, each organization administrator, staff with differing grants, and member accounts. Use two controlled recipient mailboxes.

1. Sign in, sign out, recover a password from an actual email, and verify confirmation and expired-token messages. Verify redirects remain on the application origin.
2. Create an organization from a type preset; verify labels/defaults and override the recommended modules. Newly granted licenses must remain disabled until the administrator enables them.
3. Invite an administrator, staff member, and member. Accept with the intended verified email; reject another email, expired token, and token reuse. Check the copyable link fallback when email is unavailable.
4. Apply for membership on a public site, approve/reject the application, verify the selected membership level, and ensure approval cannot demote an existing active administrator.
5. Switch between authorized organizations. Change the URL to the unrelated organization's ID; verify denial in browser and direct REST calls.
6. Check platform catalog, profile membership administration, billing records, support cases, and health panels. Confirm manual billing is not represented as payment processing.
7. Enable and disable a licensed module. Revoke its license. Test sidebar removal, direct URL denial, and database mutation denial after each change.
8. Give staff view-only access, then create/edit/delete grants separately. Verify controls and direct database requests honor the grants. Staff must not manage their own permissions.
9. Verify ordinary members cannot access settings, staff administration, audit, Email Center, or private peer member fields. Check the directory's limited projection.
10. Create/edit a member and membership level. Try referencing another organization's level/member ID. Verify inactive memberships lose access on their next request.
11. Publish an event with a capacity/deadline. Register, cancel, and attempt concurrent final-slot registrations. Verify unpublished events and peer registrations stay private.
12. Clock in/out as staff; test duplicate open shifts, forged timestamps, and edits to another employee's records.
13. Create an operation, amenity, configured activity check-in, and golf tournament where licensed. Verify member versus guest validation and organization-specific terminology.
14. Send an announcement to the two controlled mailboxes. Inspect actual email headers: each message must contain only its own recipient. Verify accepted counts and partial-failure reporting.
15. Submit contact inquiries to A and B. Verify validation, honeypot behavior, rate limits, correct inbox routing, and no cross-organization visibility.
16. Publish website root/interior pages, leave another draft, and directly request the draft URL. Disable publication/license or suspend the organization; verify public content becomes unavailable.
17. Upload a logo within documented size/type limits. Attempt storage writes under another organization's path. Check readable branding with dark and very bright colors.
18. Test desktop, tablet, and phone navigation, keyboard focus, mobile menu, long names, forms, loading/error/empty states, and absence of horizontal overflow.
19. Export reports and inspect CSV escaping. Verify audit rows for role, license, website, and organization changes cannot be forged from a client.
20. If optional integrations are configured, perform a separately authorized staging publish/metrics check. Verify no LINDEX data can be served under another organization ID.

## Rollback and operational limits

Do not assume that reverting only application files reverses the new RLS/functions. Restore the known-good application and database together using a rehearsed backup/rollback procedure, or prepare an explicit forward correction. Migration 019 is transactional, but an already committed migration needs a planned rollback. Check existing invalid event data before validating the new NOT VALID constraints; new writes are already constrained.

No production migration, deployment, external website publication, or real email send was performed during this work. The release candidate should be approved for production only after the staging checklist passes with real service configuration.
