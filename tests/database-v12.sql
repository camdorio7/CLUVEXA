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
-- v12 tests use real RLS, atomic RPCs, and service-only provider writes.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((public.v12_import_members('20000000-0000-0000-0000-000000000001','[{"full_name":"New Person","email":"NEW@example.test"}]',null,true)->>'valid')::boolean,'Valid CSV dry run');
select pg_temp.ok((select count(*) from members where email='new@example.test')=0,'Dry run never inserts');
select pg_temp.ok((public.v12_import_members('20000000-0000-0000-0000-000000000001','[{"full_name":"New Person","email":"NEW@example.test"}]',null,false)->>'imported')::int=1,'Atomic import creates one record');
select pg_temp.ok((select count(*) from members where email='new@example.test')=1,'Imported email normalized');
select pg_temp.ok(not (public.v12_import_members('20000000-0000-0000-0000-000000000001','[{"full_name":"Another","email":"new@example.test"},{"full_name":"Valid","email":"valid@example.test"}]',null,false)->>'valid')::boolean,'Duplicate import rejects whole batch');
select pg_temp.ok((select count(*) from members where email='valid@example.test')=0,'Failed import has no partial writes');
select pg_temp.ok(not (public.v12_import_members('20000000-0000-0000-0000-000000000001','[{"full_name":"One","email":"same@example.test"},{"full_name":"Two","email":"SAME@example.test"}]',null,false)->>'valid')::boolean,'Duplicates within file rejected');
select pg_temp.denied($q$select public.v12_import_members('20000000-0000-0000-0000-000000000002','[{"full_name":"Intruder"}]',null,false)$q$,'Cross-tenant import denied');
select pg_temp.denied($q$select public.v12_import_members('20000000-0000-0000-0000-000000000001',null,null,false)$q$,'Null import denied');
update members set phone='555-1111' where email='new@example.test';
select pg_temp.ok(exists(select 1 from member_history where action='update' and changes->'phone'->>'after'='555-1111'),'Member history records changes');
select pg_temp.denied($q$insert into member_history(club_id,action) values('20000000-0000-0000-0000-000000000001','forged')$q$,'Member history cannot be forged');
select pg_temp.ok(public.v12_publish_announcement('20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Notice','Hello','all',true)->>'queued' is not null,'Announcement queues email');
select public.v12_publish_announcement('20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Notice','Hello','all',true);
select pg_temp.ok((select count(*) from announcements where request_key='70000000-0000-0000-0000-000000000001')=1,'Announcement retry is idempotent');
select pg_temp.ok((select count(*) from email_campaigns)=1,'Campaign retry is idempotent');
select pg_temp.denied($q$select public.v12_publish_announcement('20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Changed','Hello','all',true)$q$,'Idempotency key cannot change content');
select pg_temp.denied($q$select public.v12_claim_email()$q$,'Client cannot claim email jobs');
select pg_temp.denied($q$select public.v12_queue_announcement('20000000-0000-0000-0000-000000000001',null,null,null,null)$q$,'Null announcement denied');
select pg_temp.denied($q$select public.v12_publish_announcement('20000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002','Intruder','Hello','all',true)$q$,'Cross-tenant announcement denied');
select pg_temp.ok((public.v12_save_site('20000000-0000-0000-0000-000000000001','{"title":"Draft title","about":"Introduction","services":[],"pages":[]}',0,false)->>'version')::int=1,'Draft saved with version');
select pg_temp.ok((select title='Golf site' and published from organization_sites where club_id='20000000-0000-0000-0000-000000000001'),'Draft save preserves live website');
select pg_temp.denied($q$select public.v12_save_site('20000000-0000-0000-0000-000000000001','{"title":"Stale"}',0,false)$q$,'Concurrent stale edit rejected');
select pg_temp.denied($q$select public.v12_save_site('20000000-0000-0000-0000-000000000001','{"title":"Empty introduction"}',1,true)$q$,'Publish requires introduction');
select pg_temp.denied($q$select public.v12_save_site('20000000-0000-0000-0000-000000000001','{"services":[42]}',1,false)$q$,'Invalid services rejected');
select pg_temp.denied($q$select public.v12_save_site('20000000-0000-0000-0000-000000000001','{}',null,false)$q$,'Null version cannot bypass conflict protection');
select public.v12_save_site('20000000-0000-0000-0000-000000000001','{"title":"Published title","about":"Introduction","pages":[],"services":[]}',1,true);
select pg_temp.ok((select title='Published title' and published from organization_sites where club_id='20000000-0000-0000-0000-000000000001'),'Explicit publish updates public site');
select pg_temp.ok((select count(*) from site_revisions)=2,'Revision history recorded');
with changed as (update organization_sites set title='Bypass' returning *) select pg_temp.ok((select count(*) from changed)=0,'Direct live-site edits blocked');
select pg_temp.denied($q$select public.v12_complete_setup('20000000-0000-0000-0000-000000000002')$q$,'Cross-tenant onboarding completion denied');
select public.v12_complete_setup('20000000-0000-0000-0000-000000000001');
select pg_temp.ok((public.v12_onboarding('20000000-0000-0000-0000-000000000001')->'recorded'->>'launch_complete')::boolean,'Onboarding completion uses actual prerequisites');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.ok((select count(*) from site_drafts)=0,'Members cannot read website drafts');
select pg_temp.ok((select count(*) from email_deliveries)=0,'Members cannot read email recipient list');
select pg_temp.denied($q$select public.v12_onboarding('20000000-0000-0000-0000-000000000001')$q$,'Member cannot read administrator setup');
select pg_temp.ok(public.v12_register_event('50000000-0000-0000-0000-000000000001')->>'status'='registered','First event seat confirmed');
select pg_temp.ok(public.v12_register_event('50000000-0000-0000-0000-000000000001')->>'status'='registered','Registration retry idempotent');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000008',true);
select pg_temp.ok(public.v12_register_event('50000000-0000-0000-0000-000000000001')->>'status'='waitlisted','Full event joins waitlist');
select pg_temp.ok((select count(*) from event_registrations)=1,'Waitlisted member only reads own registration');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select public.v11_register_event('50000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000008',true);
select pg_temp.ok((select status from event_registrations limit 1)='registered','Legacy cancellation promotes waitlist');
select pg_temp.denied($q$select public.v12_attendance((select id from event_registrations limit 1),true)$q$,'Member cannot forge attendance');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select public.v12_attendance((select id from event_registrations where status='registered' limit 1),true);
select pg_temp.ok(exists(select 1 from event_registrations where attended_at is not null),'Administrator records attendance');
update club_events set status='cancelled' where id='50000000-0000-0000-0000-000000000001';
select pg_temp.ok(not exists(select 1 from event_registrations where event_id='50000000-0000-0000-0000-000000000001' and status<>'cancelled'),'Event cancellation clears all registrations');
select pg_temp.denied($q$insert into organization_subscriptions(club_id,status) values('20000000-0000-0000-0000-000000000001','active')$q$,'Admin cannot forge subscription status');
select pg_temp.denied($q$select public.v12_apply_subscription('fake',now(),'customer','sub','active','price','plan',now(),false)$q$,'Subscription webhook RPC restricted to service');
select pg_temp.ok((select registered from v12_event_counts('20000000-0000-0000-0000-000000000001',array['50000000-0000-0000-0000-000000000001']::uuid[]) limit 1)=0,'Paginated event counts reflect cancelled seats');
select pg_temp.ok((select count(*) from v12_event_counts('20000000-0000-0000-0000-000000000002',array['50000000-0000-0000-0000-000000000002']::uuid[]))=0,'Paginated event counts deny other organization');
reset role;
set local role service_role;
create temp table claimed as select public.v12_claim_email() job;
grant select on claimed to authenticated;
select pg_temp.ok((select job->>'status' from claimed)='sending','Worker claims queued email');
select pg_temp.ok(not public.v12_finish_email((select (job->>'id')::uuid from claimed),gen_random_uuid(),'wrong',null,false),'Wrong lease cannot finalize delivery');
select public.v12_email_event('resend-event','resend-id','email.delivered',now());
select pg_temp.ok(public.v12_finish_email((select (job->>'id')::uuid from claimed),(select (job->>'lease_token')::uuid from claimed),'resend-id',null,false),'Correct lease records provider acceptance');
select pg_temp.ok((select status from email_deliveries where provider_id='resend-id')='delivered','Early delivery webhook reconciles on acceptance');
select public.v12_email_event('bounce-event','resend-id','email.bounced',now());
select public.v12_email_event('resend-event','resend-id','email.delivered',now());
select pg_temp.ok((select status from email_deliveries where provider_id='resend-id')='bounced','Late delivery cannot undo a bounce');
select pg_temp.ok((select count(*) from provider_events where provider='resend')=2,'Provider event replay deduplicated');
select public.v12_reserve_checkout('20000000-0000-0000-0000-000000000001','professional');
create temp table checkout_token as select checkout_token from organization_subscriptions where club_id='20000000-0000-0000-0000-000000000001';
select public.v12_reserve_checkout('20000000-0000-0000-0000-000000000001','professional');
select pg_temp.ok((select s.checkout_token=t.checkout_token from organization_subscriptions s cross join checkout_token t where s.club_id='20000000-0000-0000-0000-000000000001'),'Checkout retries reuse reservation token');
select pg_temp.denied($q$select public.v12_reserve_checkout('20000000-0000-0000-0000-000000000001','enterprise')$q$,'Concurrent different-plan checkout blocked');
update organization_subscriptions set customer_id='cus_test' where club_id='20000000-0000-0000-0000-000000000001';
select public.v12_apply_subscription('evt_new',now(),'cus_test','sub_test','active','price_test','professional',now()+interval '30 days',false);
select public.v12_apply_subscription('evt_old',now()-interval '1 minute','cus_test','sub_test','past_due','price_test','professional',now(),false);
select public.v12_apply_subscription('evt_new',now(),'cus_test','sub_test','past_due','price_test','professional',now(),false);
select pg_temp.ok((select status from organization_subscriptions where customer_id='cus_test')='active','Stale and replayed subscription events cannot overwrite active state');
select pg_temp.denied($q$select public.v12_reserve_checkout('20000000-0000-0000-0000-000000000001','professional')$q$,'Existing subscription cannot start another checkout');
select public.v12_apply_invoice('evt_invoice_new',now(),'{"id":"in_test","customer":"cus_test","status":"paid","currency":"usd","amount_due":2500,"amount_paid":2500,"created":1700000000}');
select public.v12_apply_invoice('evt_invoice_old',now()-interval '1 minute','{"id":"in_test","customer":"cus_test","status":"open","currency":"usd","amount_due":2500,"amount_paid":0,"created":1700000000}');
select pg_temp.ok((select status from subscription_invoices where id='in_test')='paid','Stale invoice event cannot undo payment');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.ok((select count(*) from organization_subscriptions)=0,'Another organization cannot read subscription');
select pg_temp.ok((select count(*) from subscription_invoices)=0,'Another organization cannot read invoices');
select pg_temp.ok((select count(*) from member_history where club_id='20000000-0000-0000-0000-000000000001')=0,'Another organization cannot read member history');
select pg_temp.denied($q$select public.v12_message_status('99999999-0000-0000-0000-000000000001','resolved')$q$,'Unknown inquiry cannot be modified');
reset role;
select count(*) as v12_assertions_passed from test_results;
rollback;
