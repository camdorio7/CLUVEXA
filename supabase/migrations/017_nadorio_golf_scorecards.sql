-- NADORIO 10.0: optional per-organization golf scorecards.
-- The scoring index in the UI is unofficial; it is not a WHS Handicap Index.
create table if not exists public.golf_scorecards (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 played_on date not null,
 course_name text not null check (char_length(course_name) between 1 and 120),
 course_rating numeric(4,1) not null check (course_rating between 45 and 85),
 slope_rating integer not null check (slope_rating between 55 and 155),
 holes integer[] not null check (array_length(holes,1)=18),
 gross_score integer not null check (gross_score between 18 and 360),
 differential numeric(5,1) not null,
 created_at timestamptz not null default now(),
 constraint golf_scorecards_holes_valid check (array_position(holes,null) is null)
);
create index if not exists golf_scorecards_owner_date on public.golf_scorecards(club_id,user_id,played_on desc);
alter table public.golf_scorecards enable row level security;
-- No cross-club visibility. Staff cannot access other members' personal scorecards.
create or replace function public.can_use_golf_scorecard(target_club uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select auth.uid() = target_user
 and (public.is_super_admin() or exists (
   select 1 from public.club_users cu where cu.club_id=target_club and cu.user_id=auth.uid() and cu.active=true
 ))
 and exists (select 1 from public.clubs c where c.id=target_club and c.status='active')
 and exists (select 1 from public.club_modules cm where cm.club_id=target_club and cm.module_key='golf' and cm.licensed=true and cm.club_enabled=true
  and (cm.member_visible=true or public.is_super_admin() or exists(select 1 from public.club_users cu where cu.club_id=target_club and cu.user_id=auth.uid() and cu.active=true and cu.role in ('owner','admin','manager','staff'))));
$$;
revoke all on function public.can_use_golf_scorecard(uuid,uuid) from public;
grant execute on function public.can_use_golf_scorecard(uuid,uuid) to authenticated;
drop policy if exists "scorecard own read" on public.golf_scorecards;
create policy "scorecard own read" on public.golf_scorecards for select to authenticated using (public.can_use_golf_scorecard(club_id,user_id));
drop policy if exists "scorecard own insert" on public.golf_scorecards;
create policy "scorecard own insert" on public.golf_scorecards for insert to authenticated with check (public.can_use_golf_scorecard(club_id,user_id));
-- Recalculate gross and differential in the database; never trust browser-submitted totals.
create or replace function public.validate_golf_scorecard() returns trigger language plpgsql set search_path=public as $$
declare n int; total int := 0;
begin
 if array_length(new.holes,1) is distinct from 18 then raise exception 'Exactly 18 holes required'; end if;
 foreach n in array new.holes loop
  if n is null or n<1 or n>20 then raise exception 'Invalid hole score'; end if;
  total := total + n;
 end loop;
 new.gross_score := total;
 new.differential := round(((total-new.course_rating)*113/new.slope_rating)::numeric,1);
 return new;
end $$;
drop trigger if exists golf_scorecard_validate on public.golf_scorecards;
create trigger golf_scorecard_validate before insert or update on public.golf_scorecards for each row execute function public.validate_golf_scorecard();

-- Tournament administration is restricted to organization owners/admins, not every member.
drop policy if exists "v2 tenant golf_tournaments" on public.golf_tournaments;
drop policy if exists "golf tournament tenant read" on public.golf_tournaments;
create policy "golf tournament tenant read" on public.golf_tournaments for select to authenticated using (public.has_club_access(club_id));
drop policy if exists "golf tournament admin insert" on public.golf_tournaments;
create policy "golf tournament admin insert" on public.golf_tournaments for insert to authenticated with check (
 public.is_super_admin() or exists(select 1 from public.club_users cu where cu.club_id=golf_tournaments.club_id and cu.user_id=auth.uid() and cu.active=true and cu.role in ('owner','admin'))
);
drop policy if exists "golf tournament admin update" on public.golf_tournaments;
create policy "golf tournament admin update" on public.golf_tournaments for update to authenticated using (
 public.is_super_admin() or exists(select 1 from public.club_users cu where cu.club_id=golf_tournaments.club_id and cu.user_id=auth.uid() and cu.active=true and cu.role in ('owner','admin'))
) with check (
 public.is_super_admin() or exists(select 1 from public.club_users cu where cu.club_id=golf_tournaments.club_id and cu.user_id=auth.uid() and cu.active=true and cu.role in ('owner','admin'))
);
drop policy if exists "golf tournament admin delete" on public.golf_tournaments;
create policy "golf tournament admin delete" on public.golf_tournaments for delete to authenticated using (
 public.is_super_admin() or exists(select 1 from public.club_users cu where cu.club_id=golf_tournaments.club_id and cu.user_id=auth.uid() and cu.active=true and cu.role in ('owner','admin'))
);
