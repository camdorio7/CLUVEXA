# NADORIO 2.0 — Brand Migration

CLUVEXA has been renamed to **NADORIO**, a CD7 Technologies product.

## What changed
- User-facing CLUVEXA branding is now NADORIO across login, owner console, club workspaces, join/invitation copy, settings, reports, and metadata.
- The React logo component is now `NadorioLogo`.
- The npm package name is now `nadorio`.
- Existing LINDEX connectivity is preserved.

## Compatibility
Historical database identifiers, migration filenames, and integration environment-variable names are intentionally preserved where changing them could break an already-deployed installation. They are internal implementation details and do not affect the NADORIO brand shown to users.

## Deploy
1. Replace the current GitHub project files with this package and let Vercel deploy.
2. In Supabase SQL Editor, run **only** `supabase/migrations/009_nadorio_branding.sql` after migrations 001–008 have already been applied.
3. Do not rerun migrations 001–008.
4. Sign out and back in, then verify Platform Owner, organization, and club-workspace screens.
