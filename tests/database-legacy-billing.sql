-- Hosted legacy definition supplied in the user's read-only schema diagnostic.
create table public.organization_subscriptions (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null unique references public.clubs(id) on delete cascade,
 plan_key text not null default 'starter',status text not null default 'trial',
 monthly_amount numeric(10,2),billing_interval text not null default 'monthly',
 external_customer_id text,external_subscription_id text,
 current_period_start timestamptz,current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.organization_subscriptions enable row level security;
create policy "subscriptions tenant" on public.organization_subscriptions for all using(public.has_club_access(club_id) or public.is_super_admin()) with check(public.has_club_access(club_id) or public.is_super_admin());
insert into public.clubs(id,name,slug) values('90000000-0000-0000-0000-000000000001','Legacy billing upgrade fixture','legacy-upgrade-fixture');
insert into public.organization_subscriptions(id,club_id,plan_key,status,monthly_amount,billing_interval,external_customer_id,external_subscription_id,current_period_start,current_period_end)
values('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','legacy-pro','active',125.50,'monthly','cus_legacy','sub_legacy','2026-10-01Z','2026-11-01Z');
