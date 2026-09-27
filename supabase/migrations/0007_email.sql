-- Opero · 0007 · Gmail OAuth tokens + outbound email log
-- Tokens are server-only (owner connection). RLS on, no anon policies.

create table if not exists google_oauth_tokens (
  company_id uuid primary key references companies (id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  updated_at timestamptz not null default now()
);

create table if not exists email_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  document_type text not null
    check (document_type in ('quote', 'invoice')),
  document_id uuid not null,
  to_email text not null,
  subject text not null,
  gmail_message_id text,
  status text not null
    check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists email_deliveries_document_idx
  on email_deliveries (document_type, document_id, sent_at desc);
create index if not exists email_deliveries_company_idx
  on email_deliveries (company_id, sent_at desc);

alter table google_oauth_tokens enable row level security;
alter table email_deliveries enable row level security;
