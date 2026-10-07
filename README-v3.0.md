# NADORIO 3.0

Major club-experience restructuring release.

## New in 3.0
- Member self-enrollment: members choose an active NADORIO organization, create an account, verify email, and request access.
- Club-admin approval queue: no self-enrolled member receives club access until an owner/admin approves the request.
- Approval automatically creates/links the member record and grants the `member` club role.
- Pending member status page and login routing for accounts awaiting approval.
- Responsive member onboarding built for iPhone and desktop.
- Reorganized Club Workspace navigation into Membership, Club Life, Team & Operations, Engage & Insights, and Administration.
- Dedicated People & Approvals workspace for club administrators.
- Cleaner NADORIO 3.0 dashboard and member portal presentation.
- Mobile club navigation and member bottom navigation.
- Club-specific logo, colors, portal title, welcome message and licensed modules continue to drive each organization's experience.
- LINDEX remains an independent connected platform; no LINDEX migration is included.

## Deployment
1. Upload this release to the existing GitHub repository and let Vercel deploy it.
2. In Supabase SQL Editor, run ONLY `supabase/migrations/012_nadorio_v3_member_enrollment.sql`.
3. Do not rerun migrations 001–011.
4. Keep the existing Vercel/Supabase/Resend configuration from v2.1.4.

## Recommended test
1. Visit `/member/join` logged out.
2. Choose a club and create a new member account.
3. Verify the email.
4. Confirm the member sees the Waiting for club approval screen.
5. Sign in as a Club Admin and open People & Approvals.
6. Approve the request.
7. Sign in as the member and confirm they land in that club's customized member portal.
