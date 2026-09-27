-- Opero · 0004 · Clients/CRM full module (Blueprint §7).
-- Reuses: clients, client_addresses (= Properties store), requests,
-- request_attachments (= file source, no byte duplication), activity_log.
-- NOT created here (own modules later): quotes, jobs, invoices, payments,
-- payment_methods, Client Hub, granular permissions (needs Auth phase).

-- ------------------------------------------------------- clients profile
alter table clients
  add column if not exists status text not null default 'active'
    check (status in ('lead', 'active', 'inactive', 'archived')),
  add column if not exists client_type text not null default 'individual'
    check (client_type in ('individual', 'company')),
  add column if not exists title text not null default '',
  add column if not exists phone_mobile text not null default '',
  add column if not exists payment_terms text not null default 'due_on_receipt'
    check (payment_terms in
      ('due_on_receipt', 'net_7', 'net_15', 'net_30', 'custom')),
  add column if not exists payment_terms_custom text,
  add column if not exists ask_for_review boolean not null default true;

-- ------------------------------------------- properties (client_addresses)
alter table client_addresses
  add column if not exists is_primary boolean not null default false,
  add column if not exists is_billing boolean not null default false,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Migrate legacy is_default flag into the new model (re-runnable).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_addresses'
      and column_name = 'is_default'
  ) then
    update client_addresses set is_primary = true where is_default = true;
    alter table client_addresses drop column is_default;
  end if;
end
$$;

-- ---------------------------------------------------------------- contacts
create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  name text not null,
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  is_primary boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists client_contacts_client_idx
  on client_contacts (client_id);

-- ---------------------------------------------------------- communications
-- quote_id / job_id / invoice_id stay FK-less until those modules land.
create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  request_id uuid references requests (id) on delete set null,
  quote_id uuid,
  job_id uuid,
  invoice_id uuid,
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'whatsapp')),
  direction text not null default 'outbound'
    check (direction in ('outbound', 'inbound')),
  subject text not null default '',
  body text not null default '',
  status text not null default 'logged'
    check (status in ('logged', 'sent', 'delivered', 'opened',
                      'clicked', 'bounced', 'failed')),
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists communications_client_idx
  on communications (client_id, created_at desc);

-- ------------------------------------------------- manual client files
-- Request attachments are NOT copied: the Files tab unions this table with
-- request_attachments through the client's requests.
create table if not exists client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists client_files_client_idx
  on client_files (client_id, created_at desc);

-- ------------------------------------------------------------------ notes
-- Internal only: never exposed to the Client Hub.
create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  author text not null default 'admin',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_notes_client_idx
  on client_notes (client_id, created_at desc);

-- ------------------------------------------------------------------- tags
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  unique (company_id, name)
);
create table if not exists client_tags (
  client_id uuid not null references clients (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (client_id, tag_id)
);

-- ----------------------------------------------------------- appointments
-- Client Schedule + Schedule Assessment (linked to a request when created
-- from one). Future: feed the global Schedule/Dispatch module.
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  request_id uuid references requests (id) on delete set null,
  title text not null,
  kind text not null default 'visit'
    check (kind in ('assessment', 'visit', 'call', 'follow_up', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists appointments_client_idx
  on appointments (client_id, starts_at);

-- ------------------------------------------------------------------- RLS
alter table client_contacts enable row level security;
alter table communications enable row level security;
alter table client_files enable row level security;
alter table client_notes enable row level security;
alter table tags enable row level security;
alter table client_tags enable row level security;
alter table appointments enable row level security;
