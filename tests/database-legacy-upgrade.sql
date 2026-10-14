do $$ begin
 if not exists(select 1 from public.organization_subscriptions where id='91000000-0000-0000-0000-000000000001' and plan_key='legacy-pro' and status='active' and monthly_amount=125.50 and billing_interval='monthly' and customer_id='cus_legacy' and subscription_id='sub_legacy' and external_customer_id='cus_legacy' and external_subscription_id='sub_legacy' and current_period_start='2026-10-01Z'::timestamptz and current_period_end='2026-11-01Z'::timestamptz) then raise exception 'Legacy subscription data was not preserved';end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='organization_subscriptions' and policyname='subscriptions tenant') then raise exception 'Legacy write policy remains';end if;
 if has_table_privilege('authenticated','public.organization_subscriptions','INSERT,UPDATE,DELETE') then raise exception 'Authenticated billing writes remain enabled';end if;
end $$;
-- Unknown Stripe prices must not fail against the old NOT NULL plan constraint.
select public.v12_apply_subscription('legacy_sync',now(),'cus_legacy','sub_legacy','active','price_unknown',null,'2026-11-01Z',false);
do $$ begin
 if not exists(select 1 from public.organization_subscriptions where customer_id='cus_legacy' and plan_key is null and monthly_amount=125.50) then raise exception 'Provider reconciliation failed on legacy schema';end if;
end $$;
-- Restore empty fixture state before running the unchanged tenant isolation suite.
delete from public.clubs where id='90000000-0000-0000-0000-000000000001';
delete from public.provider_events where event_id='legacy_sync';
