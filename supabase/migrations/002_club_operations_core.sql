-- CLUVEXA v0.3 Club Operations Core
create table if not exists public.club_modules (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 module_key text not null, enabled boolean not null default true, unique(club_id,module_key)
);
create table if not exists public.club_settings (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 display_name text, support_email text, phone text, website text, address text,
 member_portal_name text, powered_by_cluvexa boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.club_activity (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 activity_type text not null, title text not null, detail text, created_at timestamptz not null default now()
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 name text not null, starts_at timestamptz, capacity integer, status text not null default 'draft', created_at timestamptz not null default now()
);
create table if not exists public.checkins (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 member_id uuid references public.members(id) on delete set null, amenity_id uuid references public.amenities(id) on delete set null,
 checkin_type text not null default 'member', checked_in_at timestamptz not null default now()
);

alter table public.club_modules enable row level security; alter table public.club_settings enable row level security;
alter table public.club_activity enable row level security; alter table public.events enable row level security; alter table public.checkins enable row level security;
create policy "club modules tenant" on public.club_modules for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "club settings tenant" on public.club_settings for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "club activity tenant" on public.club_activity for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "events tenant" on public.events for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "checkins tenant" on public.checkins for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create index if not exists club_activity_club_idx on public.club_activity(club_id,created_at desc);
create index if not exists events_club_idx on public.events(club_id); create index if not exists checkins_club_idx on public.checkins(club_id,checked_in_at desc);
