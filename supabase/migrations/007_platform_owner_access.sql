-- CLUVEXA v1.0.3.2 — repair/guarantee Platform Owner identity.
-- Run ONLY this migration after 006_complete_organization_accounts.sql.
-- It is intentionally scoped to the CD7 Platform Owner auth user.

insert into public.profiles (id, full_name, email, platform_role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(split_part(u.email,'@',1),''), 'Platform Owner'),
  u.email,
  'super_admin'::public.platform_role
from auth.users u
where u.id = 'bc941f78-2aa5-49c3-ae1f-d907e1c07fd7'::uuid
on conflict (id) do update
set platform_role = 'super_admin'::public.platform_role,
    email = coalesce(excluded.email, public.profiles.email);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'super_admin'::public.platform_role
  );
$$;

grant execute on function public.is_super_admin() to authenticated;
