-- Job To Go · 0021 · One "Send email & text" for requests, quotes, jobs and invoices.
-- Email and SMS deliveries are logged for any of the four documents.

alter table email_deliveries drop constraint if exists email_deliveries_document_type_check;
alter table email_deliveries add constraint email_deliveries_document_type_check
  check (document_type in ('request', 'quote', 'job', 'invoice'));

alter table sms_deliveries add column if not exists document_type text;
alter table sms_deliveries add column if not exists document_id uuid;
alter table sms_deliveries alter column quote_id drop not null;
update sms_deliveries
  set document_type = 'quote', document_id = quote_id
  where document_type is null and quote_id is not null;
alter table sms_deliveries drop constraint if exists sms_deliveries_document_type_check;
alter table sms_deliveries add constraint sms_deliveries_document_type_check
  check (document_type is null or document_type in ('request', 'quote', 'job', 'invoice'));
create index if not exists sms_deliveries_document_idx
  on sms_deliveries (document_type, document_id, sent_at desc);
