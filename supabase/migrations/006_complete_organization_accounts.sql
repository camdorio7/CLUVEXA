-- CLUVEXA v1.0 — organization accounts, portals, invitations, events, branding
-- Run ONLY this migration after 005_onboarding_tee_sheet.sql.

alter table public.clubs add column if not exists background_color text default '#07111f';
alter table public.clubs add column if not exists surface_color text default '#0d1b2a';
alter table public.clubs add column if not exists text_color text default '#f4f8ff';
alter table public.clubs add column if not exists portal_title text;
alter table public.clubs add column if not exists welcome_message text;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;

alter table public.members add column if not exists phone text;
alter table public.members add column if not exists notes text;
alter table public.members add column if not exists joined_at date default current_date;

alter table public.club_invitations add column if not exists full_name text;
alter table public.club_invitations add column if not exists member_id uuid references public.members(id) on delete set null;

create table if not exists public.club_events (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 title text not null,
 description text,
 starts_at timestamptz not null,
 ends_at timestamptz,
 location text,
 capacity integer,
 status text not null default 'published',
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 event_id uuid not null references public.club_events(id) on delete cascade,
 member_id uuid references public.members(id) on delete set null,
 user_id uuid references public.profiles(id) on delete set null,
 attendee_name text not null,
 guests integer not null default 0,
 created_at timestamptz not null default now(),
 unique(event_id,user_id)
);

create or replace function public.club_role_for(target uuid) returns text language sql stable security definer set search_path=public as $$
 select case when public.is_super_admin() then 'super_admin' else (
   select role::text from public.club_users where user_id=auth.uid() and club_id=target and active=true limit 1
 ) end;
$$;

create or replace function public.is_club_admin(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or exists(
   select 1 from public.club_users where user_id=auth.uid() and club_id=target and active=true and role in ('owner','admin')
 );
$$;

-- An invited user can read/accept only the invitation matching their authenticated email.
create or replace function public.accept_club_invitation(invite_token uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare inv public.club_invitations%rowtype; uid uuid := auth.uid(); mail text; result_club uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select email into mail from auth.users where id=uid;
 select * into inv from public.club_invitations where token=invite_token and status='pending' and expires_at>now() limit 1;
 if inv.id is null then raise exception 'Invitation is invalid or expired'; end if;
 if lower(inv.email) <> lower(mail) then raise exception 'Sign in with the invited email address'; end if;
 insert into public.profiles(id,full_name,email) values(uid,coalesce(inv.full_name,split_part(mail,'@',1)),mail)
 on conflict(id) do update set email=excluded.email, full_name=coalesce(public.profiles.full_name,excluded.full_name);
 insert into public.club_users(club_id,user_id,role,active) values(inv.club_id,uid,inv.role,true)
 on conflict(club_id,user_id) do update set role=excluded.role,active=true;
 if inv.member_id is not null then update public.members set profile_id=uid,email=mail where id=inv.member_id; end if;
 update public.club_invitations set status='accepted' where id=inv.id;
 result_club:=inv.club_id; return result_club;
end $$;

grant execute on function public.accept_club_invitation(uuid) to authenticated;

alter table public.club_events enable row level security;
alter table public.event_registrations enable row level security;

drop policy if exists "events tenant read" on public.club_events;
create policy "events tenant read" on public.club_events for select using(public.has_club_access(club_id));
drop policy if exists "events admin write" on public.club_events;
create policy "events admin write" on public.club_events for all using(public.is_club_admin(club_id)) with check(public.is_club_admin(club_id));

drop policy if exists "registrations tenant" on public.event_registrations;
create policy "registrations tenant" on public.event_registrations for select using(public.has_club_access(club_id));
drop policy if exists "registrations insert" on public.event_registrations;
create policy "registrations insert" on public.event_registrations for insert with check(public.has_club_access(club_id));
drop policy if exists "registrations admin delete" on public.event_registrations;
create policy "registrations admin delete" on public.event_registrations for delete using(public.is_club_admin(club_id) or user_id=auth.uid());

-- Tighten organization deletion to CD7 platform owner only.
drop policy if exists "clubs super delete" on public.clubs;
create policy "clubs super delete" on public.clubs for delete using(public.is_super_admin());

-- Club admins can manage people/invitations in their own organization.
drop policy if exists "club users admin insert" on public.club_users;
create policy "club users admin insert" on public.club_users for insert with check(public.is_club_admin(club_id));
drop policy if exists "club users admin update" on public.club_users;
create policy "club users admin update" on public.club_users for update using(public.is_club_admin(club_id));
drop policy if exists "club users admin delete" on public.club_users;
create policy "club users admin delete" on public.club_users for delete using(public.is_club_admin(club_id));

drop policy if exists "invites tenant" on public.club_invitations;
create policy "invites admin read" on public.club_invitations for select using(public.is_club_admin(club_id) or lower(email)=lower(coalesce(auth.jwt()->>'email','')));
create policy "invites admin insert" on public.club_invitations for insert with check(public.is_club_admin(club_id));
create policy "invites admin update" on public.club_invitations for update using(public.is_club_admin(club_id) or lower(email)=lower(coalesce(auth.jwt()->>'email','')));
create policy "invites admin delete" on public.club_invitations for delete using(public.is_club_admin(club_id));

-- Club settings: admins may edit branding; super admin retains all access via has_club_access.
drop policy if exists "clubs admin update" on public.clubs;
create policy "clubs admin update" on public.clubs for update using(public.is_club_admin(id));

create index if not exists club_events_club_starts on public.club_events(club_id,starts_at);
create index if not exists club_invites_token on public.club_invitations(token);

-- Prevent club users from self-licensing paid modules. They may only toggle club_enabled on modules already licensed by CD7.
create or replace function public.protect_module_license() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_super_admin() then
   if new.licensed is distinct from old.licensed or new.licensed_by is distinct from old.licensed_by or new.licensed_at is distinct from old.licensed_at then
     raise exception 'Only the CLUVEXA platform owner can change module licensing';
   end if;
   if new.club_enabled=true and old.licensed=false then raise exception 'This module is not licensed'; end if;
 end if;
 new.enabled := new.licensed and new.club_enabled;
 return new;
end $$;
drop trigger if exists protect_module_license_trigger on public.club_modules;
create trigger protect_module_license_trigger before update on public.club_modules for each row execute function public.protect_module_license();

-- Organization users may see basic profiles of people who share their club.
drop policy if exists "profile club peers" on public.profiles;
create policy "profile club peers" on public.profiles for select using(
 id=auth.uid() or public.is_super_admin() or exists(
   select 1 from public.club_users me join public.club_users them on them.club_id=me.club_id
   where me.user_id=auth.uid() and me.active=true and them.user_id=profiles.id and them.active=true
 )
);
