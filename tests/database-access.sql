-- Exercises real PostgreSQL RLS with non-owner roles. Every fixture is rolled back.
begin;
create temp table test_results(name text);
grant select,insert on test_results to authenticated,anon,service_role;
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %',label; end if; insert into test_results values(label); end $$;
create function pg_temp.denied(command text,label text) returns void language plpgsql as $$ declare failed boolean:=false; begin begin execute command; exception when others then failed:=true; end; perform pg_temp.ok(failed,label); end $$;
insert into auth.users(id,email,email_confirmed_at) select ('10000000-0000-0000-0000-00000000000'||i)::uuid,'person'||i||'@example.test',now() from generate_series(1,9) i;
insert into public.profiles(id,full_name,email,platform_role) select id,'Test person',email,case when email='person1@example.test' then 'super_admin'::public.platform_role else 'user'::public.platform_role end from auth.users;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.clubs(id,name,slug,organization_type) values('20000000-0000-0000-0000-000000000001','Golf Organization','test-golf','golf_club'),('20000000-0000-0000-0000-000000000002','HOA Organization','test-hoa','hoa');
insert into public.club_users(club_id,user_id,role) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','admin'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','admin'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','member'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','member'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','staff'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','admin'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000007','member'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000008','member');
insert into public.club_modules(club_id,module_key,licensed,club_enabled,enabled,member_visible)
select c.id,k,true,true,true,true from public.clubs c cross join unnest(array['members','memberships','events','staff','operations','communications','golf','website_builder','email_center','access','reports']) k;
insert into public.membership_types(id,club_id,name) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Golf member'),('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Resident');
insert into public.members(id,club_id,profile_id,full_name,membership_type_id) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','Member A','30000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','Member B','30000000-0000-0000-0000-000000000002'),
('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000008','Member C','30000000-0000-0000-0000-000000000001');
insert into public.club_events(id,club_id,title,starts_at,capacity) values('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','One seat',now()+interval '1 day',1),('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Other organization',now()+interval '1 day',10);
insert into public.organization_sites(club_id,title,published,pages) values('20000000-0000-0000-0000-000000000001','Golf site',true,'[{"slug":"public","title":"Public page","body":"Public text"},{"slug":"secret","title":"Draft","body":"DRAFT SECRET","published":false}]');
insert into public.club_invitations(club_id,email,role,token) values('20000000-0000-0000-0000-000000000001','person5@example.test','member','60000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.ok((select count(*) from public.members)=1,'Member reads only own private member record');
select pg_temp.ok((select count(*) from public.clubs)=1,'Member cannot read another organization');
select pg_temp.ok((select count(*) from public.v11_member_directory('20000000-0000-0000-0000-000000000001'))=2,'Directory exposes allowed organization projection');
select pg_temp.ok((select count(*) from public.v11_member_directory('20000000-0000-0000-0000-000000000002'))=0,'Directory denies cross-tenant request');
select pg_temp.denied($q$insert into public.club_user_permissions(club_id,user_id,module_key) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','operations')$q$,'Member cannot grant permissions');
select pg_temp.denied($q$insert into public.operational_tasks(club_id,title) values('20000000-0000-0000-0000-000000000001','Forged')$q$,'Member cannot create operations');
select pg_temp.denied($q$insert into public.audit_log(action) values('Forged')$q$,'User cannot forge global audit events');
select pg_temp.ok((select count(*) from public.audit_log)=0,'Member cannot read audit logs');
select pg_temp.denied($q$select public.v11_register_event('50000000-0000-0000-0000-000000000002')$q$,'Cross-organization event denied');
select pg_temp.ok(public.v11_register_event('50000000-0000-0000-0000-000000000001') is not null,'Member event registration succeeds');
select pg_temp.ok(public.v11_register_event('50000000-0000-0000-0000-000000000001') is not null,'Duplicate registration is idempotent');
select pg_temp.ok((select count(*) from public.event_registrations)=1,'No duplicate registrations');
select public.v11_update_phone('20000000-0000-0000-0000-000000000001','555-0100');
select pg_temp.ok((select phone from public.members limit 1)='555-0100','Member can update own phone');
with changed as (update public.members set good_standing=false returning id) select pg_temp.ok((select count(*) from changed)=0,'Member cannot change membership standing');
select pg_temp.denied($q$insert into public.golf_scorecards(club_id,user_id,played_on,course_name,course_rating,slope_rating,holes,gross_score,differential) values('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004',current_date,'Course',72,113,array_fill(4,array[18]),72,0)$q$,'Cross-tenant golf score denied');
insert into public.golf_scorecards(club_id,user_id,played_on,course_name,course_rating,slope_rating,holes,gross_score,differential) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004',current_date,'Course',72,113,array_fill(4,array[18]),99,99);
select pg_temp.ok((select gross_score=72 and differential=0 from public.golf_scorecards limit 1),'Golf totals calculated by database');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000008',true);
select pg_temp.denied($q$select public.v11_register_event('50000000-0000-0000-0000-000000000001')$q$,'Full event rejects second member');
select pg_temp.ok((select count(*) from public.event_registrations)=0,'Member cannot read another member registration');
select pg_temp.ok((select registered from public.v11_event_counts('20000000-0000-0000-0000-000000000001') limit 1)=1,'Aggregate count does not expose attendee identities');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select public.v11_register_event('50000000-0000-0000-0000-000000000001',true);
select pg_temp.ok((select status from public.event_registrations limit 1)='cancelled','Member cancels own event registration');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',true);
select pg_temp.ok(not public.v11_can_module('20000000-0000-0000-0000-000000000001','operations'),'Staff denied without explicit grant');
select pg_temp.denied($q$insert into public.operational_tasks(club_id,title) values('20000000-0000-0000-0000-000000000001','Forged')$q$,'Staff cannot write without permission');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
insert into public.club_user_permissions(club_id,user_id,module_key,can_view,can_create) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','operations',true,true),('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','staff',true,false);
select pg_temp.denied($q$update public.clubs set plan='enterprise' where id='20000000-0000-0000-0000-000000000001'$q$,'Organization admin cannot change platform billing');
select pg_temp.denied($q$update public.club_modules set licensed=false where club_id='20000000-0000-0000-0000-000000000001' and module_key='golf'$q$,'Organization admin cannot change licensing');
select pg_temp.denied($q$insert into public.members(club_id,full_name,membership_type_id) values('20000000-0000-0000-0000-000000000001','Cross reference','30000000-0000-0000-0000-000000000002')$q$,'Cross-tenant membership type reference denied');
select pg_temp.denied($q$insert into storage.objects(bucket_id,name) values('club-branding','20000000-0000-0000-0000-000000000002/logo.png')$q$,'Cross-tenant logo upload denied');
insert into storage.objects(bucket_id,name) values('club-branding','20000000-0000-0000-0000-000000000001/logo.png');
select pg_temp.ok(true,'Organization admin can upload own logo');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',true);
insert into public.operational_tasks(club_id,title) values('20000000-0000-0000-0000-000000000001','Authorized task');
select pg_temp.ok((select count(*) from public.operational_tasks)=1,'Staff create permission works');
with changed as(update public.operational_tasks set title='Not permitted' returning id) select pg_temp.ok((select count(*) from changed)=0,'Create grant does not imply edit');
insert into public.staff_time_entries(club_id,user_id,clock_in) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','2000-01-01');
select pg_temp.ok((select clock_in>now()-interval '1 minute' from public.staff_time_entries limit 1),'Clock-in uses database time');
select pg_temp.denied($q$insert into public.staff_time_entries(club_id,user_id) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006')$q$,'Duplicate open shift denied');
update public.staff_time_entries set clock_out='2000-01-01' where user_id=auth.uid();
select pg_temp.ok((select clock_out>=clock_in from public.staff_time_entries limit 1),'Clock-out uses database time');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000007',true);
select pg_temp.ok(public.is_club_admin('20000000-0000-0000-0000-000000000001') and not public.is_club_admin('20000000-0000-0000-0000-000000000002'),'Multi-organization roles remain independent');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
with changed as(update public.club_invitations set role='owner' returning id) select pg_temp.ok((select count(*) from changed)=0,'Invitee cannot promote invitation role');
select pg_temp.ok(public.accept_club_invitation('60000000-0000-0000-0000-000000000001')='20000000-0000-0000-0000-000000000001','Matching verified email accepts invitation');
select pg_temp.denied($q$select public.accept_club_invitation('60000000-0000-0000-0000-000000000001')$q$,'Invitation cannot be reused');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
update public.club_modules set club_enabled=false where club_id='20000000-0000-0000-0000-000000000001' and module_key='golf';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.ok(not public.v11_can_module('20000000-0000-0000-0000-000000000001','golf'),'Disabled module denied');
select pg_temp.ok((select count(*) from public.golf_scorecards)=0,'Disabled golf hides data through RLS');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.ok((select count(*) from public.organization_sites)=0,'Anonymous users cannot query raw website drafts');
select pg_temp.ok(public.v11_public_site('20000000-0000-0000-0000-000000000001')->>'title'='Golf site','Published website remains public');
select pg_temp.ok(public.v11_public_site('20000000-0000-0000-0000-000000000001')::text not like '%DRAFT SECRET%','Draft page content excluded at database boundary');
select pg_temp.ok((select count(*) from public.v11_public_branding('20000000-0000-0000-0000-000000000001'))=1,'Public branding projection available');
select pg_temp.denied($q$insert into public.organization_site_messages(club_id,sender_name,sender_email,message) values('20000000-0000-0000-0000-000000000001','Spam','x@example.test','No')$q$,'Anonymous direct inbox writes denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.ok(public.v11_create_organization('New organization','new-test-organization','hoa','starter','#275e72','admin@example.test',array['members','events']) is not null,'Atomic organization onboarding succeeds');
select pg_temp.ok((select count(*) from public.club_modules m join public.clubs c on c.id=m.club_id where c.slug='new-test-organization' and m.licensed and not m.club_enabled and not m.member_visible)=2,'Onboarding licenses modules without activating them');
select pg_temp.ok((select count(*) from public.club_invitations i join public.clubs c on c.id=i.club_id where c.slug='new-test-organization' and i.email='admin@example.test')=1,'Onboarding stages administrator invitation');
select pg_temp.denied($q$select public.v11_create_organization('Bad organization','bad-test-organization','hoa','starter','#275e72','',array['not-a-module'])$q$,'Invalid module aborts organization creation');
select pg_temp.ok(not exists(select 1 from public.clubs where slug='bad-test-organization'),'Failed onboarding leaves no partial organization');
select pg_temp.ok(exists(select 1 from public.audit_log where actor_id=auth.uid() and target_type='clubs' and action='insert'),'Administrative mutation writes real audit event');
update public.club_events set registration_deadline=now()-interval '1 hour' where id='50000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.denied($q$select public.v11_register_event('50000000-0000-0000-0000-000000000001')$q$,'Registration deadline enforced by database');
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub','',true);
insert into public.organization_site_messages(club_id,sender_name,sender_email,message) select '20000000-0000-0000-0000-000000000001','Visitor','visitor@example.test','Inquiry '||n from generate_series(1,5) n;
select pg_temp.denied($q$insert into public.organization_site_messages(club_id,sender_name,sender_email,message) values('20000000-0000-0000-0000-000000000001','Visitor','visitor@example.test','Too many')$q$,'Contact sender rate limit preserved');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((select count(*) from public.organization_site_messages)=5,'Website inquiries arrive in correct organization inbox');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.ok((select count(*) from public.organization_site_messages)=0,'Other organization administrator cannot read inquiries');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000009',true);
select pg_temp.denied($q$select public.request_club_membership_v41('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Applicant')$q$,'Application rejects another organization membership level');
select pg_temp.ok(public.request_club_membership_v41('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Applicant') is not null,'Member application recorded');
select pg_temp.denied($q$select public.review_member_join_request((select id from public.member_join_requests where user_id=auth.uid()),'approved')$q$,'Applicant cannot approve themselves');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.ok(public.review_member_join_request((select id from public.member_join_requests where user_id='10000000-0000-0000-0000-000000000009'),'approved')='20000000-0000-0000-0000-000000000001','Administrator approves organization application');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000009',true);
select pg_temp.ok(public.club_role_for('20000000-0000-0000-0000-000000000001')='member','Approved member receives organization role');
select pg_temp.ok((select membership_type_id from public.members where profile_id=auth.uid())='30000000-0000-0000-0000-000000000001','Approved member receives requested membership level');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
update public.clubs set status='suspended' where id='20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.ok(not public.is_club_admin('20000000-0000-0000-0000-000000000001'),'Inactive organization denies admin');
select pg_temp.ok((select count(*) from public.members)=0,'Inactive organization hides member data');
select pg_temp.ok((select count(*) from public.organization_site_messages)=0,'Inactive organization hides inbox');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.ok(public.v11_public_site('20000000-0000-0000-0000-000000000001') is null,'Inactive organization public website unavailable');
reset role;
select count(*) || ' database authorization/workflow assertions passed' as result from test_results;
rollback;
