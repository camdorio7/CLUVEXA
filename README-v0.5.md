# NADORIO v0.5 — Live LINDEX Connection

This build keeps LINDEX independent and adds a read-only server-to-server connection for Linderhof's Connected Platforms page.

## NADORIO Vercel variables
Add these server-side variables in the NADORIO Vercel project:
- `LINDEX_INTEGRATION_URL` = `https://linderhofmembers.com/api/cluvexa-metrics`
- `LINDEX_INTEGRATION_SECRET` = the same long random value configured in the LINDEX Vercel project

Keep the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables.

Never put the LINDEX integration secret in a `NEXT_PUBLIC_` variable.

## LINDEX companion patch
Deploy the companion LINDEX patch before expecting live metrics. It adds `/api/cluvexa-metrics` and does not change the LINDEX UI or database.
