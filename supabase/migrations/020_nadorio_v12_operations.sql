-- NADORIO v12. Apply once after 019. Back up and rehearse on staging first.
begin;
set local search_path=public,extensions;
create extension if not exists pg_trgm;
create index if not exists members_name_search on public.members using gin(full_name gin_trgm_ops);

-- Member operations: searchable, bounded lists; trusted change history; atomic imports.
create index if not exists members_club_name_id on public.members(club_id,full_name,id);
create index if not exists members_club_email on public.members(club_id,lower(email));
create index if not exists events_club_start on public.club_events(club_id,starts_at,id);
create index if not exists registrations_event_status on public.event_registrations(event_id,status,created_at);
create table public.member_history (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 member_id uuid references public.members(id) on delete set null, actor_id uuid references public.profiles(id) on delete set null,
 action text not null, changes jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.member_history enable row level security;
create policy member_history_read on public.member_history for select to authenticated using(public.v11_can_write(club_id,'members','view'));
create or replace function public.v12_member_change() returns trigger language plpgsql security definer set search_path=public as $$
declare changes jsonb; c uuid; mid uuid;
begin
 c:=coalesce(new.club_id,old.club_id); mid:=coalesce(new.id,old.id);
 if tg_op='UPDATE' then
  select coalesce(jsonb_object_agg(n.key,jsonb_build_object('before',to_jsonb(old)->n.key,'after',n.value)),'{}') into changes
  from jsonb_each(to_jsonb(new)) n where n.key in ('full_name','email','member_number','membership_type_id','status','good_standing','phone') and n.value is distinct from to_jsonb(old)->n.key;
  if changes='{}' then return new; end if;
 else changes:=jsonb_build_object('full_name',coalesce(new.full_name,old.full_name)); end if;
 insert into public.member_history(club_id,member_id,actor_id,action,changes) values(c,case when tg_op='DELETE' then null else mid end,auth.uid(),lower(tg_op),changes);
 return coalesce(new,old);
end $$;
create trigger v12_member_history after insert or update or delete on public.members for each row execute function public.v12_member_change();
create or replace function public.v12_member_identity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.email:=nullif(lower(trim(new.email)),'');new.member_number:=nullif(trim(new.member_number),'');new.full_name:=trim(new.full_name);
 if length(new.full_name) not between 1 and 160 then raise exception 'Member name must contain 1–160 characters'; end if;
 perform pg_advisory_xact_lock(hashtext(new.club_id::text||':members'));
 if new.email is not null and (tg_op='INSERT' or new.email is distinct from old.email) and exists(select 1 from public.members where club_id=new.club_id and lower(email)=new.email and id<>new.id) then raise exception 'A member with this email already exists in this organization'; end if;
 return new;
end $$;
create trigger v12_member_identity before insert or update on public.members for each row execute function public.v12_member_identity();
create or replace function public.v12_import_members(target_club uuid, rows_json jsonb, default_type uuid default null, dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; idx integer:=0; issues jsonb:='[]'; mail text; number_value text; seen_emails text[]:='{}'; seen_numbers text[]:='{}'; imported integer:=0;
begin
 if not public.v11_can_write(target_club,'members','create') then raise exception 'Member import permission required'; end if;
 if rows_json is null or jsonb_typeof(rows_json)<>'array' or jsonb_array_length(rows_json) not between 1 and 500 then raise exception 'Import 1–500 rows per batch'; end if;
 if default_type is not null and not exists(select 1 from public.membership_types where id=default_type and club_id=target_club and active) then raise exception 'Choose an active membership level from this organization'; end if;
 perform pg_advisory_xact_lock(hashtext(target_club::text||':members'));
 for item in select value from jsonb_array_elements(rows_json) loop
  idx:=idx+1;mail:=nullif(lower(trim(item->>'email')),'');number_value:=nullif(trim(item->>'member_number'),'');
  if jsonb_typeof(item)<>'object' or coalesce(length(trim(item->>'full_name')),0) not between 1 and 160 then issues:=issues||jsonb_build_object('row',idx,'message','Name must contain 1–160 characters'); end if;
  if mail is not null and (length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then issues:=issues||jsonb_build_object('row',idx,'message','Invalid email'); end if;
  if mail is not null and (mail=any(seen_emails) or exists(select 1 from public.members where club_id=target_club and lower(email)=mail)) then issues:=issues||jsonb_build_object('row',idx,'message','Duplicate email'); end if;
  if number_value is not null and (number_value=any(seen_numbers) or exists(select 1 from public.members where club_id=target_club and member_number=number_value)) then issues:=issues||jsonb_build_object('row',idx,'message','Duplicate member number'); end if;
  if length(coalesce(number_value,''))>80 or length(coalesce(item->>'phone',''))>80 then issues:=issues||jsonb_build_object('row',idx,'message','Member number or phone is too long'); end if;
  seen_emails:=array_append(seen_emails,mail);seen_numbers:=array_append(seen_numbers,number_value);
 end loop;
 if jsonb_array_length(issues)>0 or dry_run then return jsonb_build_object('valid',jsonb_array_length(issues)=0,'errors',issues,'count',idx,'imported',0); end if;
 for item in select value from jsonb_array_elements(rows_json) loop
  insert into public.members(club_id,full_name,email,member_number,phone,membership_type_id)
  values(target_club,trim(item->>'full_name'),nullif(lower(trim(item->>'email')),''),nullif(trim(item->>'member_number'),''),nullif(trim(item->>'phone'),''),default_type);
  imported:=imported+1;
 end loop;
 return jsonb_build_object('valid',true,'errors','[]'::jsonb,'count',idx,'imported',imported);
end $$;

-- Email jobs are created atomically, one private delivery per recipient.
create table public.email_templates (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id) on delete cascade,
 name text not null check(length(name) between 1 and 180),subject text not null check(length(subject) between 1 and 180),body text not null check(length(body) between 1 and 12000),created_at timestamptz not null default now()
);
create table public.email_campaigns (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id) on delete cascade,
 request_key text not null,subject text not null,body text not null,audience text not null,source text not null default 'announcement',event_id uuid references public.club_events(id) on delete cascade,registration_id uuid references public.event_registrations(id) on delete cascade,
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),unique(club_id,request_key)
);
create table public.email_deliveries (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id) on delete cascade,
 campaign_id uuid not null references public.email_campaigns(id) on delete cascade,recipient text not null,
 status text not null default 'queued' check(status in ('queued','sending','retry','accepted','delivered','bounced','failed','cancelled')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_token uuid,lease_until timestamptz,
 provider_id text unique,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(campaign_id,recipient)
);
create index email_queue_due on public.email_deliveries(next_attempt_at) where status in ('queued','retry','sending');
create index email_deliveries_campaign on public.email_deliveries(club_id,campaign_id,status);
create table public.provider_events (
 provider text not null,event_id text not null,object_id text,kind text not null,event_time timestamptz not null,payload jsonb not null default '{}',received_at timestamptz not null default now(),primary key(provider,event_id)
);
alter table public.provider_events enable row level security;
alter table public.email_templates enable row level security;alter table public.email_campaigns enable row level security;alter table public.email_deliveries enable row level security;
create policy templates_admin on public.email_templates for all to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'communications')) with check(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'communications'));
create policy campaigns_read on public.email_campaigns for select to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'communications'));
create policy deliveries_read on public.email_deliveries for select to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'communications'));
create or replace function public.v12_queue_announcement(target_club uuid,request_key_value uuid,subject_value text,body_value text,audience_value text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare cid uuid; total integer;
begin
 if not public.is_club_admin(target_club) or not public.v11_module_enabled(target_club,'communications') then raise exception 'Communications administrator access required'; end if;
 if request_key_value is null or subject_value is null or body_value is null or audience_value is null or length(trim(subject_value)) not between 1 and 180 or length(trim(body_value)) not between 1 and 12000 or audience_value not in ('all','staff','members') then raise exception 'Invalid subject, message or audience'; end if;
 perform pg_advisory_xact_lock(hashtext(target_club::text||request_key_value::text));
 select id into cid from public.email_campaigns where club_id=target_club and request_key=request_key_value::text;
 if cid is not null then
  if not exists(select 1 from public.email_campaigns where id=cid and subject=subject_value and body=body_value and audience=audience_value) then raise exception 'This request key belongs to a different message'; end if;
 else
  insert into public.email_campaigns(club_id,request_key,subject,body,audience,created_by) values(target_club,request_key_value::text,subject_value,body_value,audience_value,auth.uid()) returning id into cid;
  insert into public.email_deliveries(club_id,campaign_id,recipient)
  select target_club,cid,lower(trim(email)) from (
   select p.email from public.club_users u join public.profiles p on p.id=u.user_id where u.club_id=target_club and u.active and (audience_value='all' or audience_value='staff' and u.role in ('owner','admin','manager','staff'))
   union select coalesce(nullif(m.email,''),p.email) from public.members m left join public.profiles p on p.id=m.profile_id where m.club_id=target_club and m.status='active' and audience_value in ('all','members')
  ) r where email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' on conflict do nothing;
 end if;
 select count(*) into total from public.email_deliveries where campaign_id=cid;
 if total=0 then raise exception 'No email recipients found'; end if;
 if total>10000 then raise exception 'Audience exceeds the 10,000 recipient campaign limit'; end if;
 return jsonb_build_object('campaignId',cid,'queued',total);
end $$;
create or replace function public.v12_claim_email() returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.email_deliveries%rowtype; c public.email_campaigns%rowtype;
begin
 update public.email_deliveries set status='failed',last_error='Retry window expired; review before resending',updated_at=now() where status in ('queued','retry','sending') and (attempts>=5 or created_at<now()-interval '23 hours') and (lease_until is null or lease_until<now());
 select x.* into d from public.email_deliveries x join public.email_campaigns campaign on campaign.id=x.campaign_id join public.clubs o on o.id=x.club_id
 where o.status='active' and public.v11_module_enabled(x.club_id,case when campaign.source='announcement' then 'communications' else 'events' end)
 and ((x.status in ('queued','retry') and x.next_attempt_at<=now()) or (x.status='sending' and x.lease_until<now()))
 order by x.next_attempt_at,x.created_at for update of x skip locked limit 1;
 if d.id is null then return null; end if;
 update public.email_deliveries set status='sending',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now() where id=d.id returning * into d;
 select * into c from public.email_campaigns where id=d.campaign_id;
 return to_jsonb(d)||jsonb_build_object('subject',c.subject,'body',c.body,'organization',(select name from public.clubs where id=d.club_id),'reply_to',(select contact_email from public.clubs where id=d.club_id));
end $$;
create or replace function public.v12_finish_email(delivery_id uuid,lease uuid,accepted_id text default null,error_value text default null,permanent boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$
declare final_status text;
begin
 final_status:=case when accepted_id is not null then 'accepted' when permanent then 'failed' else 'retry' end;
 if accepted_id is not null then
  select case when bool_or(kind in ('email.bounced','email.complained')) then 'bounced' when bool_or(kind='email.delivered') then 'delivered' else 'accepted' end into final_status from public.provider_events where provider='resend' and object_id=accepted_id;
 end if;
 update public.email_deliveries set status=final_status,provider_id=accepted_id,last_error=left(error_value,500),lease_until=null,lease_token=null,next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),updated_at=now()
 where id=delivery_id and lease_token=lease and status='sending';
 return found;
end $$;
create or replace function public.v12_email_event(event_key text,email_id text,event_kind text,event_at timestamptz) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.provider_events(provider,event_id,object_id,kind,event_time) values('resend',event_key,email_id,event_kind,event_at) on conflict do nothing;
 update public.email_deliveries set status=case when event_kind in ('email.bounced','email.complained') then 'bounced' else 'delivered' end,updated_at=now()
 where provider_id=email_id and status in ('accepted','delivered') and event_kind in ('email.delivered','email.bounced','email.complained');
end $$;
create or replace function public.v12_campaign_counts(target_club uuid) returns table(campaign_id uuid,status text,total bigint) language sql stable security definer set search_path=public as $$
 select campaign_id,status,count(*) from public.email_deliveries where club_id=target_club and public.is_club_admin(target_club) and public.v11_module_enabled(target_club,'communications') group by campaign_id,status;
$$;

alter table public.announcements add column if not exists request_key uuid;
create unique index announcements_request_key on public.announcements(club_id,request_key);
create or replace function public.v12_publish_announcement(target_club uuid,request_key_value uuid,subject_value text,body_value text,audience_value text,email_value boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid;queued jsonb:='{}';
begin
 if not public.v11_can_write(target_club,'communications','create') then raise exception 'Announcement permission required';end if;
 if request_key_value is null or subject_value is null or body_value is null or audience_value is null or length(trim(subject_value)) not between 1 and 180 or length(trim(body_value)) not between 1 and 12000 or audience_value not in ('all','staff','members') then raise exception 'Invalid announcement';end if;
 perform pg_advisory_xact_lock(hashtext(target_club::text||request_key_value::text));
 select id into aid from public.announcements where club_id=target_club and request_key=request_key_value;
 if aid is not null then
  if not exists(select 1 from public.announcements where id=aid and title=subject_value and body=body_value and audience=audience_value) then raise exception 'Request key already used for a different announcement';end if;
 else
  insert into public.announcements(club_id,title,body,audience,created_by,request_key) values(target_club,subject_value,body_value,audience_value,auth.uid(),request_key_value) returning id into aid;
 end if;
 if email_value then queued:=public.v12_queue_announcement(target_club,request_key_value,subject_value,body_value,audience_value);end if;
 return queued||jsonb_build_object('announcementId',aid);
end $$;

-- Event waitlists, promotion, attendance, and queued transactional notifications.
alter table public.event_registrations add column if not exists waitlisted_at timestamptz;
alter table public.event_registrations add column if not exists attended_at timestamptz;
create or replace function public.v12_event_email(target_event uuid,target_registration uuid,kind_value text) returns void language plpgsql security definer set search_path=public as $$
declare e public.club_events%rowtype;r public.event_registrations%rowtype;mail text;cid uuid;
begin
 select * into e from public.club_events where id=target_event;select * into r from public.event_registrations where id=target_registration and event_id=target_event;
 select coalesce(nullif(m.email,''),p.email) into mail from public.members m left join public.profiles p on p.id=r.user_id where m.id=r.member_id;
 if e.id is null or r.id is null or mail is null or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return; end if;
 insert into public.email_campaigns(club_id,request_key,subject,body,audience,source,event_id,registration_id) values(e.club_id,kind_value||':'||r.id||':'||e.starts_at::text||':'||coalesce(r.waitlisted_at::text,'')||':'||coalesce(e.location,'')||':'||e.status,e.title||' — '||kind_value,'Event: '||e.title||E'\nStarts: '||e.starts_at::text||E'\nLocation: '||coalesce(e.location,'See your portal')||E'\nStatus: '||kind_value,'individual','event',e.id,r.id) on conflict(club_id,request_key) do update set request_key=excluded.request_key returning id into cid;
 insert into public.email_deliveries(club_id,campaign_id,recipient) values(e.club_id,cid,lower(trim(mail))) on conflict do nothing;
end $$;
create or replace function public.v12_register_event(target_event uuid,cancel boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.club_events%rowtype;m public.members%rowtype;r public.event_registrations%rowtype;promoted public.event_registrations%rowtype;seats integer;state text;
begin
 select * into e from public.club_events where id=target_event for update;
 if e.id is null or not public.v11_can_module(e.club_id,'events') or public.club_role_for(e.club_id)<>'member' then raise exception 'Event access denied'; end if;
 select * into r from public.event_registrations where event_id=e.id and user_id=auth.uid();
 if cancel then
  update public.email_deliveries d set status='cancelled',updated_at=now() from public.email_campaigns c where c.id=d.campaign_id and c.registration_id=r.id and d.status in ('queued','retry');
  update public.event_registrations set status='cancelled',attended_at=null where id=r.id;
  if r.status in ('registered','waitlisted') then perform public.v12_event_email(e.id,r.id,'Registration cancelled');end if;
  perform public.v12_promote_waitlist(e.id);
  return jsonb_build_object('id',r.id,'status','cancelled');
 end if;
 if e.status<>'published' or e.starts_at<=now() or e.registration_deadline<=now() then raise exception 'Registration is closed'; end if;
 select * into m from public.members where club_id=e.club_id and profile_id=auth.uid() and status='active' and good_standing limit 1;
 if m.id is null then raise exception 'An active member record in good standing is required'; end if;
 if r.status in ('registered','waitlisted') then return jsonb_build_object('id',r.id,'status',r.status);end if;
 select coalesce(sum(1+guests),0) into seats from public.event_registrations where event_id=e.id and status='registered';
 state:=case when e.capacity is not null and seats>=e.capacity then 'waitlisted' else 'registered' end;
 insert into public.event_registrations(club_id,event_id,member_id,user_id,attendee_name,status,waitlisted_at) values(e.club_id,e.id,m.id,auth.uid(),m.full_name,state,clock_timestamp())
 on conflict(event_id,user_id) do update set status=excluded.status,member_id=excluded.member_id,attendee_name=excluded.attendee_name,waitlisted_at=excluded.waitlisted_at,guests=0,attended_at=null returning * into r;
 perform public.v12_event_email(e.id,r.id,case when state='waitlisted' then 'Added to waitlist' else 'Registration confirmed' end);
 return jsonb_build_object('id',r.id,'status',state);
end $$;
create or replace function public.v12_attendance(registration_id uuid,present boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.event_registrations%rowtype;
begin
 select * into r from public.event_registrations where id=registration_id for update;
 if r.id is null or not public.v11_can_write(r.club_id,'events','edit') or r.status<>'registered' then raise exception 'Attendance permission or confirmed registration required';end if;
 update public.event_registrations set attended_at=case when present then now() else null end where id=r.id;
end $$;
create or replace function public.v12_promote_waitlist(target_event uuid) returns void language plpgsql security definer set search_path=public as $$
declare e public.club_events%rowtype;r record;seats integer;
begin
 select * into e from public.club_events where id=target_event for update;
 if e.status<>'published' or e.starts_at<=now() then return;end if;
 select coalesce(sum(1+guests),0) into seats from public.event_registrations where event_id=e.id and status='registered';
 for r in select x.* from public.event_registrations x join public.members m on m.id=x.member_id join public.club_users u on u.club_id=x.club_id and u.user_id=x.user_id
 where x.event_id=e.id and x.status='waitlisted' and m.status='active' and m.good_standing and u.active and u.role='member' order by x.waitlisted_at,x.id for update of x loop
  if e.capacity is not null and seats+1+r.guests>e.capacity then exit;end if;
  update public.event_registrations set status='registered' where id=r.id;seats:=seats+1+r.guests;
  update public.email_deliveries d set status='cancelled',updated_at=now() from public.email_campaigns c where c.id=d.campaign_id and c.registration_id=r.id and d.status in ('queued','retry');
  perform public.v12_event_email(e.id,r.id,'Registration confirmed');
 end loop;
end $$;
-- Old clients keep their full-event behavior, but cancellation follows the same waitlist rules.
create or replace function public.v11_register_event(target_event uuid,cancel boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare e public.club_events%rowtype;result jsonb;
begin
 select * into e from public.club_events where id=target_event for update;
 if not cancel and e.capacity is not null and (select coalesce(sum(1+guests),0) from public.event_registrations where event_id=e.id and status='registered')>=e.capacity
 and not exists(select 1 from public.event_registrations where event_id=e.id and user_id=auth.uid() and status='registered') then raise exception 'Event is full';end if;
 result:=public.v12_register_event(target_event,cancel);return (result->>'id')::uuid;
end $$;
create or replace function public.v12_change_event() returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
 if new.capacity is not null and new.capacity<(select coalesce(sum(1+guests),0) from public.event_registrations where event_id=new.id and status='registered') then raise exception 'Capacity cannot be smaller than confirmed registrations';end if;
 if new.status is distinct from old.status or new.starts_at is distinct from old.starts_at or new.location is distinct from old.location then
  update public.email_deliveries d set status='cancelled',updated_at=now() from public.email_campaigns c where c.id=d.campaign_id and c.event_id=new.id and d.status in ('queued','retry');
  for r in select id from public.event_registrations where event_id=new.id and status in ('registered','waitlisted') loop
   perform public.v12_event_email(new.id,r.id,case when new.status<>'published' then 'Event cancelled' else 'Event updated' end);
  end loop;
  if new.status<>'published' then update public.event_registrations set status='cancelled',attended_at=null where event_id=new.id and status in ('registered','waitlisted');end if;
 end if;
 perform public.v12_promote_waitlist(new.id);
 return new;
end $$;
create trigger v12_event_change after update of status,starts_at,location,capacity on public.club_events for each row execute function public.v12_change_event();
create or replace function public.v12_queue_reminders() returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
 for r in select x.id,x.event_id from public.event_registrations x join public.club_events e on e.id=x.event_id join public.clubs c on c.id=e.club_id join public.members m on m.id=x.member_id left join public.profiles p on p.id=x.user_id
 where coalesce(nullif(m.email,''),p.email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and x.status='registered' and e.status='published' and c.status='active' and e.starts_at>now() and e.starts_at<=now()+interval '24 hours' and public.v11_module_enabled(e.club_id,'events')
 and not exists(select 1 from public.email_campaigns where club_id=e.club_id and request_key='Event reminder:'||x.id||':'||e.starts_at::text||':'||coalesce(x.waitlisted_at::text,'')||':'||coalesce(e.location,'')||':'||e.status) limit 500
 loop perform public.v12_event_email(r.event_id,r.id,'Event reminder');n:=n+1;end loop;return n;
end $$;
alter table public.event_registrations drop constraint if exists v11_registration_status;
alter table public.event_registrations add constraint v12_registration_status check(status in ('registered','waitlisted','cancelled')) not valid;
create trigger v12_template_guard before insert or update on public.email_templates for each row execute function public.v11_row_guard();

-- Draft saves never alter the live website. Publishing is explicit and revision checked.
create table public.site_drafts (
 club_id uuid primary key references public.clubs(id) on delete cascade,data jsonb not null,version integer not null default 0,
 updated_by uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now()
);
create table public.site_revisions (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id) on delete cascade,
 version integer not null,data jsonb not null,action text not null,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),unique(club_id,version)
);
insert into public.site_drafts(club_id,data) select club_id,to_jsonb(s) from public.organization_sites s;
alter table public.site_drafts enable row level security;alter table public.site_revisions enable row level security;
create policy draft_read on public.site_drafts for select to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'website_builder'));
create policy revision_read on public.site_revisions for select to authenticated using(public.is_club_admin(club_id) and public.v11_module_enabled(club_id,'website_builder'));
create index site_revision_recent on public.site_revisions(club_id,created_at desc);
create policy v12_site_insert_rpc_only on public.organization_sites as restrictive for insert to authenticated with check(false);
create policy v12_site_update_rpc_only on public.organization_sites as restrictive for update to authenticated using(false) with check(false);
create policy v12_site_delete_rpc_only on public.organization_sites as restrictive for delete to authenticated using(false);
create or replace function public.v12_save_site(target_club uuid,content jsonb,expected_version integer,publish_now boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.site_drafts%rowtype; normalized jsonb; page jsonb;
begin
 if not public.is_club_admin(target_club) or not public.v11_module_enabled(target_club,'website_builder') then raise exception 'Website administrator access required';end if;
 if content is null or expected_version is null or publish_now is null or jsonb_typeof(content)<>'object' or length(content::text)>300000 then raise exception 'Invalid or oversized website draft';end if;
 normalized:=jsonb_build_object('club_id',target_club,'title',coalesce(content->>'title',''),'tagline',coalesce(content->>'tagline',''),'about',coalesce(content->>'about',''),'contact_email',coalesce(content->>'contact_email',''),'phone',coalesce(content->>'phone',''),'address',coalesce(content->>'address',''),'hero_image_url',coalesce(content->>'hero_image_url',''),'services',coalesce(content->'services','[]'),'pages',coalesce(content->'pages','[]'));
 if not public.nadorio_valid_site_pages(normalized->'pages') or jsonb_typeof(normalized->'services')<>'array' or jsonb_array_length(normalized->'services')>50 then raise exception 'Invalid website pages or services';end if;
 if length(normalized->>'title')>160 or length(normalized->>'tagline')>500 or length(normalized->>'about')>24000 or length(normalized->>'hero_image_url')>2048 then raise exception 'Website content exceeds field limits';end if;
 if normalized->>'hero_image_url'<>'' and normalized->>'hero_image_url' !~ '^https://[^[:space:]]+$' then raise exception 'Hero image must use HTTPS';end if;
 if normalized->>'contact_email'<>'' and normalized->>'contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid contact email';end if;
 if exists(select 1 from jsonb_array_elements(normalized->'services') v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>200) then raise exception 'Services must be text up to 200 characters';end if;
 if exists(select 1 from jsonb_array_elements(normalized->'pages') p where p ? 'published' and jsonb_typeof(p->'published')<>'boolean') then raise exception 'Page visibility must be true or false';end if;
 if length(normalized->>'phone')>80 or length(normalized->>'address')>1000 or length(normalized->>'contact_email')>254 then raise exception 'Contact details exceed field limits';end if;
 if publish_now then
  if length(trim(normalized->>'title'))=0 or length(trim(normalized->>'about'))=0 then raise exception 'Add a title and introduction before publishing';end if;
  for page in select value from jsonb_array_elements(normalized->'pages') loop
   if page->>'published' is distinct from 'false' and (length(trim(page->>'title'))=0 or length(trim(page->>'body'))=0) then raise exception 'Published pages need a title and body';end if;
  end loop;
 end if;
 insert into public.site_drafts(club_id,data) values(target_club,normalized) on conflict do nothing;
 select * into d from public.site_drafts where club_id=target_club for update;
 if d.version<>expected_version then raise exception 'This draft changed in another session. Reload before saving';end if;
 update public.site_drafts set data=normalized,version=version+1,updated_by=auth.uid(),updated_at=now() where club_id=target_club returning * into d;
 if publish_now then
  insert into public.organization_sites(club_id,title,tagline,about,contact_email,phone,address,hero_image_url,services,pages,published,updated_at)
  values(target_club,normalized->>'title',normalized->>'tagline',normalized->>'about',normalized->>'contact_email',normalized->>'phone',normalized->>'address',normalized->>'hero_image_url',normalized->'services',normalized->'pages',true,now())
  on conflict(club_id) do update set title=excluded.title,tagline=excluded.tagline,about=excluded.about,contact_email=excluded.contact_email,phone=excluded.phone,address=excluded.address,hero_image_url=excluded.hero_image_url,services=excluded.services,pages=excluded.pages,published=true,updated_at=now();
 end if;
 insert into public.site_revisions(club_id,version,data,action,created_by) values(target_club,d.version,normalized,case when publish_now then 'published' else 'draft' end,auth.uid());
 delete from public.site_revisions where club_id=target_club and id not in (select id from public.site_revisions where club_id=target_club order by version desc limit 50);
 return jsonb_build_object('version',d.version,'data',normalized,'published',coalesce((select published from public.organization_sites where club_id=target_club),false));
end $$;
create or replace function public.v12_unpublish_site(target_club uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_club_admin(target_club) or not public.v11_module_enabled(target_club,'website_builder') then raise exception 'Website administrator access required';end if;
 update public.organization_sites set published=false,updated_at=now() where club_id=target_club;
end $$;

-- Organization subscriptions and signed provider event processing. Clients cannot forge payment state.
create table public.organization_subscriptions (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 customer_id text unique,subscription_id text unique,plan_key text,status text not null default 'unconfigured',price_id text,
 current_period_end timestamptz,cancel_at_period_end boolean not null default false,last_event_at timestamptz,
 checkout_token uuid,checkout_plan text,checkout_reserved_until timestamptz,updated_at timestamptz not null default now()
);
create table public.subscription_invoices (
 id text primary key,club_id uuid not null references public.clubs(id) on delete cascade,status text not null,currency text not null,
 amount_due bigint not null,amount_paid bigint not null,hosted_url text,last_event_at timestamptz,created_at timestamptz not null,updated_at timestamptz not null default now()
);
alter table public.organization_subscriptions enable row level security;alter table public.subscription_invoices enable row level security;
create policy subscription_read on public.organization_subscriptions for select to authenticated using(public.is_club_admin(club_id));
create policy invoice_read on public.subscription_invoices for select to authenticated using(public.is_club_admin(club_id));
create or replace function public.v12_reserve_checkout(target_club uuid,plan_value text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.organization_subscriptions%rowtype;
begin
 insert into public.organization_subscriptions(club_id) values(target_club) on conflict do nothing;
 select * into s from public.organization_subscriptions where club_id=target_club for update;
 if s.status in ('active','trialing','past_due','unpaid','incomplete','paused') then raise exception 'Manage your existing subscription through the billing portal';end if;
 if s.checkout_reserved_until>now() then
  if s.checkout_plan<>plan_value then raise exception 'A checkout for another plan is already open. Complete it or retry after it expires';end if;
 else update public.organization_subscriptions set checkout_token=gen_random_uuid(),checkout_plan=plan_value,checkout_reserved_until=now()+interval '35 minutes' where club_id=target_club returning * into s;
 end if;
 return to_jsonb(s);
end $$;
create or replace function public.v12_apply_subscription(event_key text,event_at timestamptz,customer_value text,subscription_value text,status_value text,price_value text,plan_value text,period_end timestamptz,cancel_value boolean) returns void
language plpgsql security definer set search_path=public as $$
declare s public.organization_subscriptions%rowtype;
begin
 select * into s from public.organization_subscriptions where customer_id=customer_value for update;
 if s.club_id is null then return;end if;
 if exists(select 1 from public.provider_events where provider='stripe' and event_id=event_key) then return;end if;
 insert into public.provider_events(provider,event_id,object_id,kind,event_time) values('stripe',event_key,subscription_value,'subscription',event_at);
 if s.last_event_at is not null and s.last_event_at>event_at then return;end if;
 if s.subscription_id is not null and s.subscription_id<>subscription_value and s.status in ('active','trialing','past_due','unpaid','paused') then raise exception 'Multiple live subscriptions require manual review';end if;
 update public.organization_subscriptions set subscription_id=subscription_value,status=status_value,price_id=price_value,plan_key=plan_value,current_period_end=period_end,cancel_at_period_end=cancel_value,last_event_at=event_at,updated_at=now(),checkout_reserved_until=null where club_id=s.club_id;
end $$;

create or replace function public.v12_apply_invoice(event_key text,event_at timestamptz,invoice jsonb) returns void language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 select club_id into cid from public.organization_subscriptions where customer_id=invoice->>'customer';if cid is null then return;end if;
 perform pg_advisory_xact_lock(hashtext(invoice->>'id'));
 if exists(select 1 from public.provider_events where provider='stripe' and event_id=event_key) then return;end if;
 insert into public.provider_events(provider,event_id,object_id,kind,event_time) values('stripe',event_key,invoice->>'id','invoice',event_at);
 insert into public.subscription_invoices(id,club_id,status,currency,amount_due,amount_paid,hosted_url,created_at,last_event_at)
 values(invoice->>'id',cid,invoice->>'status',invoice->>'currency',(invoice->>'amount_due')::bigint,(invoice->>'amount_paid')::bigint,invoice->>'hosted_invoice_url',to_timestamp((invoice->>'created')::bigint),event_at)
 on conflict(id) do update set status=excluded.status,currency=excluded.currency,amount_due=excluded.amount_due,amount_paid=excluded.amount_paid,hosted_url=excluded.hosted_url,last_event_at=excluded.last_event_at,updated_at=now()
 where subscription_invoices.club_id=cid and (subscription_invoices.last_event_at is null or subscription_invoices.last_event_at<=event_at);
end $$;

create or replace function public.v12_onboarding(target_club uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c public.clubs%rowtype;
begin
 if not public.is_club_admin(target_club) then raise exception 'Organization administrator access required';end if;
 select * into c from public.clubs where id=target_club;
 return jsonb_build_object('identity',length(c.name)>0 and length(c.slug)>0,'branding',c.logo_url is not null and c.primary_color is not null,
 'modules',exists(select 1 from public.club_modules where club_id=target_club and licensed and club_enabled),
 'administrator',exists(select 1 from public.club_users where club_id=target_club and active and role in ('owner','admin')),
 'members',exists(select 1 from public.members where club_id=target_club),
 'website',exists(select 1 from public.organization_sites where club_id=target_club and published),
 'billing',coalesce((select status from public.organization_subscriptions where club_id=target_club),'unconfigured'),
 'recorded',coalesce((select to_jsonb(o) from public.organization_onboarding o where club_id=target_club),'{}'));
end $$;
create or replace function public.v12_complete_setup(target_club uuid) returns void language plpgsql security definer set search_path=public as $$
declare state jsonb;
begin
 state:=public.v12_onboarding(target_club);
 if not (state->>'identity')::boolean or not (state->>'modules')::boolean or not (state->>'administrator')::boolean then raise exception 'Complete organization identity, module activation, and administrator access first';end if;
 insert into public.organization_onboarding(club_id,organization_complete,branding_complete,modules_complete,admin_complete,people_imported,launch_complete,completed_at,updated_at)
 values(target_club,true,(state->>'branding')::boolean,true,true,(state->>'members')::boolean,true,now(),now())
 on conflict(club_id) do update set organization_complete=true,branding_complete=excluded.branding_complete,modules_complete=true,admin_complete=true,people_imported=excluded.people_imported,launch_complete=true,completed_at=now(),updated_at=now();
end $$;

-- Website inbox keeps receipt and handling separate from actual outbound email delivery.
alter table public.organization_site_messages add column if not exists status text not null default 'new' check(status in ('new','read','resolved'));
alter table public.organization_site_messages add column if not exists handled_at timestamptz;
create index site_inbox_status on public.organization_site_messages(club_id,status,created_at desc);
create or replace function public.v12_message_status(message_id uuid,status_value text) returns void language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 select club_id into cid from public.organization_site_messages where id=message_id;
 if cid is null or not public.is_club_admin(cid) or not public.v11_module_enabled(cid,'email_center') then raise exception 'Inbox administrator access required';end if;
 if status_value is null or status_value not in ('new','read','resolved') then raise exception 'Invalid inquiry status';end if;
 update public.organization_site_messages set status=status_value,handled_at=case when status_value='new' then null else now() end where id=message_id;
end $$;
create or replace function public.v12_event_counts(target_club uuid,event_ids uuid[]) returns table(event_id uuid,registered bigint,waiting bigint)
language sql stable security definer set search_path=public as $$
 select e.id,coalesce(sum(1+r.guests) filter(where r.status='registered'),0)::bigint,count(r.id) filter(where r.status='waitlisted')
 from public.club_events e left join public.event_registrations r on r.event_id=e.id
 where e.club_id=target_club and e.id=any(event_ids) and cardinality(event_ids)<=25 and public.v11_can_module(target_club,'events') and (e.status='published' or public.v11_can_write(target_club,'events','view')) group by e.id;
$$;
-- Operational heartbeat contains no member or payment details.
create table public.job_heartbeats(name text primary key,started_at timestamptz,finished_at timestamptz,status text not null,details jsonb not null default '{}');
alter table public.job_heartbeats enable row level security;
grant select,insert,update on public.job_heartbeats to service_role;
create or replace function public.v12_health() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('schema',12,'database',true)$$;
-- Explicit grants: only the server service role can claim jobs or mutate provider state.
do $$ declare f record;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'v12_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;
end $$;
grant execute on function public.v12_message_status(uuid,text),public.v12_event_counts(uuid,uuid[]),public.v12_publish_announcement(uuid,uuid,text,text,text,boolean),public.v12_import_members(uuid,jsonb,uuid,boolean),public.v12_queue_announcement(uuid,uuid,text,text,text),public.v12_campaign_counts(uuid),public.v12_register_event(uuid,boolean),public.v12_attendance(uuid,boolean),public.v12_save_site(uuid,jsonb,integer,boolean),public.v12_unpublish_site(uuid),public.v12_onboarding(uuid),public.v12_complete_setup(uuid) to authenticated;
grant execute on function public.v12_apply_invoice(text,timestamptz,jsonb),public.v12_claim_email(),public.v12_finish_email(uuid,uuid,text,text,boolean),public.v12_email_event(text,text,text,timestamptz),public.v12_queue_reminders(),public.v12_reserve_checkout(uuid,text),public.v12_apply_subscription(text,timestamptz,text,text,text,text,text,timestamptz,boolean) to service_role;
grant select,insert,update,delete on public.email_templates,public.email_campaigns,public.email_deliveries,public.provider_events,public.organization_subscriptions,public.subscription_invoices,public.site_drafts,public.site_revisions,public.member_history to service_role;
grant select on public.member_history,public.email_campaigns,public.email_deliveries,public.site_drafts,public.site_revisions,public.organization_subscriptions,public.subscription_invoices to authenticated;
grant select,insert,update,delete on public.email_templates to authenticated;
grant execute on function public.v12_health() to anon,authenticated,service_role;
commit;
