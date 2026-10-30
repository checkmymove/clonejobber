-- Job To Go · 0024 · Hourly rate per team member and the rate each time entry was paid at.
-- Labour on the job page shows what each person earned: duration × hourly rate.

alter table team_members
  add column if not exists hourly_rate numeric(10,2) not null default 0;

alter table team_members drop constraint if exists team_members_hourly_rate_check;
alter table team_members add constraint team_members_hourly_rate_check
  check (hourly_rate >= 0 and hourly_rate <= 10000);

-- Rate at the time the entry was logged, so a later raise does not rewrite history.
-- Null means no rate was set then: the entry follows the member's current rate.
alter table time_entries
  add column if not exists hourly_rate numeric(10,2);

alter table time_entries drop constraint if exists time_entries_hourly_rate_check;
alter table time_entries add constraint time_entries_hourly_rate_check
  check (hourly_rate is null or hourly_rate >= 0);

update time_entries t
set hourly_rate = m.hourly_rate
from team_members m
where m.id = t.member_id and t.hourly_rate is null and m.hourly_rate > 0;
