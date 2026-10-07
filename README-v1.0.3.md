# NADORIO v1.0.3 — Platform Owner Workspace Access

Fixes Platform Owner entry into club workspaces.

- Platform Owners are recognized through the database `is_super_admin()` security helper.
- A Platform Owner does not need a `club_users` membership in each organization.
- Club admins, managers, staff, and members remain tenant-scoped through `club_users`.
- The existing **Enter Club Workspace** action now works with Platform Owner access.
- No new Supabase migration is required.

Deploy by replacing the repository files with this package and allowing Vercel to redeploy. Do not rerun old SQL migrations.
