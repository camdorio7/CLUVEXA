-- NADORIO v3.0 — member self-enrollment + club approval
-- Run ONLY after 011_public_invitation_lookup.sql.

create table if not exists public.member_join_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  member_number text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists member_join_requests_one_pending on public.member_join_requests(club_id,user_id) where status='pending';
create index if not exists member_join_requests_club_status on public.member_join_requests(club_id,status,created_at desc);
alter table public.member_join_requests enable row level security;

-- Public directory intentionally exposes only active club identity/branding needed to choose an organization.
create or replace function public.list_public_nadorio_clubs()
returns table(id uuid,name text,slug text,logo_url text,primary_color text,club_type text)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.slug,c.logo_url,c.primary_color,c.club_type
  from public.clubs c where c.status='active' order by c.name;
$$;
grant execute on function public.list_public_nadorio_clubs() to anon, authenticated;

create or replace function public.request_club_membership(target_club uuid, requested_name text, requested_note text default null, requested_member_number text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); mail text; rid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select email into mail from auth.users where id=uid;
  if not exists(select 1 from public.clubs where id=target_club and status='active') then raise exception 'Organization unavailable'; end if;
  if exists(select 1 from public.club_users where club_id=target_club and user_id=uid and active=true) then raise exception 'You already have access to this organization'; end if;
  insert into public.profiles(id,full_name,email) values(uid,coalesce(nullif(trim(requested_name),''),split_part(mail,'@',1)),mail)
  on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(trim(requested_name),''),public.profiles.full_name);
  select id into rid from public.member_join_requests where club_id=target_club and user_id=uid and status='pending' limit 1;
  if rid is not null then
    update public.member_join_requests set full_name=coalesce(nullif(trim(requested_name),''),full_name),email=mail,note=requested_note,member_number=requested_member_number,updated_at=now() where id=rid;
    return rid;
  end if;
  insert into public.member_join_requests(club_id,user_id,full_name,email,note,member_number)
  values(target_club,uid,coalesce(nullif(trim(requested_name),''),split_part(mail,'@',1)),mail,requested_note,requested_member_number)
  returning id into rid;
  return rid;
end $$;
grant execute on function public.request_club_membership(uuid,text,text,text) to authenticated;

create or replace function public.my_club_join_requests()
returns table(id uuid,club_id uuid,club_name text,club_logo_url text,status text,created_at timestamptz,reviewed_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.id,r.club_id,c.name,c.logo_url,r.status,r.created_at,r.reviewed_at
 from public.member_join_requests r join public.clubs c on c.id=r.club_id
 where r.user_id=auth.uid() order by r.created_at desc;
$$;
grant execute on function public.my_club_join_requests() to authenticated;

create or replace function public.review_member_join_request(request_id uuid, decision text)
returns uuid language plpgsql security definer set search_path=public as $$
declare r public.member_join_requests%rowtype; mid uuid;
begin
 select * into r from public.member_join_requests where id=request_id for update;
 if r.id is null then raise exception 'Request not found'; end if;
 if not public.is_club_admin(r.club_id) then raise exception 'Club administrator access required'; end if;
 if r.status <> 'pending' then raise exception 'Request has already been reviewed'; end if;
 if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 update public.member_join_requests set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
 if decision='approved' then
   insert into public.profiles(id,full_name,email) values(r.user_id,r.full_name,r.email)
   on conflict(id) do update set full_name=coalesce(public.profiles.full_name,excluded.full_name),email=coalesce(public.profiles.email,excluded.email);
   insert into public.club_users(club_id,user_id,role,active) values(r.club_id,r.user_id,'member',true)
   on conflict(club_id,user_id) do update set role='member',active=true;
   select id into mid from public.members where club_id=r.club_id and (profile_id=r.user_id or lower(email)=lower(r.email)) limit 1;
   if mid is null then
     insert into public.members(club_id,profile_id,member_number,full_name,email,status,good_standing)
     values(r.club_id,r.user_id,nullif(trim(r.member_number),''),r.full_name,r.email,'active',true);
   else
     update public.members set profile_id=r.user_id,full_name=r.full_name,email=r.email,member_number=coalesce(nullif(trim(r.member_number),''),member_number),status='active' where id=mid;
   end if;
 end if;
 return r.club_id;
end $$;
grant execute on function public.review_member_join_request(uuid,text) to authenticated;

create policy "join request self read" on public.member_join_requests for select using(user_id=auth.uid() or public.is_club_admin(club_id));
create policy "join request admin update" on public.member_join_requests for update using(public.is_club_admin(club_id));
