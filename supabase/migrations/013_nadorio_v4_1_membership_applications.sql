-- NADORIO v4.1 — membership-level applications
-- Run ONLY after 012_nadorio_v3_member_enrollment.sql.

alter table public.membership_types add column if not exists online_application boolean not null default true;
alter table public.membership_types add column if not exists application_note text;
alter table public.member_join_requests add column if not exists membership_type_id uuid references public.membership_types(id) on delete set null;
create index if not exists member_join_requests_membership_type on public.member_join_requests(membership_type_id);

-- Public signup sees only active plans a club has explicitly made available online.
create or replace function public.list_public_membership_types(target_club uuid)
returns table(id uuid,name text,description text,price numeric,billing_period text,application_note text)
language sql stable security definer set search_path=public as $$
  select m.id,m.name,m.description,m.price,m.billing_period,m.application_note
  from public.membership_types m
  join public.clubs c on c.id=m.club_id
  where m.club_id=target_club and m.active=true and m.online_application=true and c.status='active'
  order by m.name;
$$;
grant execute on function public.list_public_membership_types(uuid) to anon, authenticated;

-- New v4.1 request function. The requested plan is validated against the selected organization.
create or replace function public.request_club_membership_v41(
  target_club uuid,
  requested_membership_type uuid,
  requested_name text,
  requested_note text default null,
  requested_member_number text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); mail text; rid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select email into mail from auth.users where id=uid;
  if not exists(select 1 from public.clubs where id=target_club and status='active') then raise exception 'Organization unavailable'; end if;
  if requested_membership_type is null or not exists(
    select 1 from public.membership_types
    where id=requested_membership_type and club_id=target_club and active=true and online_application=true
  ) then raise exception 'Please select an available membership level'; end if;
  if exists(select 1 from public.club_users where club_id=target_club and user_id=uid and active=true) then raise exception 'You already have access to this organization'; end if;

  insert into public.profiles(id,full_name,email)
  values(uid,coalesce(nullif(trim(requested_name),''),split_part(mail,'@',1)),mail)
  on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(trim(requested_name),''),public.profiles.full_name);

  select id into rid from public.member_join_requests where club_id=target_club and user_id=uid and status='pending' limit 1;
  if rid is not null then
    update public.member_join_requests set
      full_name=coalesce(nullif(trim(requested_name),''),full_name),email=mail,note=requested_note,
      member_number=requested_member_number,membership_type_id=requested_membership_type,updated_at=now()
    where id=rid;
    return rid;
  end if;

  insert into public.member_join_requests(club_id,user_id,full_name,email,note,member_number,membership_type_id)
  values(target_club,uid,coalesce(nullif(trim(requested_name),''),split_part(mail,'@',1)),mail,requested_note,requested_member_number,requested_membership_type)
  returning id into rid;
  return rid;
end $$;
grant execute on function public.request_club_membership_v41(uuid,uuid,text,text,text) to authenticated;

-- Review now carries the requested membership level onto the approved member record.
create or replace function public.review_member_join_request(request_id uuid, decision text)
returns uuid language plpgsql security definer set search_path=public as $$
declare r public.member_join_requests%rowtype; mid uuid;
begin
 select * into r from public.member_join_requests where id=request_id for update;
 if r.id is null then raise exception 'Request not found'; end if;
 if not public.is_club_admin(r.club_id) then raise exception 'Club administrator access required'; end if;
 if r.status <> 'pending' then raise exception 'Request has already been reviewed'; end if;
 if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 if decision='approved' and (r.membership_type_id is null or not exists(select 1 from public.membership_types where id=r.membership_type_id and club_id=r.club_id)) then
   raise exception 'A valid membership level is required before approval';
 end if;
 update public.member_join_requests set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
 if decision='approved' then
   insert into public.profiles(id,full_name,email) values(r.user_id,r.full_name,r.email)
   on conflict(id) do update set full_name=coalesce(public.profiles.full_name,excluded.full_name),email=coalesce(public.profiles.email,excluded.email);
   insert into public.club_users(club_id,user_id,role,active) values(r.club_id,r.user_id,'member',true)
   on conflict(club_id,user_id) do update set role='member',active=true;
   select id into mid from public.members where club_id=r.club_id and (profile_id=r.user_id or lower(email)=lower(r.email)) limit 1;
   if mid is null then
     insert into public.members(club_id,profile_id,membership_type_id,member_number,full_name,email,status,good_standing)
     values(r.club_id,r.user_id,r.membership_type_id,nullif(trim(r.member_number),''),r.full_name,r.email,'active',true);
   else
     update public.members set profile_id=r.user_id,membership_type_id=r.membership_type_id,full_name=r.full_name,email=r.email,
       member_number=coalesce(nullif(trim(r.member_number),''),member_number),status='active' where id=mid;
   end if;
 end if;
 return r.club_id;
end $$;
grant execute on function public.review_member_join_request(uuid,text) to authenticated;
