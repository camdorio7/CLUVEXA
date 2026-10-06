# CLUVEXA v0.2

Multi-tenant private-club management platform by CD7 Technologies.

## What's live in v0.2
- Supabase email/password login
- Super Admin authorization through `profiles.platform_role`
- Live clubs and member totals
- Real organization creation
- Club detail screen
- Sign out
- Multi-tenant RLS foundation from v0.1

## Upgrade from v0.1
1. Stop the dev server with Control+C.
2. Replace your local v0.1 project with this v0.2 folder (or copy your existing `.env.local` into v0.2).
3. Ensure `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run `npm install` then `npm run dev`.
5. Open http://localhost:3000/login and sign in with the Supabase Auth user that has `profiles.platform_role = 'super_admin'`.

No additional SQL migration is required for v0.2 if `001_cluvexa_core.sql` was already run successfully.
