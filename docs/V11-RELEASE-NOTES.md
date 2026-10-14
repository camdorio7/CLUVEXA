# NADORIO 11.0.0-rc.1

This release consolidates the existing NADORIO application into a shared organization model and a consistent platform/admin/staff/member experience.

- Central organization types, terminology, module availability, navigation, licensing, and capabilities.
- Server session verification and database-enforced tenant isolation, role grants, event capacity, invitation identity, and audit records.
- Responsive portals with compact dashboards, organization switching, and distinct staff/member navigation.
- Functional platform catalog, membership administration, manual billing records, support register, and honest health status.
- Universal website publication with per-page drafts, safe public data projection, mobile navigation, and protected contact inquiries.
- Recipient-private announcement delivery, administrator invitations with visible fallback, and scoped integration access.
- Repeatable unit, PostgreSQL authorization, browser, type, release, and production-build checks.

Migration 019 and coordinated app deployment are required. The package is a changed-files overlay on the source repository, not a standalone source distribution. Keep existing unchanged files, install from the included lockfile, and read V11-DEPLOYMENT.md before applying it.

Unsupported modules and external-service limitations are explicit in V11-AUDIT.md. Payment processing, a booking engine, full document/reservation systems, automated workflows, and live-service certification are outside this release candidate.

## Navigation update

Platform pages now share a persistent `(platform)` route-group layout; public URLs are unchanged. The per-page browser authorization splash has been removed while the server proxy and database policies continue to authorize requests. Organization shell data stays available during explicit refreshes.

All portal sidebars use visible groups, icons, descriptive links, a subtle current-page highlight, and intent-based prefetching. The brand and account controls stay fixed while long navigation lists scroll. Pending navigation is shown beside the selected link, with page-only loading placeholders for slower routes. Mobile navigation supports Escape, closes after routing, and moves keyboard focus to the content.

Validation: 18 browser checks, including persistent navigation for platform/admin/staff/member, browser back, direct access denial, and mobile focus; TypeScript and production build. No database migration is required for this update.

## Production hardening update

Account signup, invitations and password recovery now use a dedicated PKCE callback. Existing invitees can sign in explicitly; new invitees see the real confirmation state. Login and recovery expose retryable errors. Portal error boundaries recover failed page renders, selected upstream requests have timeouts, and dashboard organization data is bounded to 12 recent records with independent totals.

Dependencies now use the verified exact versions, and a GitHub Actions workflow validates future changes. Add the production callback redirect to Supabase before relying on the new email flows. See PRODUCTION-READINESS.md for the exact configuration, live acceptance gates, performance targets, and remaining product work. No additional SQL migration is needed.
