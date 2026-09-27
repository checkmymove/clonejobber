-- Opero · 0003 · Clients: notes + addresses (plan §2, Blueprint §7).

alter table clients
  add column if not exists notes text not null default '';

-- Multiple addresses per client; each can serve as collection or delivery.
create table if not exists client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  label text not null default 'Other'
    check (label in ('Billing', 'Collection', 'Delivery', 'Other')),
  address_line text not null,
  city text not null default '',
  postcode text not null,
  instructions text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists client_addresses_client_idx
  on client_addresses (client_id);

alter table client_addresses enable row level security;
