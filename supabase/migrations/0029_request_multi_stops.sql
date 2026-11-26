-- Job To Go · 0029 · Several collections and deliveries per request
-- The public form lets the client add Collection 2, 3… and Delivery 2, 3….
-- Position 0 is the main stop (what lists, quotes and jobs already read);
-- extra stops get 1, 2, … Existing rows keep position 0, so old code keeps working.

alter table request_locations
  add column if not exists position smallint not null default 0
    check (position between 0 and 19);

alter table request_locations drop constraint if exists request_locations_pkey;
alter table request_locations
  add constraint request_locations_pkey primary key (request_id, kind, position);
