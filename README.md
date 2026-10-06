# CLUVEXA v0.4 — Connected Platforms

CLUVEXA remains the central CD7 club-management command center while allowing a club to retain an independent dedicated platform.

## Linderhof architecture
- CLUVEXA: central organization/command-center view
- Linderhof Country Club: CLUVEXA tenant
- LINDEX: independent connected platform with its own database, apps and features

## Install
1. Upload this project to the CLUVEXA GitHub repository and deploy through Vercel.
2. In the CLUVEXA Supabase SQL Editor, run `supabase/migrations/003_connected_platforms.sql` once.
3. Open Linderhof in CLUVEXA. LINDEX will appear as its primary Connected Platform.

This release does not connect directly to the LINDEX database. Secure API synchronization can be added later without merging the two systems.
