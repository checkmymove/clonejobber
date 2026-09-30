-- Opero · 0011 · Quote moving time and inventory.
-- valid_until keeps the moving date (the quote form labels that column Moving date).

alter table quotes
  add column if not exists move_time text not null default '';

alter table quotes
  add column if not exists inventory text not null default '';
