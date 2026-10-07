-- NADORIO v2.1 — Resend email center and delivery history
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  recipient text not null,
  email_type text not null,
  subject text not null,
  status text not null default 'sent',
  provider_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists email_logs_club_created on public.email_logs(club_id,created_at desc);
alter table public.email_logs enable row level security;
drop policy if exists "email logs club admin read" on public.email_logs;
create policy "email logs club admin read" on public.email_logs for select using(public.is_club_admin(club_id));
drop policy if exists "email logs club admin insert" on public.email_logs;
create policy "email logs club admin insert" on public.email_logs for insert with check(public.is_club_admin(club_id));
