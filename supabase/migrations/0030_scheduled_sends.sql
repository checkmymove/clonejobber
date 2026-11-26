-- Job To Go · 0030 · Scheduled sends: emails and texts that go out later on their own.
-- First use: a job with packing sends the packing confirmation now and the removal
-- confirmation 24 hours later. A Vercel schedule runs every 15 minutes and sends what is due.

create table if not exists scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  purpose text not null,
  send_at timestamptz not null,
  email_to text,
  sms_to text,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table scheduled_sends drop constraint if exists scheduled_sends_purpose_check;
alter table scheduled_sends add constraint scheduled_sends_purpose_check
  check (purpose in ('job_removal_confirmation'));
alter table scheduled_sends drop constraint if exists scheduled_sends_status_check;
alter table scheduled_sends add constraint scheduled_sends_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled'));

create index if not exists scheduled_sends_due_idx on scheduled_sends (send_at) where status = 'pending';
create index if not exists scheduled_sends_job_idx on scheduled_sends (job_id);

alter table scheduled_sends enable row level security;
revoke all on table public.scheduled_sends from anon;
grant select, insert, update, delete on table public.scheduled_sends to authenticated;

drop policy if exists admin_all on public.scheduled_sends;
create policy admin_all on public.scheduled_sends
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
