-- NADORIO 10: additional public website pages. Preserves existing sites.
alter table public.organization_sites add column if not exists pages jsonb not null default '[]'::jsonb;
-- Reject invalid page data at the database boundary (including client-side writes).
create or replace function public.nadorio_valid_site_pages(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select jsonb_typeof(value) = 'array' and jsonb_array_length(value) <= 20
 and not exists (
  select 1 from jsonb_array_elements(value) p
  where jsonb_typeof(p) <> 'object'
  or jsonb_typeof(p->'slug') is distinct from 'string'
  or (p->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or p->>'slug' in ('home','contact')
  or length(p->>'slug') > 80
  or jsonb_typeof(p->'title') is distinct from 'string'
  or length(p->>'title') > 120
  or jsonb_typeof(p->'body') is distinct from 'string'
  or length(p->>'body') > 12000
 )
 and (select count(distinct p->>'slug') from jsonb_array_elements(value) p) = jsonb_array_length(value);
$$;
alter table public.organization_sites drop constraint if exists organization_sites_pages_valid;
alter table public.organization_sites add constraint organization_sites_pages_valid check (public.nadorio_valid_site_pages(pages));
