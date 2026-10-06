-- Opero · 0014 · Quote archive/delete, SMS pipeline, PDF export log
-- Archive is independent of workflow status (draft/sent/approved/...).

alter table quotes
  add column if not exists archived_at timestamptz;

create index if not exists quotes_company_archived_idx
  on quotes (company_id, archived_at);

-- Provider credentials stay server-only (owner connection). No Data API access.
create table if not exists sms_settings (
  company_id uuid primary key references companies (id) on delete cascade,
  provider text not null default 'twilio'
    check (provider in ('twilio')),
  from_number text not null default '',
  account_sid_sealed text not null default '',
  auth_token_sealed text not null default '',
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists sms_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  quote_id uuid not null references quotes (id) on delete cascade,
  to_phone text not null,
  body text not null,
  status text not null
    check (status in ('queued', 'sent', 'failed')),
  error text,
  provider_message_id text,
  sent_at timestamptz not null default now()
);
create index if not exists sms_deliveries_quote_idx
  on sms_deliveries (quote_id, sent_at desc);
create index if not exists sms_deliveries_company_idx
  on sms_deliveries (company_id, sent_at desc);

create table if not exists quote_pdf_exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  quote_id uuid not null references quotes (id) on delete cascade,
  file_name text not null,
  byte_size integer not null check (byte_size > 0),
  created_at timestamptz not null default now()
);
create index if not exists quote_pdf_exports_quote_idx
  on quote_pdf_exports (quote_id, created_at desc);

alter table sms_settings enable row level security;
alter table sms_deliveries enable row level security;
alter table quote_pdf_exports enable row level security;

revoke all on table public.sms_settings from anon, authenticated;
revoke all on table public.public_submit_limits from anon, authenticated;

do $$
begin
  execute 'drop policy if exists admin_all on public.sms_settings';
  execute 'drop policy if exists admin_all on public.public_submit_limits';
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    execute 'drop policy if exists admin_all on public.sms_deliveries';
    execute $p$
      create policy admin_all on public.sms_deliveries
        for all to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $p$;
    execute 'drop policy if exists admin_all on public.quote_pdf_exports';
    execute $p$
      create policy admin_all on public.quote_pdf_exports
        for all to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $p$;
  end if;
end $$;
