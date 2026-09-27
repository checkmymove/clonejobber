create table if not exists google_oauth_states (
  state text primary key,
  company_id uuid not null references companies (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table google_oauth_states enable row level security;
