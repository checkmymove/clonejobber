-- Opero · 0016 · Schedule department (Jobber New Schedule).
-- Visits land on the calendar when a quote is confirmed as a job.
-- Tasks, events and quote/invoice reminders share the same calendar.

alter table job_visits
  add column if not exists confirmed_by_client boolean not null default false,
  add column if not exists completed_at timestamptz;

create index if not exists job_visits_date_idx
  on job_visits (visit_date, status);

create table if not exists schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  title text not null,
  notes text not null default '',
  task_date date,
  start_time text not null default '',
  end_time text not null default '',
  anytime boolean not null default true,
  later boolean not null default false,
  assignee text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists schedule_tasks_company_date_idx
  on schedule_tasks (company_id, task_date, status);

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  notes text not null default '',
  event_date date,
  start_time text not null default '',
  end_time text not null default '',
  anytime boolean not null default false,
  later boolean not null default false,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists schedule_events_company_date_idx
  on schedule_events (company_id, event_date, status);

create table if not exists schedule_reminders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  kind text not null check (kind in ('quote', 'invoice')),
  quote_id uuid unique references quotes (id) on delete cascade,
  invoice_id uuid unique references invoices (id) on delete cascade,
  title text not null,
  reminder_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'quote' and quote_id is not null and invoice_id is null)
    or
    (kind = 'invoice' and invoice_id is not null and quote_id is null)
  )
);
create index if not exists schedule_reminders_company_date_idx
  on schedule_reminders (company_id, reminder_date, status);

alter table schedule_tasks enable row level security;
alter table schedule_events enable row level security;
alter table schedule_reminders enable row level security;

revoke all on table public.schedule_tasks from anon;
revoke all on table public.schedule_events from anon;
revoke all on table public.schedule_reminders from anon;
grant select, insert, update, delete on table public.schedule_tasks to authenticated;
grant select, insert, update, delete on table public.schedule_events to authenticated;
grant select, insert, update, delete on table public.schedule_reminders to authenticated;

drop policy if exists admin_all on public.schedule_tasks;
create policy admin_all on public.schedule_tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.schedule_events;
create policy admin_all on public.schedule_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.schedule_reminders;
create policy admin_all on public.schedule_reminders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Existing sent quotes (not yet a job) become follow-up chips on the calendar.
insert into schedule_reminders (company_id, kind, quote_id, title, reminder_date)
select
  q.company_id,
  'quote',
  q.id,
  'Reminder about quote ' || q.number || ' for ' || trim(c.first_name || ' ' || c.last_name),
  coalesce(
    q.valid_until,
    (timezone('Europe/London', coalesce(q.sent_at, q.created_at)))::date + 2
  )
from quotes q
join clients c on c.id = q.client_id
where q.status in ('sent', 'changes_requested')
  and q.archived_at is null
  and not exists (select 1 from jobs j where j.quote_id = q.id)
on conflict (quote_id) do nothing;

insert into schedule_reminders (company_id, kind, invoice_id, title, reminder_date)
select
  i.company_id,
  'invoice',
  i.id,
  'Invoice reminder for ' || i.number || ' · ' || trim(c.first_name || ' ' || c.last_name),
  i.due_on
from invoices i
join clients c on c.id = i.client_id
where i.status in ('sent', 'overdue')
on conflict (invoice_id) do nothing;

-- Confirmed jobs (approved quotes) mark their visits as client-confirmed.
update job_visits v
set confirmed_by_client = true
from jobs j
join quotes q on q.id = j.quote_id
where v.job_id = j.id
  and q.status = 'approved';
