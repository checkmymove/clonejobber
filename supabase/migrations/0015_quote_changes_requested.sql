-- Opero · 0015 · Client quote responses: changes requested.
alter table quotes drop constraint if exists quotes_status_check;
alter table quotes add constraint quotes_status_check
  check (status in ('draft', 'sent', 'approved', 'rejected', 'expired', 'changes_requested'));
