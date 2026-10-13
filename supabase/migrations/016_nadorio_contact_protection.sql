-- NADORIO 10 release hardening: limit public contact submissions per organization.
-- Apply after 014. This does not delete or alter existing inquiries.
create index if not exists organization_site_messages_rate_lookup
  on public.organization_site_messages (club_id, lower(sender_email), created_at desc);

create or replace function public.nadorio_limit_site_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_sender integer;
  recent_club integer;
begin
  -- Serialize contact submissions for this organization to avoid racing limits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.club_id::text));
  select count(*) into recent_sender
    from public.organization_site_messages
    where club_id = new.club_id
      and lower(sender_email) = lower(new.sender_email)
      and created_at > now() - interval '1 hour';
  select count(*) into recent_club
    from public.organization_site_messages
    where club_id = new.club_id
      and created_at > now() - interval '1 hour';
  if recent_sender >= 5 or recent_club >= 100 then
    raise exception 'Contact submission rate exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.nadorio_limit_site_messages() from public, anon, authenticated;
drop trigger if exists nadorio_site_message_rate_limit on public.organization_site_messages;
create trigger nadorio_site_message_rate_limit
before insert on public.organization_site_messages
for each row execute function public.nadorio_limit_site_messages();
