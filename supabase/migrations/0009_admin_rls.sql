-- Opero · 0009 · Single administrator + Row Level Security policies
--
-- The Next.js server still uses DATABASE_URL as the table owner, and that
-- role bypasses RLS. Pages, mutations and private file routes must call
-- requireAdmin() before using that connection.
--
-- These policies lock the Supabase Data API:
--   anon        — no table grants
--   authenticated — read/write only when auth.uid() is the one admin profile
-- OAuth token and state tables stay with RLS and no policy, so neither
-- anon nor authenticated can read Gmail credentials through the API.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_single_admin
  on profiles ((true))
  where role = 'admin';

alter table profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on table public.google_oauth_tokens from anon, authenticated;
revoke all on table public.google_oauth_states from anon, authenticated;

do $$
declare
  t text;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in (
        'google_oauth_tokens',
        'google_oauth_states',
        'public_submit_limits',
        'sms_settings'
      )
  loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;
