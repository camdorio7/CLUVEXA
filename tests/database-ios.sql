begin;
insert into auth.users(id,email) values ('99000000-0000-0000-0000-000000000001','ios-one@example.test'),('99000000-0000-0000-0000-000000000002','ios-two@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000001',true);
do $$ declare first_id uuid; second_id uuid; begin
 first_id:=public.request_account_deletion(); second_id:=public.request_account_deletion();
 if first_id<>second_id then raise exception 'Duplicate requests were created'; end if;
 if (select count(*) from public.account_deletion_requests)<>1 then raise exception 'Own request is unreadable'; end if;
 begin
  update public.account_deletion_requests set status='completed',completed_at=now();
  raise exception 'Client update was allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from public.account_deletion_requests) then raise exception 'Another user can see requests'; end if;
 perform public.request_account_deletion();
end $$;
set local role anon;
do $$ begin
 begin perform public.request_account_deletion(); raise exception 'Anonymous request allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 begin
  update public.account_deletion_requests set status='completed',completed_at=now();
  raise exception 'Live account marked complete';
 exception when check_violation then null; end;
end $$;
select 'PASS: native deletion isolation, idempotency, write protection, anonymous denial and completion guard';
rollback;
