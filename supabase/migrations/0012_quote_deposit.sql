-- Opero · 0012 · Required deposit on a quote, stored in pence.

alter table quotes
  add column if not exists deposit integer not null default 0 check (deposit >= 0);
