-- NADORIO v11. Apply once after BOTH 010 migrations and 011-018.
-- Transactional, additive schema; replaces policies on the explicitly listed core tables.
-- Review any custom policies before deployment. No organization records are deleted.
begin;
alter table public.clubs add column if not exists organization_type text not null default 'other';
alter table public.clubs add column if not exists industry_label text;
alter table public.clubs add column if not exists subscription_status text not null default 'unconfigured';
alter table public.clubs add column if not exists billing_email text;
alter table public.clubs add column if not exists support_tier text not null default 'standard';
alter table public.clubs add column if not exists onboarding_complete boolean not null default false;
alter table public.clubs add column if not exists launch_status text not null default 'setup';
alter table public.clubs add column if not exists onboarding_stage text;
alter table public.clubs add column if not exists launched_at timestamptz;
alter table public.clubs add column if not exists checkin_activities text[] not null default array['General'];
update public.clubs set organization_type=case when club_type='golf_country' then 'private_club' else club_type end where organization_type='other' and club_type is not null;
alter table public.module_catalog add column if not exists available boolean not null default true;
alter table public.module_catalog add column if not exists compatible_types text[] not null default '{}';
update public.module_catalog set available=false where module_key in ('weather','payments','time_clock','documents','reservations','automations','intelligence');
insert into public.module_catalog(module_key,name,description,sort_order,available) values
('website_management','External Website Integration','Optional connection to a separately hosted GitHub website',180,true)
on conflict(module_key) do nothing;
alter table public.club_events add column if not exists image_url text;
alter table public.club_events add column if not exists guests_allowed integer not null default 0;
alter table public.event_registrations add column if not exists status text not null default 'registered';

create table if not exists public.organization_onboarding (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 organization_complete boolean not null default false, branding_complete boolean not null default false,
 modules_complete boolean not null default false, admin_complete boolean not null default false,
 people_imported boolean not null default false, launch_complete boolean not null default false,
 completed_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.support_cases (
 id uuid primary key default gen_random_uuid(), club_id uuid references public.clubs(id) on delete cascade,
 opened_by uuid references public.profiles(id), subject text not null check(length(subject) between 1 and 200), detail text,
 status text not null default 'open' check(status in ('open','in_progress','waiting','resolved','closed')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 assigned_to uuid references public.profiles(id), resolution text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.support_cases add column if not exists priority text not null default 'normal';
alter table public.support_cases add column if not exists assigned_to uuid references public.profiles(id);
alter table public.support_cases add column if not exists resolution text;
alter table public.organization_onboarding enable row level security;
alter table public.support_cases enable row level security;

create or replace function public.has_club_access(target uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or exists(select 1 from public.club_users u join public.clubs c on c.id=u.club_id where u.user_id=auth.uid() and u.club_id=target and u.active and c.status='active');
$$;
create or replace function public.is_club_admin(target uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_super_admin() or exists(select 1 from public.club_users u join public.clubs c on c.id=u.club_id where u.user_id=auth.uid() and u.club_id=target and u.active and c.status='active' and u.role in ('owner','admin'));
$$;
create or replace function public.v11_module_enabled(target uuid, module text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.club_modules m join public.module_catalog c using(module_key)
 where m.club_id=target and m.module_key=module and m.licensed and m.club_enabled and c.available);
$$;
create or replace function public.v11_can_module(target uuid, module text, operation text default 'view') returns boolean
language sql stable security definer set search_path=public as $$
 select operation in ('view','create','edit','delete') and public.has_club_access(target) and public.v11_module_enabled(target,module) and (
 public.is_club_admin(target) or exists(
 select 1 from public.club_users u join public.club_modules m on m.club_id=u.club_id and m.module_key=module
 left join public.club_user_permissions p on p.club_id=u.club_id and p.user_id=u.user_id and p.module_key=module
 where u.club_id=target and u.user_id=auth.uid() and u.active and (
  (u.role='member' and operation='view' and m.member_visible and module in ('members','events','amenities','golf','communications'))
  or (u.role in ('staff','manager') and module not in ('memberships','email_center','website_builder','website_management','connected_platforms','tee_sheet') and p.can_view and
    case operation when 'view' then p.can_view when 'create' then p.can_create when 'edit' then p.can_edit when 'delete' then p.can_delete else false end)
 )));
$$;
create or replace function public.v11_can_write(target uuid,module text,operation text) returns boolean
language sql stable security definer set search_path=public as $$
 select public.club_role_for(target) <> 'member' and public.v11_can_module(target,module,operation);
$$;
create or replace function public.v11_own_member(target uuid,member uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.has_club_access(target) and exists(select 1 from public.members where id=member and club_id=target and profile_id=auth.uid());
$$;
-- Core policy replacement removes the old "all tenant users can write" policies.
do $$ declare t text; p record; begin
 foreach t in array array['members','membership_types','amenities','events','club_events','event_registrations','access_log','guest_passes','staff_time_entries','operational_tasks','announcements','golf_tournaments','connected_platforms','club_settings','club_activity','checkins','tee_sheet_settings','tee_time_blocks','tee_time_bookings','club_user_permissions','club_invitations','audit_log','organization_onboarding','support_cases','module_catalog'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
 end loop;
end $$;
-- Operations whose row ownership needs no additional restriction.
do $$ declare pair text[]; t text; k text; begin
 foreach pair slice 1 in array array[
 ['amenities','amenities'],['events','events'],['operational_tasks','operations'],['golf_tournaments','golf'],
 ['connected_platforms','connected_platforms'],['tee_sheet_settings','tee_sheet'],['tee_time_blocks','tee_sheet'],
 ['access_log','access'],['checkins','access']
 ] loop
 t:=pair[1];k:=pair[2];
 execute format('create policy v11_read on public.%I for select to authenticated using(public.v11_can_module(club_id,%L))',t,k);
 execute format('create policy v11_insert on public.%I for insert to authenticated with check(public.v11_can_write(club_id,%L,''create''))',t,k);
 execute format('create policy v11_update on public.%I for update to authenticated using(public.v11_can_write(club_id,%L,''edit'')) with check(public.v11_can_write(club_id,%L,''edit''))',t,k,k);
 execute format('create policy v11_delete on public.%I for delete to authenticated using(public.v11_can_write(club_id,%L,''delete''))',t,k);
 end loop;
end $$;
create policy v11_member_read on public.members for select to authenticated using(public.has_club_access(club_id) and (profile_id=auth.uid() or public.v11_can_write(club_id,'members','view') or public.v11_can_write(club_id,'access','view') or public.v11_can_write(club_id,'reports','view')));
create policy v11_member_insert on public.members for insert to authenticated with check(public.v11_can_write(club_id,'members','create'));
create policy v11_member_update on public.members for update to authenticated using(public.v11_can_write(club_id,'members','edit')) with check(public.v11_can_write(club_id,'members','edit'));
create policy v11_member_delete on public.members for delete to authenticated using(public.v11_can_write(club_id,'members','delete'));
create policy v11_membership_read on public.membership_types for select to authenticated using(public.has_club_access(club_id));
create policy v11_membership_manage on public.membership_types for all to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'memberships')) with check(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'memberships'));
create policy v11_event_read on public.club_events for select to authenticated using(public.v11_can_module(club_id,'events') and (status='published' or public.v11_can_write(club_id,'events','view')));
create policy v11_event_insert on public.club_events for insert to authenticated with check(public.v11_can_write(club_id,'events','create'));
create policy v11_event_update on public.club_events for update to authenticated using(public.v11_can_write(club_id,'events','edit')) with check(public.v11_can_write(club_id,'events','edit'));
create policy v11_event_delete on public.club_events for delete to authenticated using(public.v11_can_write(club_id,'events','delete'));
create policy v11_reg_read on public.event_registrations for select to authenticated using(public.v11_can_module(club_id,'events') and (user_id=auth.uid() or public.v11_can_write(club_id,'events','view')));
-- Registrations are written only by the checked, serialized RPC below.
create policy v11_permissions_read on public.club_user_permissions for select to authenticated using(public.has_club_access(club_id) and (user_id=auth.uid() or public.is_club_admin(club_id)));
create policy v11_permissions_manage on public.club_user_permissions for all to authenticated using(public.is_club_admin(club_id)) with check(public.is_club_admin(club_id) and exists(select 1 from public.club_users u where u.club_id=club_user_permissions.club_id and u.user_id=club_user_permissions.user_id and u.active and u.role in ('staff','manager')));
create policy v11_invites_read on public.club_invitations for select to authenticated using(public.is_club_admin(club_id));
create policy v11_invites_manage on public.club_invitations for all to authenticated using(public.is_club_admin(club_id)) with check(public.is_club_admin(club_id));
create policy v11_catalog_read on public.module_catalog for select to authenticated using(true);
create policy v11_catalog_manage on public.module_catalog for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy v11_audit_read on public.audit_log for select to authenticated using(public.is_super_admin() or (club_id is not null and public.is_club_admin(club_id)));
-- Audit events are generated by trusted triggers, not forged browser inserts.
create policy v11_onboarding on public.organization_onboarding for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy v11_support on public.support_cases for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy v11_settings_read on public.club_settings for select to authenticated using(public.has_club_access(club_id));
create policy v11_settings_manage on public.club_settings for all to authenticated using(public.is_club_admin(club_id)) with check(public.is_club_admin(club_id));
create policy v11_activity_read on public.club_activity for select to authenticated using(public.is_club_admin(club_id));
create policy v11_announcements_read on public.announcements for select to authenticated using(public.v11_can_module(club_id,'communications') and (public.v11_can_write(club_id,'communications','view') or (status='published' and (audience='all' or (audience='members' and public.club_role_for(club_id)='member') or (audience='staff' and public.club_role_for(club_id)<>'member')))));
create policy v11_announcements_insert on public.announcements for insert to authenticated with check(public.v11_can_write(club_id,'communications','create'));
create policy v11_announcements_update on public.announcements for update to authenticated using(public.v11_can_write(club_id,'communications','edit')) with check(public.v11_can_write(club_id,'communications','edit'));
create policy v11_announcements_delete on public.announcements for delete to authenticated using(public.v11_can_write(club_id,'communications','delete'));
create policy v11_time_read on public.staff_time_entries for select to authenticated using(public.v11_can_module(club_id,'staff') and (user_id=auth.uid() or public.is_club_admin(club_id)));
create policy v11_time_insert on public.staff_time_entries for insert to authenticated with check(public.v11_can_module(club_id,'staff') and user_id=auth.uid() and public.club_role_for(club_id)<>'member');
create policy v11_time_update on public.staff_time_entries for update to authenticated using(public.v11_can_module(club_id,'staff') and user_id=auth.uid()) with check(public.v11_can_module(club_id,'staff') and user_id=auth.uid());
create policy v11_pass_read on public.guest_passes for select to authenticated using(public.v11_can_module(club_id,'access') and (public.v11_own_member(club_id,member_id) or public.v11_can_write(club_id,'access','view')));
create policy v11_pass_manage on public.guest_passes for all to authenticated using(public.v11_can_write(club_id,'access','edit')) with check(public.v11_can_write(club_id,'access','edit'));
create policy v11_tee_booking_manage on public.tee_time_bookings for all to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'tee_sheet')) with check(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'tee_sheet'));

-- Restrict personal profile edits to the supported phone field. Prevent tenant changes and foreign references.
create or replace function public.v11_row_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare row_data jsonb:=to_jsonb(new); old_data jsonb; parent text; col text; parent_club uuid; ref text;
begin
 if tg_op='UPDATE' then
  old_data:=to_jsonb(old);
  if row_data->>'club_id' is distinct from old_data->>'club_id' then raise exception 'Organization cannot be changed'; end if;
  if row_data->>'id' is distinct from old_data->>'id' then raise exception 'Record identity cannot be changed'; end if;
 end if;
 foreach col in array array['member_id','membership_type_id','event_id','block_id','amenity_id'] loop
  ref:=row_data->>col;
  if ref is not null then
   parent:=case col when 'member_id' then 'members' when 'membership_type_id' then 'membership_types' when 'event_id' then 'club_events' when 'block_id' then 'tee_time_blocks' when 'amenity_id' then 'amenities' end;
   execute format('select club_id from public.%I where id=$1',parent) into parent_club using ref::uuid;
   if parent_club is distinct from (row_data->>'club_id')::uuid then raise exception 'Related record belongs to another organization'; end if;
  end if;
 end loop; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['members','club_users','club_modules','club_invitations','club_user_permissions','member_join_requests','membership_types','amenities','club_events','event_registrations','access_log','checkins','guest_passes','tee_time_bookings','tee_time_blocks','staff_time_entries','operational_tasks','announcements','golf_tournaments','golf_scorecards','connected_platforms','organization_sites','organization_site_messages'] loop
 execute format('create trigger v11_row_guard before insert or update on public.%I for each row execute function public.v11_row_guard()',t);
 end loop;
end $$;
create or replace function public.v11_club_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_super_admin() and ((to_jsonb(new)-array['name','contact_email','website_url','logo_url','primary_color','secondary_color','background_color','surface_color','text_color','portal_title','welcome_message','timezone','organization_type','industry_label','checkin_activities']) is distinct from (to_jsonb(old)-array['name','contact_email','website_url','logo_url','primary_color','secondary_color','background_color','surface_color','text_color','portal_title','welcome_message','timezone','organization_type','industry_label','checkin_activities'])) then raise exception 'Platform account fields require CD7 permission'; end if;
 return new;
end $$;
create trigger v11_club_guard before update on public.clubs for each row execute function public.v11_club_guard();
create or replace function public.v11_time_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  perform pg_advisory_xact_lock(hashtext(new.club_id::text||new.user_id::text));
  if exists(select 1 from public.staff_time_entries where club_id=new.club_id and user_id=new.user_id and clock_out is null) then raise exception 'A shift is already open'; end if;
  new.clock_in:=now(); new.clock_out:=null;
 else
  if old.clock_out is not null or (to_jsonb(new)-'clock_out') is distinct from (to_jsonb(old)-'clock_out') then raise exception 'Only an open shift can be clocked out'; end if;
  new.clock_out:=now();
 end if; return new;
end $$;
create trigger v11_time_guard before insert or update on public.staff_time_entries for each row execute function public.v11_time_guard();

-- Serializes capacity checks with registration/cancellation. No client-provided identities/counts.
create or replace function public.v11_register_event(target_event uuid, cancel boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare e public.club_events%rowtype; m public.members%rowtype; rid uuid; seats integer;
begin
 select * into e from public.club_events where id=target_event for update;
 if e.id is null or not public.v11_can_module(e.club_id,'events') or public.club_role_for(e.club_id)<>'member' then raise exception 'Event access denied'; end if;
 if cancel then update public.event_registrations set status='cancelled' where event_id=e.id and user_id=auth.uid() returning id into rid; return rid; end if;
 if e.status<>'published' or e.starts_at<=now() or e.registration_deadline<=now() then raise exception 'Registration is closed'; end if;
 select * into m from public.members where club_id=e.club_id and profile_id=auth.uid() and status='active' and good_standing limit 1;
 if m.id is null then raise exception 'An active member record in good standing is required'; end if;
 select id into rid from public.event_registrations where event_id=e.id and user_id=auth.uid() and status='registered';
 if rid is not null then return rid; end if;
 select coalesce(sum(1+guests),0) into seats from public.event_registrations where event_id=e.id and status='registered';
 if e.capacity is not null and seats>=e.capacity then raise exception 'This event is full'; end if;
 insert into public.event_registrations(club_id,event_id,member_id,user_id,attendee_name,status) values(e.club_id,e.id,m.id,auth.uid(),m.full_name,'registered')
 on conflict(event_id,user_id) do update set status='registered',member_id=excluded.member_id,attendee_name=excluded.attendee_name returning id into rid;
 return rid;
end $$;
create or replace function public.v11_event_counts(target_club uuid) returns table(event_id uuid,registered bigint)
language sql stable security definer set search_path=public as $$
 select e.id,coalesce(sum(1+r.guests) filter(where r.status='registered'),0)::bigint from public.club_events e left join public.event_registrations r on r.event_id=e.id
 where e.club_id=target_club and public.v11_can_module(target_club,'events') and (e.status='published' or public.v11_can_write(target_club,'events','view')) group by e.id;
$$;
create or replace function public.v11_member_directory(target_club uuid) returns table(id uuid,full_name text,membership_name text)
language sql stable security definer set search_path=public as $$
 select m.id,m.full_name,t.name from public.members m left join public.membership_types t on t.id=m.membership_type_id and t.club_id=m.club_id
 where m.club_id=target_club and m.status='active' and public.v11_can_module(target_club,'members') order by m.full_name;
$$;
create or replace function public.can_use_golf_scorecard(target_club uuid,target_user uuid) returns boolean
language sql stable security definer set search_path=public as $$ select auth.uid()=target_user and public.v11_can_module(target_club,'golf'); $$;

-- Public branding is exposed through a minimal projection, never public access to clubs.*.
create or replace function public.v11_site_live(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.clubs where id=target and status='active') and public.v11_module_enabled(target,'website_builder');
$$;
create policy v11_site_active on public.organization_sites as restrictive for select to anon,authenticated using(public.is_club_admin(club_id) or public.v11_site_live(club_id));
create policy v11_site_write_active on public.organization_sites as restrictive for all to authenticated using((published and public.v11_site_live(club_id)) or public.is_club_admin(club_id)) with check(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'website_builder'));
create or replace function public.v11_public_branding(target_club uuid) returns table(name text,logo_url text,primary_color text)
language sql stable security definer set search_path=public as $$
 select c.name,c.logo_url,c.primary_color from public.clubs c join public.organization_sites s on s.club_id=c.id where c.id=target_club and s.published and public.v11_site_live(c.id);
$$;
-- Restrict logo writes to the first path segment's organization, including overwrite/delete.
drop policy if exists "club branding authenticated upload" on storage.objects;
drop policy if exists "club branding authenticated update" on storage.objects;
create policy v11_brand_insert on storage.objects for insert to authenticated with check(bucket_id='club-branding' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.is_club_admin(((storage.foldername(name))[1])::uuid));
create policy v11_brand_update on storage.objects for update to authenticated using(bucket_id='club-branding' and public.is_club_admin(((storage.foldername(name))[1])::uuid)) with check(bucket_id='club-branding' and public.is_club_admin(((storage.foldername(name))[1])::uuid));
create policy v11_brand_delete on storage.objects for delete to authenticated using(bucket_id='club-branding' and public.is_club_admin(((storage.foldername(name))[1])::uuid));

-- Real audit events. Record changed field names, never secrets or message contents.
create or replace function public.v11_audit_change() returns trigger language plpgsql security definer set search_path=public as $$
declare d jsonb; tenant uuid; keys jsonb;
begin
 d:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 tenant:=case when tg_table_name='clubs' then (d->>'id')::uuid else (d->>'club_id')::uuid end;
 if (tg_table_name='clubs' and tg_op='DELETE') or not exists(select 1 from public.clubs where id=tenant) then tenant:=null; end if;
 if tg_op='UPDATE' then select jsonb_agg(k) into keys from jsonb_object_keys(d) k where d->k is distinct from to_jsonb(old)->k; if keys is null then return new; end if; end if;
 insert into public.audit_log(club_id,actor_id,action,target_type,target_id,detail) values(tenant,auth.uid(),lower(tg_op),tg_table_name,coalesce(d->>'id',d->>'module_key',d->>'club_id'),jsonb_build_object('changed_fields',coalesce(keys,'[]'::jsonb)));
 return case when tg_op='DELETE' then old else new end;
end $$;
do $$ declare t text; begin foreach t in array array['clubs','club_users','club_modules','club_user_permissions','club_invitations','module_catalog','support_cases','organization_sites'] loop
 execute format('create trigger v11_audit_change after insert or update or delete on public.%I for each row execute function public.v11_audit_change()',t); end loop; end $$;
-- Restrict privilege-bearing functions; anonymous public reads are granted explicitly.
do $$ declare f record; begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'v11_%' loop execute format('revoke all on function %s from public,anon',f.signature); execute format('grant execute on function %s to authenticated',f.signature); end loop; end $$;
grant execute on function public.v11_site_live(uuid),public.v11_module_enabled(uuid,text),public.v11_public_branding(uuid) to anon;
-- Publish only the explicit public page projection. Draft page bodies never leave the database.
drop policy if exists "nadorio site public read" on public.organization_sites;
create or replace function public.v11_public_site(target_club uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select to_jsonb(s) || jsonb_build_object('pages',coalesce((select jsonb_agg(p) from jsonb_array_elements(s.pages) p where p->>'published' is distinct from 'false'),'[]'::jsonb))
 from public.organization_sites s where s.club_id=target_club and s.published and public.v11_site_live(target_club);
$$;
revoke all on function public.v11_public_site(uuid) from public;
grant execute on function public.v11_public_site(uuid) to anon,authenticated;
create or replace function public.accept_club_invitation(invite_token uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare inv public.club_invitations%rowtype; uid uuid:=auth.uid(); mail text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select email into mail from auth.users where id=uid and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email before accepting an invitation'; end if;
 select * into inv from public.club_invitations where token=invite_token and status='pending' and expires_at>now() for update;
 if inv.id is null or lower(inv.email)<>lower(mail) then raise exception 'Invitation is invalid, expired, or belongs to another email address'; end if;
 if not exists(select 1 from public.clubs where id=inv.club_id and status='active') then raise exception 'Organization is inactive'; end if;
 if inv.member_id is not null and not exists(select 1 from public.members where id=inv.member_id and club_id=inv.club_id) then raise exception 'Invalid member reference'; end if;
 insert into public.profiles(id,full_name,email) values(uid,coalesce(inv.full_name,split_part(mail,'@',1)),mail) on conflict(id) do update set email=excluded.email;
 insert into public.club_users(club_id,user_id,role,active) values(inv.club_id,uid,inv.role,true) on conflict(club_id,user_id) do update set role=excluded.role,active=true;
 if inv.member_id is not null then update public.members set profile_id=uid,email=mail where id=inv.member_id and club_id=inv.club_id; end if;
 update public.club_invitations set status='accepted' where id=inv.id;
 return inv.club_id;
end $$;
-- The invitation RPC must be able to attach a previously unlinked member record;
-- normal profile edits use a column grant and a dedicated RPC, not a trigger bypass.

create or replace function public.v11_update_phone(target_club uuid, phone_value text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.has_club_access(target_club) or length(phone_value)>60 then raise exception 'Invalid profile update'; end if;
 update public.members set phone=phone_value where club_id=target_club and profile_id=auth.uid();
end $$;
create or replace function public.v11_create_organization(org_name text, org_slug text, org_type text, org_plan text, color text, admin_email text, module_keys text[]) returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if not public.is_super_admin() then raise exception 'Platform owner required'; end if;
 if length(trim(org_name)) not between 1 and 160 or org_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(org_slug)>80 or color !~ '^#[0-9a-fA-F]{6}$' or org_plan not in ('starter','professional','enterprise') then raise exception 'Invalid organization fields'; end if;
 if admin_email<>'' and admin_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid administrator email'; end if;
 if exists(select 1 from unnest(module_keys) k where not exists(select 1 from public.module_catalog c where c.module_key=k and c.available)) then raise exception 'A recommended module is unavailable'; end if;
 insert into public.clubs(name,slug,organization_type,club_type,plan,primary_color,contact_email,status) values(trim(org_name),org_slug,org_type,org_type,org_plan,color,nullif(admin_email,''),'active') returning id into cid;
 insert into public.club_modules(club_id,module_key,licensed,club_enabled,enabled,member_visible,sort_order,licensed_by,licensed_at)
 select cid,c.module_key,true,false,false,false,c.sort_order,auth.uid(),now() from public.module_catalog c where c.module_key=any(module_keys);
 if admin_email<>'' then insert into public.club_invitations(club_id,email,role,invited_by) values(cid,lower(admin_email),'admin',auth.uid()); end if;
 insert into public.organization_onboarding(club_id,organization_complete,branding_complete,modules_complete) values(cid,true,true,true);
 return cid;
end $$;
revoke all on function public.v11_update_phone(uuid,text),public.v11_create_organization(text,text,text,text,text,text,text[]) from public,anon;
grant execute on function public.v11_update_phone(uuid,text),public.v11_create_organization(text,text,text,text,text,text,text[]) to authenticated;
-- Platform-wide read views remain useful even before organizations activate licenses.
do $$ declare t text; begin foreach t in array array['members','amenities','club_events','access_log','staff_time_entries','operational_tasks','golf_tournaments','connected_platforms','event_registrations'] loop
 execute format('create policy v11_platform_read on public.%I for select to authenticated using(public.is_super_admin())',t); end loop; end $$;
alter table public.club_events add constraint v11_event_capacity check(capacity is null or capacity>0) not valid;
alter table public.club_events add constraint v11_event_dates check(registration_deadline is null or registration_deadline<=starts_at) not valid;
alter table public.event_registrations add constraint v11_registration_status check(status in ('registered','cancelled')) not valid;
create or replace function public.v11_checkin_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.clubs where id=new.club_id and new.access_type=any(checkin_activities)) then raise exception 'Choose a configured check-in activity'; end if;
 if new.member_id is null and nullif(trim(new.guest_name),'') is null then raise exception 'A member or guest name is required'; end if;
 if new.member_id is not null and nullif(trim(new.guest_name),'') is not null then raise exception 'Choose either a member or guest'; end if;
 new.checked_in_at:=now(); new.checked_in_by:=auth.uid(); return new;
end $$;
create trigger v11_checkin_guard before insert on public.access_log for each row execute function public.v11_checkin_guard();
revoke all on function public.v11_checkin_guard() from public,anon,authenticated;

drop policy if exists "join request admin update" on public.member_join_requests;
create or replace function public.review_member_join_request(request_id uuid, decision text)
returns uuid language plpgsql security definer set search_path=public as $$
declare r public.member_join_requests%rowtype; mid uuid;
begin
 select * into r from public.member_join_requests where id=request_id for update;
 if r.id is null then raise exception 'Request not found'; end if;
 if not public.is_club_admin(r.club_id) or not public.v11_module_enabled(r.club_id,'members') then raise exception 'Club administrator access required'; end if;
 if r.status <> 'pending' then raise exception 'Request has already been reviewed'; end if;
 if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 if decision='approved' and (r.membership_type_id is null or not exists(select 1 from public.membership_types where id=r.membership_type_id and club_id=r.club_id and active)) then
   raise exception 'A valid membership level is required before approval';
 end if;
 update public.member_join_requests set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
 if decision='approved' then
   if exists(select 1 from public.club_users where club_id=r.club_id and user_id=r.user_id and active) then raise exception 'This applicant already has active access; manage their existing role instead'; end if;
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

-- Existing inbox/profile policies must also honor organization suspension.
create policy "v11 inbox active organization" on public.organization_site_messages
as restrictive for select to authenticated using (
 public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'email_center')
);
drop policy if exists "profile club peers" on public.profiles;
create policy "profile club peers" on public.profiles for select using (
 id=auth.uid() or public.is_super_admin() or exists (
 select 1 from public.club_users me
 join public.club_users them on them.club_id=me.club_id
 join public.clubs c on c.id=me.club_id
 where me.user_id=auth.uid() and me.active and them.user_id=profiles.id and them.active and c.status='active'
 )
);
commit;
