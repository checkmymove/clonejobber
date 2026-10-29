-- Job To Go · 0020 · A returning email may become a separate client when the
-- admin chooses "Create new client". Matching by email picks the latest one.

alter table clients drop constraint if exists clients_company_id_email_key;
create index if not exists clients_company_email_idx
  on clients (company_id, email, updated_at desc);
