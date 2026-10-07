-- CLUVEXA v2.0 — complete native club operations suite
-- Run ONLY after 007_platform_owner_access.sql.

alter table public.membership_types add column if not exists price numeric(10,2) default 0;
alter table public.membership_types add column if not exists billing_period text default 'annual';
alter table public.members add column if not exists expires_at date;
alter table public.members add column if not exists household_name text;

alter table public.club_events add column if not exists registration_deadline timestamptz;
alter table public.club_events add column if not exists price numeric(10,2) default 0;
alter table public.club_events add column if not exists payment_url text;

create table if not exists public.access_log (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 member_id uuid references public.members(id) on delete set null, guest_name text, access_type text not null default 'clubhouse',
 checked_in_by uuid references public.profiles(id) on delete set null, checked_in_at timestamptz not null default now(), notes text
);
create table if not exists public.guest_passes (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 member_id uuid references public.members(id) on delete cascade, guest_name text not null, pass_type text not null default 'day',
 valid_from date not null default current_date, valid_until date not null default current_date, status text not null default 'active', created_at timestamptz not null default now()
);
create table if not exists public.staff_time_entries (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, clock_in timestamptz not null default now(), clock_out timestamptz,
 tips numeric(10,2) default 0, notes text, created_at timestamptz not null default now()
);
create table if not exists public.operational_tasks (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 title text not null, category text default 'general', status text not null default 'open', priority text not null default 'normal', due_at timestamptz,
 assigned_to uuid references public.profiles(id) on delete set null, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 title text not null, body text not null, audience text not null default 'all', status text not null default 'published',
 created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.golf_tournaments (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 name text not null, starts_at timestamptz not null, format text, entry_fee numeric(10,2) default 0, status text not null default 'scheduled', notes text, created_at timestamptz not null default now()
);

alter table public.access_log enable row level security; alter table public.guest_passes enable row level security;
alter table public.staff_time_entries enable row level security; alter table public.operational_tasks enable row level security;
alter table public.announcements enable row level security; alter table public.golf_tournaments enable row level security;

do $$ declare t text; begin foreach t in array array['access_log','guest_passes','staff_time_entries','operational_tasks','announcements','golf_tournaments'] loop
 execute format('drop policy if exists "v2 tenant %s" on public.%I',t,t);
 execute format('create policy "v2 tenant %s" on public.%I for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id))',t,t);
 end loop; end $$;

create index if not exists access_log_club_date on public.access_log(club_id,checked_in_at desc);
create index if not exists staff_time_club_date on public.staff_time_entries(club_id,clock_in desc);
create index if not exists ops_tasks_club on public.operational_tasks(club_id,status);
create index if not exists announcements_club on public.announcements(club_id,created_at desc);
create index if not exists tournaments_club on public.golf_tournaments(club_id,starts_at);
