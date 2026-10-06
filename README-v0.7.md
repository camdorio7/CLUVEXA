# CLUVEXA v0.7 — Club Onboarding & Management

v0.7 turns the v0.6 permission architecture into a customer onboarding workflow.

## Added
- Platform-owner club provisioning with plan, type, brand color and staged first-admin invitation.
- Club logo uploads through the `club-branding` Supabase Storage bucket.
- Club identity and brand settings.
- Platform-owner lifecycle controls: active, suspended, archived.
- Invitation foundation (`club_invitations`) for club admins/staff.
- Tee Sheet configuration: first/last time, interval, capacity, booking window and guest policy.
- Tee-time block and booking tables ready for booking UI.
- Preserves the LINDEX integration from v0.5/v0.6.

## Required SQL
Run `supabase/migrations/005_onboarding_tee_sheet.sql` in the CLUVEXA Supabase project after 001–004.

## Important
Club admins may configure modules only after CD7 licenses them. v0.7 provides the data model for invitations and tee bookings; automated invitation email delivery and full member tee-time booking are the next implementation layer.
