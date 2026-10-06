-- CLUVEXA v0.6 — platform owner, licensing, club configuration and user permissions
-- Safe to run after 001-003.

create table if not exists public.module_catalog (
  module_key text primary key,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 100,
  default_enabled boolean not null default false
);

insert into public.module_catalog(module_key,name,description,icon,sort_order,default_enabled) values
 ('overview','Overview','Club command center','layout-dashboard',10,true),
 ('members','Members','Member records, status and directory','users',20,true),
 ('memberships','Memberships','Membership types and standing','badge',30,true),
 ('events','Events','Events, registration and capacity','calendar-days',40,true),
 ('tee_sheet','Tee Sheet','Tee-time inventory and booking','calendar-clock',50,false),
 ('golf','Golf & Tournaments','Golf operations, scoring and tournaments','flag',60,false),
 ('access','Access & Guests','Check-ins, guests and passes','scan-line',70,true),
 ('amenities','Amenities','Pool, courts, fitness, marina and custom amenities','waves',80,false),
 ('staff','Staff','Staff directory, roles and workspace','briefcase-business',90,true),
 ('time_clock','Time Clock','Clock in/out and staff hours','clock-3',100,false),
 ('operations','Operations','Daily operations and status','activity',110,true),
 ('communications','Communications','Club announcements and messaging','messages-square',120,true),
 ('payments','Payments','Payment provider connections and payment links','credit-card',130,false),
 ('reports','Reports','Operational reporting and exports','chart-no-axes-combined',140,true),
 ('connected_platforms','Connected Platforms','External platforms such as LINDEX','plug-zap',150,false)
on conflict (module_key) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order;

alter table public.club_modules add column if not exists licensed boolean not null default false;
alter table public.club_modules add column if not exists club_enabled boolean not null default false;
alter table public.club_modules add column if not exists nav_label text;
alter table public.club_modules add column if not exists sort_order integer;
alter table public.club_modules add column if not exists licensed_at timestamptz;
alter table public.club_modules add column if not exists licensed_by uuid references public.profiles(id) on delete set null;

-- Preserve earlier enabled records as licensed + enabled.
update public.club_modules set licensed=true, club_enabled=enabled where enabled=true and licensed=false;

-- Seed every existing club with catalog rows. Platform owner can change licensing later.
insert into public.club_modules(club_id,module_key,enabled,licensed,club_enabled,sort_order)
select c.id,m.module_key,m.default_enabled,m.default_enabled,m.default_enabled,m.sort_order
from public.clubs c cross join public.module_catalog m
on conflict (club_id,module_key) do nothing;

-- Linderhof's existing connected-platform capability is licensed.
insert into public.club_modules(club_id,module_key,enabled,licensed,club_enabled,sort_order)
select id,'connected_platforms',true,true,true,150 from public.clubs where slug='linderhof'
on conflict (club_id,module_key) do update set enabled=true,licensed=true,club_enabled=true;

create table if not exists public.club_user_permissions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null references public.module_catalog(module_key) on delete cascade,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(club_id,user_id,module_key)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.module_catalog enable row level security;
alter table public.club_user_permissions enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "module catalog authenticated" on public.module_catalog;
create policy "module catalog authenticated" on public.module_catalog for select to authenticated using(true);

drop policy if exists "permissions tenant read" on public.club_user_permissions;
create policy "permissions tenant read" on public.club_user_permissions for select using(public.has_club_access(club_id));
drop policy if exists "permissions tenant manage" on public.club_user_permissions;
create policy "permissions tenant manage" on public.club_user_permissions for all using(public.has_club_access(club_id)) with check(public.has_club_access(club_id));

drop policy if exists "audit tenant read" on public.audit_log;
create policy "audit tenant read" on public.audit_log for select using(public.has_club_access(club_id) or club_id is null);
drop policy if exists "audit insert" on public.audit_log;
create policy "audit insert" on public.audit_log for insert with check(auth.uid() is not null);

-- Only CD7 super admins may change what a club is licensed to use.
drop policy if exists "club modules tenant" on public.club_modules;
create policy "club modules read" on public.club_modules for select using(public.has_club_access(club_id));
create policy "club modules super insert" on public.club_modules for insert with check(public.is_super_admin());
create policy "club modules super delete" on public.club_modules for delete using(public.is_super_admin());
create policy "club modules update" on public.club_modules for update using(public.has_club_access(club_id));

create index if not exists club_user_permissions_lookup on public.club_user_permissions(club_id,user_id);
create index if not exists audit_log_club_created on public.audit_log(club_id,created_at desc);
