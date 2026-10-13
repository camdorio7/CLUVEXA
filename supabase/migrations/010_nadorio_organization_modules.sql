-- NADORIO 10.0: independently controlled member visibility and server-enforced licensing.
-- Apply after migrations 001-009. No existing licensing is removed.
alter table public.club_modules add column if not exists member_visible boolean not null default false;
-- Preserve existing member navigation for modules already enabled before this migration.
update public.club_modules set member_visible=true where licensed=true and club_enabled=true and module_key in ('events','tee_sheet','amenities','reservations','documents','communications','golf');
-- Restrict module activation changes to verified organization administrators.
drop policy if exists "club modules update" on public.club_modules;
create policy "club modules update" on public.club_modules for update to authenticated
using (public.is_super_admin() or exists (select 1 from public.club_users u where u.club_id=club_modules.club_id and u.user_id=auth.uid() and u.active=true and u.role in ('owner','admin')))
with check (public.is_super_admin() or exists (select 1 from public.club_users u where u.club_id=club_modules.club_id and u.user_id=auth.uid() and u.active=true and u.role in ('owner','admin')));
-- Protect licensing fields against client-side modification, including forged requests.
create or replace function public.nadorio_guard_module_license() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_super_admin() then
  if new.licensed is distinct from old.licensed or new.licensed_at is distinct from old.licensed_at or new.licensed_by is distinct from old.licensed_by or new.module_key is distinct from old.module_key or new.club_id is distinct from old.club_id then
   raise exception 'Only CD7 Technologies can modify module licensing';
  end if;
 end if;
 if new.club_enabled and not new.licensed then raise exception 'Module must be licensed before activation'; end if;
 if new.member_visible and not new.licensed then raise exception 'Module must be licensed before member access'; end if;
 return new;
end $$;
drop trigger if exists nadorio_guard_module_license on public.club_modules;
create trigger nadorio_guard_module_license before update on public.club_modules for each row execute function public.nadorio_guard_module_license();
-- Add universal capabilities to the catalog without granting licenses automatically.
insert into public.module_catalog(module_key,name,description,icon,sort_order,default_enabled) values
('website_builder','Website Builder','Public business website pages and publishing','globe',160,false),
('email_center','Email Center','Organization email and contact management','mail',170,false),
('weather','Weather','Local weather information and status','cloud-sun',180,false)
on conflict(module_key) do nothing;
