# NADORIO v12 release candidate

Multi-organization management for CD7, organization administrators, staff, and members. v12 adds organization subscriptions, validated member imports/history, queued email, event waitlists/attendance, website drafts/revisions, and operational health checks.

**Upgrade:** [v12 deployment and configuration](docs/V12-DEPLOYMENT.md). Apply the complete migration 020 after 019 and deploy the matching application in a coordinated window. Production activation requires configured providers and live acceptance checks.

**Development:** Node 24, `npm ci`, then `npm run dev`. Copy `.env.example` to your local configuration and supply your own environment values securely. Do not use production secrets for automated tests.

**Validation:** `npm test`, `npm run test:database` (PostgreSQL 16 Docker container named `nadorio-v11-db`, or set `NADORIO_TEST_CONTAINER`), `npm run test:browser` (Chromium), `npm run typecheck`, `npm run check:release`, `npm run build`. Browser fixtures and disposable database tests require no live credentials.

Historical notes below describe earlier releases; use the v12 deployment guide for current upgrade instructions.

---

# NADORIO v0.6 — Platform Owner + Club Workspaces

This release establishes the commercial multi-tenant hierarchy:

- CD7 Platform Owner console for all customer organizations
- Organization cards use each club's `logo_url`
- CD7 controls module licensing per club
- Club admins/staff receive a separate organization workspace
- Club navigation is generated only from licensed + club-enabled modules
- Module catalog includes Events, Tee Sheet, Golf, Access, Amenities, Staff, Time Clock, Operations, Communications, Payments, Reports and Connected Platforms
- User/module permission foundation and audit log
- LINDEX remains an independent connected platform for Linderhof
- Dark blue/cyan/violet NADORIO design system with CD7 Technologies branding

## Required database step
Run `supabase/migrations/004_platform_owner_modules_permissions.sql` once in the NADORIO Supabase SQL Editor after deploying.

## Existing environment variables
Keep the working v0.5 LINDEX integration variables unchanged.

## Important permission model
CD7 Platform Owner -> Club license -> Club enabled -> Staff/member permission.
A club cannot enable a module that CD7 has not licensed to it.


## v0.7
See `README-v0.7.md`. Run migration `005_onboarding_tee_sheet.sql` after deploying.


## v0.7
See `README-v0.7.md`. Run migration `005_onboarding_tee_sheet.sql` after deploying.

## v1.0.3.2
Platform Owner identity/access repair. Run only `supabase/migrations/007_platform_owner_access.sql` after 006, then sign out and back in.
