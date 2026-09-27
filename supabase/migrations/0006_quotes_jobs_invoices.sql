-- Opero · 0006 · Quotes, jobs and invoices (plan funnel §2 / §7).
-- Money in pence (integer). Numbers Q-0001 / JOB-0001 / INV-0001.

-- ---------------------------------------------------------------- quotes
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  request_id uuid references requests (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'rejected', 'expired')),
  title text not null default '',
  message text not null default '',
  notes text not null default '',
  valid_until date,
  subtotal integer not null default 0 check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  tax integer not null default 0 check (tax >= 0),
  total integer not null default 0 check (total >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists quotes_company_status_idx
  on quotes (company_id, status, created_at desc);
create index if not exists quotes_client_idx on quotes (client_id);

create table if not exists quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes (id) on delete cascade,
  name text not null,
  description text not null default '',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text not null default 'ea',
  unit_price integer not null default 0 check (unit_price >= 0),
  total integer not null default 0 check (total >= 0),
  sort integer not null default 0
);

create table if not exists quote_number_seq (
  company_id uuid primary key references companies (id) on delete cascade,
  last_number integer not null default 0
);

create or replace function next_quote_number(p_company uuid)
returns text
language plpgsql
as $$
declare n integer;
begin
  insert into quote_number_seq (company_id, last_number)
  values (p_company, 1)
  on conflict (company_id)
  do update set last_number = quote_number_seq.last_number + 1
  returning last_number into n;
  if n is null then
    select last_number into n from quote_number_seq where company_id = p_company;
  end if;
  return 'Q-' || lpad(n::text, 4, '0');
end;
$$;

-- ------------------------------------------------------------------ jobs
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  quote_id uuid references quotes (id) on delete set null,
  request_id uuid references requests (id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'done', 'cancelled')),
  title text not null default '',
  instructions text not null default '',
  notes text not null default '',
  scheduled_date date,
  window_start text not null default '',
  window_end text not null default '',
  anytime boolean not null default false,
  schedule_later boolean not null default false,
  remind_invoice boolean not null default true,
  pickup_address text not null default '',
  delivery_address text not null default '',
  subtotal integer not null default 0 check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  tax integer not null default 0 check (tax >= 0),
  total integer not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists jobs_company_status_idx
  on jobs (company_id, status, scheduled_date);
create index if not exists jobs_client_idx on jobs (client_id);

create table if not exists job_visits (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  title text not null default '',
  visit_date date,
  start_time text not null default '',
  end_time text not null default '',
  anytime boolean not null default false,
  later boolean not null default false,
  assignee text not null default '',
  instructions text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'cancelled')),
  sort integer not null default 0
);

create table if not exists job_line_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  name text not null,
  description text not null default '',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text not null default 'ea',
  unit_price integer not null default 0 check (unit_price >= 0),
  total integer not null default 0 check (total >= 0),
  sort integer not null default 0
);

create table if not exists job_number_seq (
  company_id uuid primary key references companies (id) on delete cascade,
  last_number integer not null default 0
);

create or replace function next_job_number(p_company uuid)
returns text
language plpgsql
as $$
declare n integer;
begin
  insert into job_number_seq (company_id, last_number)
  values (p_company, 1)
  on conflict (company_id)
  do update set last_number = job_number_seq.last_number + 1
  returning last_number into n;
  if n is null then
    select last_number into n from job_number_seq where company_id = p_company;
  end if;
  return 'JOB-' || lpad(n::text, 4, '0');
end;
$$;

-- -------------------------------------------------------------- invoices
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  job_id uuid references jobs (id) on delete set null,
  quote_id uuid references quotes (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subject text not null default '',
  message text not null default '',
  notes text not null default '',
  payment_terms text not null default 'due_on_receipt'
    check (payment_terms in ('due_on_receipt', 'net_7', 'net_15', 'net_30')),
  issued_on date not null default (timezone('Europe/London', now()))::date,
  due_on date not null default (timezone('Europe/London', now()))::date,
  subtotal integer not null default 0 check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  tax integer not null default 0 check (tax >= 0),
  total integer not null default 0 check (total >= 0),
  balance integer not null default 0 check (balance >= 0),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists invoices_company_status_idx
  on invoices (company_id, status, due_on);
create index if not exists invoices_client_idx on invoices (client_id);

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  name text not null,
  description text not null default '',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text not null default 'ea',
  unit_price integer not null default 0 check (unit_price >= 0),
  total integer not null default 0 check (total >= 0),
  sort integer not null default 0
);

create table if not exists invoice_number_seq (
  company_id uuid primary key references companies (id) on delete cascade,
  last_number integer not null default 0
);

create or replace function next_invoice_number(p_company uuid)
returns text
language plpgsql
as $$
declare n integer;
begin
  insert into invoice_number_seq (company_id, last_number)
  values (p_company, 1)
  on conflict (company_id)
  do update set last_number = invoice_number_seq.last_number + 1
  returning last_number into n;
  if n is null then
    select last_number into n from invoice_number_seq where company_id = p_company;
  end if;
  return 'INV-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------- RLS
alter table quotes enable row level security;
alter table quote_line_items enable row level security;
alter table quote_number_seq enable row level security;
alter table jobs enable row level security;
alter table job_visits enable row level security;
alter table job_line_items enable row level security;
alter table job_number_seq enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table invoice_number_seq enable row level security;
