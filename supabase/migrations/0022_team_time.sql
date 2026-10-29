-- Job To Go · 0022 · Team, visit assignments and time tracking (Jobber Timesheets).
-- Dashboard "Today's appointments" merges Jobber's Visit and Employee tabs:
-- each visit shows its team and the time each person logged on it.

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

-- Jobber Visit.assignedUsers: a visit can have several people.
create table if not exists job_visit_members (
  visit_id uuid not null references job_visits (id) on delete cascade,
  member_id uuid not null references team_members (id) on delete cascade,
  primary key (visit_id, member_id)
);
create index if not exists job_visit_members_member_idx on job_visit_members (member_id);

-- Jobber TimeSheetEntry: clock in/out (ended_at null while running) or a manual entry.
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  member_id uuid not null references team_members (id) on delete cascade,
  job_id uuid references jobs (id) on delete cascade,
  visit_id uuid references job_visits (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
-- One running clock per person.
create unique index if not exists time_entries_one_running_idx
  on time_entries (member_id) where ended_at is null;
create index if not exists time_entries_company_started_idx
  on time_entries (company_id, started_at);
create index if not exists time_entries_job_idx on time_entries (job_id);
create index if not exists time_entries_visit_idx on time_entries (visit_id);

alter table team_members enable row level security;
alter table job_visit_members enable row level security;
alter table time_entries enable row level security;

revoke all on table public.team_members from anon;
revoke all on table public.job_visit_members from anon;
revoke all on table public.time_entries from anon;
grant select, insert, update, delete on table public.team_members to authenticated;
grant select, insert, update, delete on table public.job_visit_members to authenticated;
grant select, insert, update, delete on table public.time_entries to authenticated;

drop policy if exists admin_all on public.team_members;
create policy admin_all on public.team_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.job_visit_members;
create policy admin_all on public.job_visit_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.time_entries;
create policy admin_all on public.time_entries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Active team in the Moving London Jobber account (Timesheets, 29 Oct 2026).
insert into team_members (company_id, name, sort)
select c.id, s.name, s.sort
from companies c
cross join (values
  ('Andre Campanini', 1),
  ('Everaldo Aquino', 2),
  ('Fabiano da Silva Ribeiro', 3),
  ('Jailton Bento', 4)
) as s(name, sort)
where c.slug = 'moving-london'
on conflict (company_id, name) do nothing;

-- Free-text assignees typed before this migration become team members and assignments.
insert into team_members (company_id, name, sort)
select distinct j.company_id, trim(n.name), 100
from job_visits v
join jobs j on j.id = v.job_id
cross join lateral regexp_split_to_table(v.assignee, '\s*,\s*') as n(name)
where trim(n.name) <> ''
on conflict (company_id, name) do nothing;

insert into job_visit_members (visit_id, member_id)
select v.id, m.id
from job_visits v
join jobs j on j.id = v.job_id
cross join lateral regexp_split_to_table(v.assignee, '\s*,\s*') as n(name)
join team_members m on m.company_id = j.company_id and m.name = trim(n.name)
where trim(n.name) <> ''
on conflict do nothing;
