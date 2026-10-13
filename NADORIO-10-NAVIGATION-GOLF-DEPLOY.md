# NADORIO 10.0 — Navigation & Golf Scoring Update

## Install
1. Run `supabase/migrations/017_nadorio_golf_scorecards.sql` in Supabase SQL Editor.
2. Copy all remaining files in this ZIP into the repository, preserving paths; commit and deploy to Vercel.
3. For a test organization, CD7 must license `golf`; its Admin must enable `golf` and set `member_visible=true` in module settings. Other organizations will not see golf links.
4. Test as Admin, Member, and Staff in **two different organizations**. Check the Admin sidebar accordion and member golf navigation; save an 18-hole scorecard, view history and the unofficial index, and confirm cross-organization data is inaccessible.

## Scope and limits
- This adds personal 18-hole scorecards and an **unofficial scoring estimate** (average of up to eight lowest differentials from the latest twenty rounds; available after three rounds). It is NOT an official WHS Handicap Index. No GHIN/USGA integration, 9-hole conversions, PCC, exceptional score reductions, or official handicap issuance.
- Existing LINDEX remains independent. No Linderhof configuration required.
- Member visibility depends on `golf` being licensed, enabled, and visible to members.
- Admin sidebar sections collapse; the dashboard's five sections remain.
- Migration uses own-user, own-organization RLS and database-side gross/differential validation. Existing module pages may require separate server-side role hardening before public launch.
- No full live Supabase test has been performed here. Do not claim the platform is production-certified based on this update.
