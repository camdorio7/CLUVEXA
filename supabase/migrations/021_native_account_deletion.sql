-- Additive migration. Apply after 020; do not replay the initial schema on an existing project.
begin;
create table public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 status text not null default 'requested' check (status in ('requested','in_review','completed')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check ((status = 'completed') = (completed_at is not null)),
 check (status <> 'completed' or user_id is null)
);
create unique index account_deletion_one_pending on public.account_deletion_requests(user_id) where status <> 'completed';
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;
create policy deletion_request_read on public.account_deletion_requests for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
create function public.request_account_deletion() returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; current_user_id uuid := auth.uid();
begin
 if current_user_id is null then raise exception 'Sign in to request account deletion'; end if;
 perform pg_advisory_xact_lock(hashtext('account-deletion:'||current_user_id::text));
 select id into result from public.account_deletion_requests where user_id=current_user_id and status <> 'completed';
 if result is null then
  insert into public.account_deletion_requests(user_id) values(current_user_id) returning id into result;
 end if;
 return result;
end $$;
revoke all on function public.request_account_deletion() from public,anon;
grant execute on function public.request_account_deletion() to authenticated;
comment on table public.account_deletion_requests is 'Manual privacy operations queue. A request is not deletion. Purge/anonymize personal data and remove the Auth user before marking completed. Monitor daily; see ios/README.md.';
commit;
