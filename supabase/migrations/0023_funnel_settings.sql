-- Job To Go · 0023 · Client numbers for the funnel history, Jobber "Manage team"
-- fields, editable email/text templates and files attached when sending.

-- ------------------------------------------------------------ client number
-- The funnel history shows "Client #N" next to Request, Quote, Job and Invoice numbers.
alter table clients add column if not exists number integer;

update clients c
set number = s.n
from (
  select id,
         (select coalesce(max(x.number), 0) from clients x where x.company_id = c2.company_id)
           + row_number() over (partition by company_id order by created_at, id) as n
  from clients c2
  where number is null
) s
where c.id = s.id;

create or replace function public.assign_client_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('client_number:' || new.company_id::text));
    select coalesce(max(number), 0) + 1 into new.number
    from clients where company_id = new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_assign_number on clients;
create trigger clients_assign_number
  before insert on clients
  for each row execute function public.assign_client_number();

create unique index if not exists clients_company_number_idx on clients (company_id, number);

-- --------------------------------------------------------------- team fields
-- Jobber Settings › Manage team › member: personal info, working hours, role, permissions.
alter table team_members
  add column if not exists email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists street text not null default '',
  add column if not exists city text not null default '',
  add column if not exists province text not null default '',
  add column if not exists postcode text not null default '',
  add column if not exists country text not null default 'United Kingdom',
  add column if not exists role text not null default 'user',
  add column if not exists permission text not null default 'field_crew',
  add column if not exists working_hours jsonb not null default
    '{"sun":null,"mon":["08:00","19:00"],"tue":["08:00","19:00"],"wed":["08:00","19:00"],"thu":["08:00","19:00"],"fri":["08:00","19:00"],"sat":["08:00","19:00"]}'::jsonb;

alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check
  check (role in ('owner', 'admin', 'user'));
alter table team_members drop constraint if exists team_members_permission_check;
alter table team_members add constraint team_members_permission_check
  check (permission in ('field_crew', 'senior_field_crew', 'crew_lead', 'manager', 'custom'));

-- Roles as set in the Jobber account (29 Oct 2026).
update team_members m set role = 'admin', permission = 'manager'
from companies c
where c.id = m.company_id and c.slug = 'moving-london'
  and m.name in ('Andre Campanini', 'Fabiano da Silva Ribeiro') and m.role = 'user';

-- ---------------------------------------------------------- message templates
-- Jobber Settings › Emails & Text Messages. Defaults live in code (lib/templates/catalog.ts);
-- a row here is the account's customised version, and Reset deletes it.
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  key text not null,
  channel text not null check (channel in ('email', 'sms')),
  subject text not null default '',
  body text not null,
  updated_at timestamptz not null default now(),
  unique (company_id, key, channel)
);

-- ------------------------------------------------------- files sent by email
-- Photos and documents added in the send dialog ("Attachments" in Jobber).
create table if not exists send_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  kind text not null check (kind in ('request', 'quote', 'job', 'invoice', 'payment')),
  document_id uuid not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists send_attachments_document_idx
  on send_attachments (kind, document_id, created_at desc);

alter table message_templates enable row level security;
alter table send_attachments enable row level security;
revoke all on table public.message_templates from anon;
revoke all on table public.send_attachments from anon;
grant select, insert, update, delete on table public.message_templates to authenticated;
grant select, insert, update, delete on table public.send_attachments to authenticated;

drop policy if exists admin_all on public.message_templates;
create policy admin_all on public.message_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.send_attachments;
create policy admin_all on public.send_attachments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
