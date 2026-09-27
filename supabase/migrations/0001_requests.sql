-- Opero · 0001 · Request module core tables
-- Single-tenant MVP, slug-routed to stay multi-tenant ready (Blueprint §41).
-- Money rule (plan §6): not needed here yet; requests carry no money.
-- RLS enabled on all tables; server access uses the owner connection until
-- Supabase Auth + anon policies land (auth phase). No policy = locked for anon.

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- companies
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand_name text not null default 'Opero',
  logo_url text,
  primary_color text not null default '#123035',
  terms_url text,
  max_request_images integer not null default 10
    check (max_request_images between 1 and 20),
  request_form_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ lead sources
create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort integer not null default 0,
  unique (company_id, name)
);

-- -------------------------------------------------------- services catalog
-- Central library reused by Quote/Job/Invoice later (Blueprint §15).
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  sort integer not null default 0,
  unique (company_id, name)
);

-- ----------------------------------------------------------------- clients
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  company_name text,
  email citext not null,
  phone text not null,
  marketing_email_consent boolean not null default false,
  marketing_sms_consent boolean not null default false,
  lead_source_id uuid references lead_sources (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, email)
);
create index if not exists clients_company_phone_idx
  on clients (company_id, phone);

-- ---------------------------------------------------------------- requests
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  status text not null default 'new'
    check (status in ('new', 'review', 'quoted', 'archived')),
  lead_source_id uuid references lead_sources (id),
  move_date date,
  move_time text,
  needs_packing_service boolean not null default false,
  needs_packing_materials boolean not null default false,
  estimated_hours text[] not null default '{}',
  inventory_description text not null,
  terms_accepted_at timestamptz not null,
  idempotency_key text unique,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists requests_company_status_idx
  on requests (company_id, status, submitted_at desc);

-- Counter backing human-readable REQ numbers per company.
create table if not exists request_number_seq (
  company_id uuid primary key references companies (id) on delete cascade,
  last_number integer not null default 0
);

create or replace function next_request_number(p_company uuid)
returns text
language plpgsql
as $$
declare
  n integer;
begin
  insert into request_number_seq (company_id, last_number)
  values (p_company, 1)
  on conflict (company_id)
  do update set last_number = request_number_seq.last_number + 1
  returning last_number into n;

  -- When the insert path is taken, last_number is already 1.
  if n is null then
    select last_number into n from request_number_seq where company_id = p_company;
  end if;

  return 'REQ-' || lpad(n::text, 4, '0');
end;
$$;

-- ------------------------------------------------------ request locations
create table if not exists request_locations (
  request_id uuid not null references requests (id) on delete cascade,
  kind text not null check (kind in ('pickup', 'delivery')),
  address text not null,
  postcode text not null,
  floor text not null,
  has_lift boolean not null default false,
  parking_restrictions text not null,
  bedrooms integer not null check (bedrooms between 0 and 50),
  primary key (request_id, kind)
);

-- ------------------------------------------------------- request services
create table if not exists request_services (
  request_id uuid not null references requests (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  primary key (request_id, service_id)
);

-- ----------------------------------------------------- request attachments
-- Dedicated table (never bytea on requests). DB-backed provider behind
-- lib/storage.ts; migrates to a Supabase Storage bucket without touching
-- callers once API keys are configured.
create table if not exists request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists request_attachments_request_idx
  on request_attachments (request_id);

-- ------------------------------------------------------------- activity log
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id uuid,
  summary text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_log_company_idx
  on activity_log (company_id, created_at desc);

-- ---------------------------------------------------------------------- RLS
alter table companies enable row level security;
alter table lead_sources enable row level security;
alter table services enable row level security;
alter table clients enable row level security;
alter table requests enable row level security;
alter table request_locations enable row level security;
alter table request_services enable row level security;
alter table request_attachments enable row level security;
alter table activity_log enable row level security;
alter table request_number_seq enable row level security;
