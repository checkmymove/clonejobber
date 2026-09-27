-- Opero · 0005 · New Client parity with the reference form:
-- street 2, county, country and tax rate on the properties store.

alter table client_addresses
  add column if not exists street_2 text not null default '',
  add column if not exists county text not null default '',
  add column if not exists country text not null default 'United Kingdom',
  add column if not exists tax_rate text;
