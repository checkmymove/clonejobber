-- Opero · 0002 · Seed: company, lead sources, services catalog.
-- Company data mirrors the current operation; brand is Opero.

insert into companies (slug, name, brand_name, primary_color, terms_url)
values (
  'moving-london',
  'Moving London Transport',
  'Opero',
  '#123035',
  'https://movinglondontransport.com/terms'
)
on conflict (slug) do nothing;

-- Lead sources from the reference flow (admin-configurable, not hardcoded).
insert into lead_sources (company_id, name, sort)
select c.id, s.name, s.sort
from companies c
cross join (values
  ('Google', 1),
  ('Check My Move', 2),
  ('Checkatrade', 3),
  ('Referral', 4),
  ('Website', 5),
  ('Vehicle Wrap', 6),
  ('Yell', 7),
  ('Flyer', 8),
  ('Other', 9)
) as s(name, sort)
where c.slug = 'moving-london'
on conflict (company_id, name) do nothing;

-- Services catalog from the reference flow.
insert into services (company_id, name, sort)
select c.id, s.name, s.sort
from companies c
cross join (values
  ('Driver + Luton Van', 1),
  ('Driver + Helper + Luton Van', 2),
  ('Office Relocation', 3),
  ('Disposal Service', 4),
  ('Piano Service', 5),
  ('Helper Service', 6)
) as s(name, sort)
where c.slug = 'moving-london'
on conflict (company_id, name) do nothing;
