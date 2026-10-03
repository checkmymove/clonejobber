-- Opero · 0013 · Products & services catalogue used by New Quote.
-- Money is stored in pence. Separate from `services` (request wizard options).

create table if not exists products_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  item_type text not null default 'service' check (item_type in ('service', 'product')),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 4000),
  unit_price integer not null default 0 check (unit_price >= 0),
  tax_exempt boolean not null default false,
  service_duration_minutes integer not null default 60
    check (service_duration_minutes between 5 and 1440),
  allow_quantity boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_services_company_name_key
  on products_services (company_id, lower(btrim(name)));

create index if not exists products_services_company_type_idx
  on products_services (company_id, item_type, active);

alter table products_services enable row level security;

revoke all on table public.products_services from anon;
grant select, insert, update, delete on table public.products_services to authenticated;

drop policy if exists admin_all on public.products_services;
create policy admin_all on public.products_services
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
