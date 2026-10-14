# Route inventory

Source-level inventory of page-local table reads/writes; shared components, API calls, and RPC internals are not expanded. Presence here does not imply a supported route. The authoritative workspace allowlist is `lib/modules.ts`; unavailable legacy routes remain blocked.

| Route | Direct table references |
| --- | --- |
| `/analytics` | `clubs` |
| `/billing` | `clubs` |
| `/clubs/[id]/access` | Shared component, RPC, or no direct table query |
| `/clubs/[id]/amenities` | `amenities` |
| `/clubs/[id]/communications` | Shared component, RPC, or no direct table query |
| `/clubs/[id]/events` | `club_events` |
| `/clubs/[id]/golf` | Shared component, RPC, or no direct table query |
| `/clubs/[id]/launch` | `clubs`, `organization_onboarding` |
| `/clubs/[id]/members` | `club_invitations`, `members`, `membership_types` |
| `/clubs/[id]/memberships` | `membership_types` |
| `/clubs/[id]/modules` | `club_modules`, `module_catalog` |
| `/clubs/[id]/operations` | Shared component, RPC, or no direct table query |
| `/clubs/[id]` | `amenities`, `club_events`, `clubs`, `connected_platforms`, `members`, `membership_types` |
| `/clubs/[id]/people` | Shared component, RPC, or no direct table query |
| `/clubs/[id]/platforms` | `connected_platforms` |
| `/clubs/[id]/reports` | Shared component, RPC, or no direct table query |
| `/clubs/[id]/settings` | `club-branding`, `clubs` |
| `/clubs/[id]/staff` | `club_invitations`, `club_users` |
| `/clubs/[id]/tee-sheet` | `tee_sheet_settings` |
| `/clubs/new` | Shared component, RPC, or no direct table query |
| `/clubs` | `clubs` |
| `/dashboard` | `clubs`, `members` |
| `/forgot-password` | Shared component, RPC, or no direct table query |
| `/health` | Shared component, RPC, or no direct table query |
| `/integrations` | `clubs`, `connected_platforms` |
| `/join` | Shared component, RPC, or no direct table query |
| `/launch-center` | `clubs`, `organization_onboarding` |
| `/login` | `club_users`, `profiles` |
| `/marketplace` | `module_catalog` |
| `/member/complete` | Shared component, RPC, or no direct table query |
| `/member/join` | Shared component, RPC, or no direct table query |
| `/member/pending` | Shared component, RPC, or no direct table query |
| `/members` | `club_users`, `profiles` |
| `/module-licensing` | `club_modules`, `clubs` |
| `/organization-types` | Shared component, RPC, or no direct table query |
| `/organizations` | `club_users` |
| `/.` | Shared component, RPC, or no direct table query |
| `/plans` | Shared component, RPC, or no direct table query |
| `/reset-password` | Shared component, RPC, or no direct table query |
| `/security` | `audit_log` |
| `/settings` | Shared component, RPC, or no direct table query |
| `/site/[id]/[slug]` | Shared component, RPC, or no direct table query |
| `/site/[id]` | Shared component, RPC, or no direct table query |
| `/support` | `clubs`, `support_cases` |
| `/workspace/[id]/access` | `access_log`, `members` |
| `/workspace/[id]/amenities` | `amenities` |
| `/workspace/[id]/audit` | `audit_log` |
| `/workspace/[id]/automations` | `automation_rules` |
| `/workspace/[id]/card` | `clubs`, `members` |
| `/workspace/[id]/communications` | `announcements`, `email_logs` |
| `/workspace/[id]/directory` | Shared component, RPC, or no direct table query |
| `/workspace/[id]/documents` | `organization_documents` |
| `/workspace/[id]/email-center` | `club_modules`, `club_users`, `organization_site_messages` |
| `/workspace/[id]/events` | `club_events`, `event_registrations` |
| `/workspace/[id]/golf` | `club_modules`, `club_users`, `golf_tournaments` |
| `/workspace/[id]/golf-index` | `club_modules`, `club_users`, `golf_scorecards` |
| `/workspace/[id]/household` | `household_members`, `members` |
| `/workspace/[id]/industry` | `campaigns`, `clubs`, `maintenance_requests`, `organization_people`, `organization_units`, `vessels` |
| `/workspace/[id]/intelligence` | `club_events`, `members`, `operational_tasks` |
| `/workspace/[id]/members` | `club_invitations`, `members`, `membership_types` |
| `/workspace/[id]/memberships` | `membership_types` |
| `/workspace/[id]/notifications` | `notifications` |
| `/workspace/[id]/operations` | `operational_tasks` |
| `/workspace/[id]` | `club_events`, `member_join_requests`, `members`, `operational_tasks`, `organization_site_messages`, `profiles` |
| `/workspace/[id]/people` | `club_users`, `member_join_requests` |
| `/workspace/[id]/permissions` | `club_user_permissions`, `club_users` |
| `/workspace/[id]/platforms` | `connected_platforms` |
| `/workspace/[id]/profile` | `members` |
| `/workspace/[id]/reports` | `access_log`, `club_events`, `club_users`, `members` |
| `/workspace/[id]/reservations` | `resource_reservations`, `resources` |
| `/workspace/[id]/scorecard` | `club_modules`, `club_users`, `golf_scorecards` |
| `/workspace/[id]/settings` | `club-branding`, `club_modules`, `clubs`, `module_catalog` |
| `/workspace/[id]/site-builder` | `club_modules`, `club_users`, `organization_sites` |
| `/workspace/[id]/staff` | `club_invitations`, `club_users`, `staff_time_entries` |
| `/workspace/[id]/team-access` | Shared component, RPC, or no direct table query |
| `/workspace/[id]/tee-sheet` | `tee_sheet_settings` |
| `/workspace/[id]/website` | Shared component, RPC, or no direct table query |
