-- CLUVEXA v0.1 multi-tenant core
create extension if not exists pgcrypto;
create type public.platform_role as enum ('super_admin','user');
create type public.club_role as enum ('owner','admin','manager','staff','member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  platform_role public.platform_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  club_type text not null default 'golf_country',
  plan text not null default 'starter',
  status text not null default 'active',
  logo_url text,
  primary_color text default '#173c2a',
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.club_users (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.club_role not null,
  active boolean not null default true,
  unique(club_id,user_id)
);

create table public.membership_types (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  membership_type_id uuid references public.membership_types(id) on delete set null,
  member_number text,
  full_name text not null,
  email text,
  good_standing boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(club_id,member_number)
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  amenity_type text not null,
  active boolean not null default true
);

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.platform_role='super_admin');
$$;
create or replace function public.has_club_access(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or exists(select 1 from public.club_users cu where cu.user_id=auth.uid() and cu.club_id=target and cu.active=true);
$$;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_users enable row level security;
alter table public.membership_types enable row level security;
alter table public.members enable row level security;
alter table public.amenities enable row level security;

create policy "profile self or super" on public.profiles for select using(id=auth.uid() or public.is_super_admin());
create policy "clubs tenant select" on public.clubs for select using(public.has_club_access(id));
create policy "clubs super insert" on public.clubs for insert with check(public.is_super_admin());
create policy "clubs admin update" on public.clubs for update using(public.has_club_access(id));
create policy "club users tenant" on public.club_users for select using(public.has_club_access(club_id));
create policy "membership types tenant" on public.membership_types for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "members tenant" on public.members for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "amenities tenant" on public.amenities for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));

create index members_club_idx on public.members(club_id);
create index club_users_user_idx on public.club_users(user_id);
create index amenities_club_idx on public.amenities(club_id);
