# CLUVEXA v1.0.3.2 — Platform Owner Identity Repair

This patch fixes the login path that could report "This account does not have an active CLUVEXA organization" for the CD7 Platform Owner even though the workspace UI already supported `super_admin` access.

## Required Supabase step
Run **only** `supabase/migrations/007_platform_owner_access.sql` in the CLUVEXA Supabase SQL Editor after deploying this version. Do not rerun migrations 001–006.

Migration 007 guarantees that the existing CD7 Platform Owner Auth user has a matching `public.profiles` row with `platform_role = super_admin`, and refreshes the `is_super_admin()` helper used by login, the Platform Owner shell, workspace access, and RLS.

After running 007, sign out and sign back in. Platform Owner access does not require a `club_users` membership.
