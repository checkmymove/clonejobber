-- Job To Go · 0028 · Expenses: "Food & meals" for crew food on a job (job page › Expenses).

alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('fuel', 'van_hire', 'materials', 'food', 'equipment', 'tolls_parking',
                      'insurance', 'marketing', 'subcontractors', 'office', 'other'));
