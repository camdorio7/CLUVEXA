# NADORIO v4.1

Built from the stable v4.0 / v3.0.4 navigation baseline.

## Highlights
- Universal NADORIO sign-in continues to route authenticated users to their organization automatically.
- New-member registration now requires organization selection and a club-defined membership level.
- Club admins can create membership levels, pricing, billing periods, application notes, and decide which levels appear during online signup.
- Membership applications carry the requested membership level into People & Approvals.
- Approval assigns the selected membership level to the member record.
- Admin overview and People & Approvals redesigned with consistent LINDEX-inspired proportions, compact summary cards, clearer actions, and responsive mobile layouts.

## Database
Run only `supabase/migrations/013_nadorio_v4_1_membership_applications.sql` after deploying v4.1. Do not rerun migrations 001–012.
