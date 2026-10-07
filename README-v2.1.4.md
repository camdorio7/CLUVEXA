# NADORIO v2.1.4

Fixes invitation validation for logged-out invitees while keeping `club_invitations` protected by RLS.

## Required migration
Run only `supabase/migrations/011_public_invitation_lookup.sql` after deploying. Do not rerun migrations 001–010.

The new `get_public_club_invitation` security-definer RPC returns only the minimal invitation and club-branding fields required by the public join screen. Invitation acceptance still requires an authenticated user and continues through `accept_club_invitation`.
