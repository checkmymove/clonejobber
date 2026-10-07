-- Opero · 0017 · Schedule stage close-out: persisted view settings.

create table if not exists schedule_settings (
  company_id uuid primary key references companies (id) on delete cascade,
  hide_weekends boolean not null default false,
  day_orientation text not null default 'vertical'
    check (day_orientation in ('vertical', 'horizontal')),
  updated_at timestamptz not null default now()
);

alter table schedule_settings enable row level security;
revoke all on table public.schedule_settings from anon;
grant select, insert, update, delete on table public.schedule_settings to authenticated;

drop policy if exists admin_all on public.schedule_settings;
create policy admin_all on public.schedule_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
