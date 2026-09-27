-- Opero · 0010 · Durable public-form rate limit + one document per conversion
--
-- public_submit_limits is server-only (owner connection). RLS on, no policy,
-- no grants for anon or authenticated — same posture as the OAuth tables.
-- Partial unique indexes stop two conversions of the same quote or job.
-- Manual jobs without a quote, and manual invoices without a job, stay allowed.

create table if not exists public_submit_limits (
  bucket text primary key,
  hits integer not null check (hits >= 0),
  reset_at timestamptz not null
);

alter table public_submit_limits enable row level security;

revoke all on table public_submit_limits from anon, authenticated;

do $$
begin
  if exists (
    select 1
    from jobs
    where quote_id is not null
    group by quote_id
    having count(*) > 1
  ) then
    raise exception 'jobs.quote_id already has duplicates; resolve them before the unique index';
  end if;

  if exists (
    select 1
    from invoices
    where job_id is not null
    group by job_id
    having count(*) > 1
  ) then
    raise exception 'invoices.job_id already has duplicates; resolve them before the unique index';
  end if;
end $$;

create unique index if not exists jobs_one_per_quote
  on jobs (quote_id)
  where quote_id is not null;

create unique index if not exists invoices_one_per_job
  on invoices (job_id)
  where job_id is not null;
