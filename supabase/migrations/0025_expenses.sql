-- Job To Go · 0025 · Expenses: what the business spends (fuel, van hire, materials…),
-- optionally against a job. Reports subtract them from what was paid.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  spent_on date not null default (timezone('Europe/London', now()))::date,
  category text not null default 'other',
  description text not null default '',
  vendor text not null default '',
  amount integer not null check (amount > 0),
  payment_method text not null default 'card',
  job_id uuid references jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('fuel', 'van_hire', 'materials', 'equipment', 'tolls_parking',
                      'insurance', 'marketing', 'subcontractors', 'office', 'other'));
alter table expenses drop constraint if exists expenses_payment_method_check;
alter table expenses add constraint expenses_payment_method_check
  check (payment_method in ('card', 'bank_transfer', 'cash', 'other'));

create index if not exists expenses_company_spent_idx on expenses (company_id, spent_on desc);
create index if not exists expenses_job_idx on expenses (job_id);

alter table expenses enable row level security;
revoke all on table public.expenses from anon;
grant select, insert, update, delete on table public.expenses to authenticated;

drop policy if exists admin_all on public.expenses;
create policy admin_all on public.expenses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
