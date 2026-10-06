# CLUVEXA v0.1
The operating platform for modern private clubs — by CD7 Technologies.

## Included
- Next.js + TypeScript web application
- CD7 Super Admin console UI
- Organization/club creation UI
- Multi-tenant Supabase/Postgres schema
- RLS tenant isolation foundation
- Roles: super admin, club owner/admin/manager/staff/member
- Membership types, members and configurable amenities
- Vercel-ready environment setup

## Start locally
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Add your Supabase URL and anon key
4. Run `supabase/migrations/001_cluvexa_core.sql` in a NEW Supabase project
5. `npm run dev`

## Important
This is the v0.1 foundation. Authentication forms and CRUD screens are intentionally not wired to production mutations until the Supabase project is connected. Do not point this migration at the existing LINDEX production database.

## Next build
v0.2: real authentication, Super Admin club provisioning, club dashboard routing, branding, member CSV import, and permission-aware navigation.
