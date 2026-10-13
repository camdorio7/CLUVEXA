-- NADORIO 10: public websites and private inquiry inbox. Safe to rerun.
create table if not exists public.organization_sites (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 title text not null default 'Welcome', tagline text not null default '',
 about text not null default '', services jsonb not null default '[]'::jsonb,
 contact_email text not null default '', phone text not null default '',
 address text not null default '', published boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint organization_sites_services_array check (jsonb_typeof(services) = 'array')
);
create table if not exists public.organization_site_messages (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 sender_name text not null, sender_email text not null,
 message text not null, created_at timestamptz not null default now()
);
create index if not exists organization_site_messages_by_club on public.organization_site_messages(club_id, created_at desc);
alter table public.organization_sites enable row level security;
alter table public.organization_site_messages enable row level security;
-- Public sees published pages only. Admins and platform owner can edit licensed sites.
drop policy if exists "nadorio site public read" on public.organization_sites;
create policy "nadorio site public read" on public.organization_sites for select to anon, authenticated
 using (published = true);
drop policy if exists "nadorio site admin read" on public.organization_sites;
create policy "nadorio site admin read" on public.organization_sites for select to authenticated
 using (public.is_super_admin() or exists (
 select 1 from public.club_users u where u.club_id=organization_sites.club_id and u.user_id=auth.uid() and u.active and u.role in ('owner','admin')));
drop policy if exists "nadorio site admin insert" on public.organization_sites;
create policy "nadorio site admin insert" on public.organization_sites for insert to authenticated
 with check ((public.is_super_admin() or exists (
 select 1 from public.club_users u where u.club_id=organization_sites.club_id and u.user_id=auth.uid() and u.active and u.role in ('owner','admin')))
 and exists(select 1 from public.club_modules m where m.club_id=organization_sites.club_id and m.module_key='website_builder' and m.licensed and m.club_enabled));
drop policy if exists "nadorio site admin update" on public.organization_sites;
create policy "nadorio site admin update" on public.organization_sites for update to authenticated
 using (public.is_super_admin() or exists (
 select 1 from public.club_users u where u.club_id=organization_sites.club_id and u.user_id=auth.uid() and u.active and u.role in ('owner','admin')))
 with check ((public.is_super_admin() or exists (
 select 1 from public.club_users u where u.club_id=organization_sites.club_id and u.user_id=auth.uid() and u.active and u.role in ('owner','admin')))
 and exists(select 1 from public.club_modules m where m.club_id=organization_sites.club_id and m.module_key='website_builder' and m.licensed and m.club_enabled));
drop policy if exists "nadorio inbox admin read" on public.organization_site_messages;
create policy "nadorio inbox admin read" on public.organization_site_messages for select to authenticated
 using ((public.is_super_admin() or exists (
 select 1 from public.club_users u where u.club_id=organization_site_messages.club_id and u.user_id=auth.uid() and u.active and u.role in ('owner','admin')))
 and exists(select 1 from public.club_modules m where m.club_id=organization_site_messages.club_id and m.module_key='email_center' and m.licensed and m.club_enabled));
-- Contact submissions use a validated server endpoint with a service role; no public INSERT policy.
