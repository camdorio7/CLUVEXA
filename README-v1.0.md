# NADORIO v1.0 — Multi-tenant Organization Platform

This build turns the v0.7 foundation into a full organization/account structure.

## What is included
- CD7 Platform Owner can create, suspend, archive and permanently delete organizations.
- Every organization has isolated club users, members, staff/admins, modules, branding and operational data.
- Organization admins can upload their logo and customize primary, accent, background, card and text colors.
- CD7 controls module licensing. Club admins can only enable/disable modules CD7 has licensed.
- Staff/Admin invitation links and member login invitation links.
- Invitees create their own Supabase Auth login through `/join?token=...` and are automatically attached to the correct organization and role.
- Separate branded organization workspace for owner/admin/manager/staff/member roles.
- Dynamic navigation based on licensed/enabled modules and per-user module permissions.
- Functional member creation/removal, login staging, staff/admin management, event creation/deletion, existing Tee Sheet configuration, and club branding.
- Existing LINDEX integration remains in the Platform Owner side.

## Database
Run only:
`supabase/migrations/006_complete_organization_accounts.sql`

Do not rerun migrations 001-005 if they are already installed.

## Login flow
1. CD7 creates an organization and licenses modules.
2. Club admin invitation is created from Staff & Admins (or onboarding).
3. Copy the generated `/join?token=...` link to the invitee.
4. Invitee creates their own account using the invited email.
5. NADORIO attaches the account to the organization and role.
6. Club admins can add staff and members and create their login invitations.

Email delivery can be added later through Resend; the secure invitation/token/account system is already in place.
