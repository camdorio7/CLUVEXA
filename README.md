# CLUVEXA v0.6 — Platform Owner + Club Workspaces

This release establishes the commercial multi-tenant hierarchy:

- CD7 Platform Owner console for all customer organizations
- Organization cards use each club's `logo_url`
- CD7 controls module licensing per club
- Club admins/staff receive a separate organization workspace
- Club navigation is generated only from licensed + club-enabled modules
- Module catalog includes Events, Tee Sheet, Golf, Access, Amenities, Staff, Time Clock, Operations, Communications, Payments, Reports and Connected Platforms
- User/module permission foundation and audit log
- LINDEX remains an independent connected platform for Linderhof
- Dark blue/cyan/violet CLUVEXA design system with CD7 Technologies branding

## Required database step
Run `supabase/migrations/004_platform_owner_modules_permissions.sql` once in the CLUVEXA Supabase SQL Editor after deploying.

## Existing environment variables
Keep the working v0.5 LINDEX integration variables unchanged.

## Important permission model
CD7 Platform Owner -> Club license -> Club enabled -> Staff/member permission.
A club cannot enable a module that CD7 has not licensed to it.


## v0.7
See `README-v0.7.md`. Run migration `005_onboarding_tee_sheet.sql` after deploying.


## v0.7
See `README-v0.7.md`. Run migration `005_onboarding_tee_sheet.sql` after deploying.
