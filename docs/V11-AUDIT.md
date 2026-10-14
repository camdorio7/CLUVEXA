# NADORIO v11 release candidate audit

Version: 11.0.0-rc.1. This release consolidates the checked-out repository against the supplied NADORIO v11 transfer brief. The referenced newer source ZIP and Linderhof design ZIP were not available. No production database, email account, or deployment was accessed. This is a release candidate, not a production-readiness certification.

## Findings and changes

| Area                        | Repository finding                                                                                 | v11 result                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant authorization        | Broad tenant policies and browser-only gates allowed capabilities beyond the displayed navigation. | Server proxy verifies sessions and organization access; database policies enforce roles, active organization, module licensing/enabling, and staff permissions.                         |
| Modules                     | Navigation, licenses, and organization presets differed; some routes referenced missing tables.    | Shared module/type registries, default-deny routes, supported-module catalog availability, explicit unavailable features. Defaults recommend modules without restricting customization. |
| Platform portal             | Several static status panels and controls implied unavailable services.                            | Real profile/membership administration, organization types, catalog editing, manual billing status, audit records, internal support cases, and authenticated health checks.             |
| Organization administration | Settings, people, invites, and access grants were fragmented.                                      | Shared people management, deactivate/reactivate membership, visible invitation fallback, admin-only access grants, organization selection, and configurable check-in activities.        |
| Staff/member experience     | Dense generic dashboards, duplicated navigation, and overly broad mutation controls.               | Responsive grouped navigation, role-aware compact dashboard, explicit staff capabilities, own-member data, published events, and server-clock time entries.                             |
| Website                     | JSON draft pages could be exposed through raw site data.                                           | Public projection RPC filters draft pages, requires active organization and enabled website license; responsive navigation and per-page publication controls.                           |
| Email/contact               | Existing recipient privacy and inquiry workflows must remain intact.                               | One email message per recipient, accepted-send counts, published-site contact validation, honeypot, database rate limits, organization-scoped inbox.                                    |
| Data integrity              | Cross-tenant foreign references and client-side event capacity checks were possible.               | Tenant relationship guards, serialized event registration, immutable tenant IDs, trusted audit triggers, and server-controlled check-in/time-clock identity.                            |

## Supported scope

Members, membership levels, staff time clock, events/registration, check-in, operations, amenities, golf/tournaments, tee-sheet configuration, announcements, Email Center, Website Builder, reports, integration metadata, and optional external website integration have registered routes and corresponding authorization. Core profile/card, organization settings, audit, and team access have separate role rules. Super-admin platform reporting can read across organizations; organization module routes still require a license and enablement.

New organization creation is transactional: create identity, recommended licenses in an inactive state, optional administrator invitation, and onboarding checklist together. Licensing, administrator enablement, and member visibility remain distinct controls. Revocation clears enablement and member visibility. Staff and managers require explicit view and mutation grants; ordinary members cannot use administrative mutation policies.

## Unavailable or limited

- Documents, reservations, automations, intelligence, household, industry-specific extras, and notifications are not supported routes in this release. Legacy files remain for future work but the workspace registry denies these paths. Their absent or incomplete schemas are not silently invented. Review any custom deployment relying on these routes before upgrading.
- Billing stores plan, contact, and subscription status only. No checkout, charging, invoices, provider webhook, or payment reconciliation is implemented.
- Support is an internal case register. It does not receive inbound support email or offer a live help desk.
- Platform users are database profiles and organization memberships. Auth-provider suspension, last-login analytics, and global account deletion are not implemented.
- Tee sheet is configuration, not a booking engine. Staff time corrections, receipt workflows, payroll, and scheduling are unavailable. Reports provide the existing limited exports; no report designer is claimed.
- Integration cards store metadata. LINDEX is optional, tenant-bound, and requires its own credentials. External website publishing requires an explicitly configured GitHub connection.
- Website settings save to the published site's current content. Per-page draft visibility is supported; full site version history, scheduled publication, and staged revisions are not.
- Database/auth health checks exercise real queries for the current session. Email and external integration credentials are reported as presence-only, not successful delivery/connectivity.
- Existing signup, invitation, password recovery, and confirmation flows require real Supabase redirect/email configuration and live acceptance testing. Mock browser sessions do not validate Auth-provider email exchanges.

## Verification boundaries

`npm test` checks shared access decisions, organization defaults, theme contrast, route registration, and isolated email recipients. `npm run test:database` applies every checked-in migration to a disposable PostgreSQL database and tests RLS, tenant boundaries, invitations, event registration, time clock, application approval, website visibility, contact rate limits, and audit behavior. Test-only Auth/storage shims are not a full Supabase installation.

`npm run test:browser` uses deterministic local Auth/REST fixtures to test portal presentation, mobile navigation, direct-route denials, inactive/disabled access, organization differences, truthful health status, and contact API validation. These tests verify interface behavior separately from the PostgreSQL authorization suite. They do not establish live service delivery or production compatibility.

See V11-DEPLOYMENT.md for the required staging and two-organization acceptance checks. The final local test results are recorded in V11-VALIDATION.md after verification.
