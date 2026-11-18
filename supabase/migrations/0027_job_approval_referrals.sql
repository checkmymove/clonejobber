-- Job To Go · 0027 · Job approval by the client, and client referrals.
-- A job is sent to the client to approve (email & text); the visit is scheduled
-- by hand after that. Referrals come from the client's quote page.

alter table jobs add column if not exists approval_sent_at timestamptz;
alter table jobs add column if not exists approved_at timestamptz;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  quote_id uuid references quotes (id) on delete set null,
  name text not null,
  contact text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists referrals_company_created_idx on referrals (company_id, created_at desc);
create index if not exists referrals_client_idx on referrals (client_id);

alter table referrals enable row level security;
revoke all on table public.referrals from anon;
grant select, insert, update, delete on table public.referrals to authenticated;

drop policy if exists admin_all on public.referrals;
create policy admin_all on public.referrals
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
