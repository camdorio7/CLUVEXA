# CLUVEXA 2.0
Complete native club-management release.

## New/finished areas
- Club Admin dashboard with live operational counts
- People, staff/admin invitations and tenant access
- Membership plans and member records
- Access/check-in and guest passes
- Events with capacity, deadline, price and payment URL
- Tee-sheet settings and bookings foundation
- Golf tournament management
- Staff time clock and hours history
- Operations task board
- Communications/announcements
- Reports with live KPI summary and CSV exports
- Amenities management
- Club branding/settings and licensed-module controls
- Platform Owner access remains cross-organization; tenant users remain scoped to their club
- Existing LINDEX connected-platform architecture remains intact

## Deploy
1. Upload this release to GitHub and allow Vercel to deploy.
2. In Supabase SQL Editor run ONLY `supabase/migrations/008_cluvexa_2_0_suite.sql` if 007 has already been run.
3. Do not rerun migrations 001–007.
