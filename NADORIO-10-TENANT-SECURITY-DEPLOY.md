# NADORIO 10.0 — Tenant-safe LINDEX metrics

## Scope
This update closes an authorization gap in `GET /api/integrations/lindex?clubId=...`. Previously, any authenticated user who knew an organization ID could reach its configured LINDEX metrics. The endpoint now verifies an active membership in the requested organization (or CD7 platform-owner permission), active organization status, an explicitly connected integration, and ownership of the configured LINDEX upstream. It also prevents caching and bounds upstream request time.

## Deploy
1. Upload the two changed source files in this ZIP, preserving their paths.
2. In Vercel, set `LINDEX_INTEGRATION_CLUB_ID` to the **actual Supabase `clubs.id` UUID for Linderhof**. This is mandatory for this endpoint to serve metrics; do not set it to another club's ID. Keep existing `LINDEX_INTEGRATION_SECRET` and `LINDEX_INTEGRATION_URL` unchanged.
3. Deploy and run `npm run check:release` in the full repository.
4. Test with an authorized Linderhof account: LINDEX metrics should load. Test with an account that belongs only to a different club: requesting the Linderhof club ID must return 403. Test a disconnected or inactive integration: 403. Test an expired session: 401. Test with the env variable missing: 503, never cross-club metrics.

## Caveats
No Supabase migration is required. This endpoint is specifically for the Linderhof LINDEX upstream; supporting additional independent LINDEX installations later requires an explicit per-organization integration registry and credentials, not simply removing the club ID check. This patch does not establish that all other NADORIO endpoints, RLS policies, or workflows are production-ready. Live testing remains required.
