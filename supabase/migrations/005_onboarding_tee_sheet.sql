-- CLUVEXA v0.7 — onboarding, club branding, lifecycle, invitations and Tee Sheet
alter table public.clubs add column if not exists secondary_color text default '#13d9e8';
alter table public.clubs add column if not exists contact_email text;
alter table public.clubs add column if not exists website_url text;
alter table public.clubs add column if not exists archived_at timestamptz;

create table if not exists public.club_invitations (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 email text not null, role public.club_role not null default 'admin', status text not null default 'pending',
 token uuid not null default gen_random_uuid(), invited_by uuid references public.profiles(id) on delete set null,
 expires_at timestamptz not null default (now()+interval '7 days'), created_at timestamptz not null default now(), unique(club_id,email,status)
);
create table if not exists public.tee_sheet_settings (
 club_id uuid primary key references public.clubs(id) on delete cascade, first_tee_time time not null default '07:00', last_tee_time time not null default '17:00',
 interval_minutes integer not null default 10 check(interval_minutes between 5 and 30), max_players integer not null default 4 check(max_players between 1 and 8),
 booking_days_ahead integer not null default 14 check(booking_days_ahead between 1 and 365), allow_guests boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.tee_time_blocks (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade, tee_date date not null, tee_time time not null,
 status text not null default 'open', note text, created_at timestamptz not null default now(), unique(club_id,tee_date,tee_time)
);
create table if not exists public.tee_time_bookings (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade, block_id uuid not null references public.tee_time_blocks(id) on delete cascade,
 member_id uuid references public.members(id) on delete set null, player_name text not null, guest boolean not null default false, created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);

alter table public.club_invitations enable row level security; alter table public.tee_sheet_settings enable row level security; alter table public.tee_time_blocks enable row level security; alter table public.tee_time_bookings enable row level security;
create policy "invites tenant" on public.club_invitations for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "tee settings tenant" on public.tee_sheet_settings for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "tee blocks tenant" on public.tee_time_blocks for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create policy "tee bookings tenant" on public.tee_time_bookings for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));

-- Club logos live in a public bucket; authenticated users may upload. Club-level UI limits the destination path.
insert into storage.buckets(id,name,public) values('club-branding','club-branding',true) on conflict(id) do update set public=true;
drop policy if exists "club branding public read" on storage.objects;
create policy "club branding public read" on storage.objects for select using(bucket_id='club-branding');
drop policy if exists "club branding authenticated upload" on storage.objects;
create policy "club branding authenticated upload" on storage.objects for insert to authenticated with check(bucket_id='club-branding');
drop policy if exists "club branding authenticated update" on storage.objects;
create policy "club branding authenticated update" on storage.objects for update to authenticated using(bucket_id='club-branding');

create index if not exists tee_blocks_club_date on public.tee_time_blocks(club_id,tee_date,tee_time);
create index if not exists tee_bookings_block on public.tee_time_bookings(block_id);
