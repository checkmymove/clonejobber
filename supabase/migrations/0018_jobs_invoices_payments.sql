-- Opero · 0018 · Jobs, invoices and payments (Jobber Jobs / Invoices / Payments).
-- Job list statuses (late, today, upcoming, action required, requires invoicing,
-- archived) are derived from visits and invoices; jobs.status keeps its values
-- so Schedule and Clients read it unchanged. 'done' = job closed.
-- Invoice balance = total - allocated payments. Deposits are taken on a quote and
-- allocated to the invoice that comes from that quote's job.

-- ------------------------------------------------------------------ jobs
alter table jobs
  add column if not exists closed_at timestamptz;

update jobs set closed_at = updated_at
where status = 'done' and closed_at is null;

-- -------------------------------------------------------------- invoices
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'overdue', 'bad_debt', 'cancelled'));

alter table invoices drop constraint if exists invoices_payment_terms_check;
alter table invoices add constraint invoices_payment_terms_check
  check (payment_terms in ('due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_45'));

alter table invoices
  add column if not exists closed_at timestamptz,
  add column if not exists bad_debt_amount integer not null default 0
    check (bad_debt_amount >= 0),
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text not null default '';

-- -------------------------------------------------------------- payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  kind text not null default 'payment'
    check (kind in ('payment', 'deposit', 'refund')),
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer', 'cash', 'card', 'cheque', 'paypal', 'other')),
  status text not null default 'succeeded'
    check (status in ('succeeded', 'refunded', 'partially_refunded')),
  amount integer not null check (amount > 0),
  paid_on date not null default (timezone('Europe/London', now()))::date,
  reference text not null default '',
  details text not null default '',
  -- Deposit taken on a quote; also kept on payments so the deposit stays linked.
  quote_id uuid references quotes (id) on delete set null,
  receipt_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_company_date_idx
  on payments (company_id, paid_on desc, created_at desc);
create index if not exists payments_client_idx on payments (client_id);
create index if not exists payments_quote_idx on payments (quote_id);

create table if not exists payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id) on delete cascade,
  invoice_id uuid not null references invoices (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);
create index if not exists payment_allocations_invoice_idx
  on payment_allocations (invoice_id);

alter table payments enable row level security;
alter table payment_allocations enable row level security;

revoke all on table public.payments from anon;
revoke all on table public.payment_allocations from anon;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.payment_allocations to authenticated;

drop policy if exists admin_all on public.payments;
create policy admin_all on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.payment_allocations;
create policy admin_all on public.payment_allocations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
