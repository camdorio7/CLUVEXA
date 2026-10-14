-- Test-only Supabase schema shim. Never run against a real Supabase project.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant execute on all functions in schema auth,storage to anon,authenticated,service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;

grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
