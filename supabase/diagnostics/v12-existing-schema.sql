-- Read-only metadata for diagnosing migration 020 conflicts.
-- Returns definitions only: no subscription/customer/member records or credentials.
with targets(name) as (
 values ('organization_subscriptions'),('subscription_invoices'),
 ('member_history'),('email_templates'),('email_campaigns'),('email_deliveries'),
 ('provider_events'),('site_drafts'),('site_revisions'),('job_heartbeats')
)
select jsonb_pretty(jsonb_build_object(
 'v12_health_function_exists',to_regprocedure('public.v12_health()') is not null,
 'relations',coalesce(jsonb_agg(jsonb_build_object(
  'name',t.name,
  'exists',c.oid is not null,
  'kind',c.relkind,
  'rls_enabled',c.relrowsecurity,
  'columns',(select jsonb_agg(jsonb_build_object(
    'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),
    'identity',a.attidentity,'generated',a.attgenerated,
    'enum_values',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=a.atttypid)
   ) order by a.attnum)
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(jsonb_build_object('name',x.conname,'definition',pg_get_constraintdef(x.oid))) from pg_constraint x where x.conrelid=c.oid),
  'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid=c.oid),
  'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) from pg_policy p where p.polrelid=c.oid),
  'triggers',(select jsonb_agg(pg_get_triggerdef(g.oid)) from pg_trigger g where g.tgrelid=c.oid and not g.tgisinternal)
 ) order by t.name),'[]'::jsonb)
)) as v12_schema_diagnostic
from targets t
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=t.name;
