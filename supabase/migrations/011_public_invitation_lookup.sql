-- NADORIO v2.1.4 — safe public invitation lookup
-- Run ONLY after 010_nadorio_email_center.sql.
-- Allows the unauthenticated join page to validate a token without exposing club_invitations through RLS.

create or replace function public.get_public_club_invitation(invite_token uuid)
returns table (
  email text,
  full_name text,
  role text,
  expires_at timestamptz,
  club_name text,
  club_logo_url text,
  club_primary_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.email,
    i.full_name,
    i.role::text,
    i.expires_at,
    c.name,
    c.logo_url,
    c.primary_color
  from public.club_invitations i
  join public.clubs c on c.id = i.club_id
  where i.token = invite_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_public_club_invitation(uuid) from public;
grant execute on function public.get_public_club_invitation(uuid) to anon, authenticated;
