-- Job To Go · 0026 · A stopped clock pays to the nearest half hour.
-- 2h20 → 2h30, 2h45 → 3h00 (a tie goes up), under 15 minutes → 0. Admin edits are not
-- rounded, and entries already closed stay as they are.

create or replace function public.clock_out_at(started timestamptz, stopped timestamptz)
returns timestamptz
language sql
immutable
as $$
  select started
    + round((greatest(extract(epoch from (stopped - started)), 0) / 1800)::numeric)
    * interval '30 minutes'
$$;

revoke all on function public.clock_out_at(timestamptz, timestamptz) from anon;
