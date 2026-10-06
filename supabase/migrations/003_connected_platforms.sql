-- CLUVEXA v0.4 Connected Platforms
create table if not exists public.connected_platforms (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 name text not null,
 platform_key text not null,
 status text not null default 'connected',
 description text,
 portal_url text,
 admin_url text,
 staff_url text,
 data_owner text,
 is_primary boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(club_id, platform_key)
);
alter table public.connected_platforms enable row level security;
drop policy if exists "connected platforms tenant" on public.connected_platforms;
create policy "connected platforms tenant" on public.connected_platforms for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));
create index if not exists connected_platforms_club_idx on public.connected_platforms(club_id);

-- Register LINDEX as Linderhof's independent primary platform when that tenant exists.
insert into public.connected_platforms (club_id,name,platform_key,status,description,portal_url,data_owner,is_primary)
select id,'LINDEX','lindex','operational','Linderhof Country Club’s dedicated member and operations platform. LINDEX remains independent while being visible from CLUVEXA.','https://linderhofmembers.com','LINDEX',true
from public.clubs where slug='linderhof'
on conflict (club_id,platform_key) do update set
 name=excluded.name,status=excluded.status,description=excluded.description,portal_url=excluded.portal_url,data_owner=excluded.data_owner,is_primary=true,updated_at=now();
