-- Job To Go · 0019 · Brand renamed from Opero to Job To Go.

alter table companies alter column brand_name set default 'Job To Go';
update companies set brand_name = 'Job To Go' where brand_name = 'Opero';
