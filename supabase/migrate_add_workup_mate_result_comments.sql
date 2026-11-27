-- Run after migrate_add_workup_mate_ratings.sql.
begin;

-- Admin memo on a submitted result. Not archived: purging the application removes it.
create table if not exists public.mate_activity_comments (
  round integer not null,
  activity_no integer not null,
  application_id uuid not null,
  comment text not null check (char_length(comment) between 1 and 500),
  updated_at timestamptz not null default now(),
  primary key (round, activity_no, application_id),
  foreign key (round, activity_no, application_id)
    references public.mate_activity_responses (round, activity_no, application_id) on delete cascade
);

alter table public.mate_activity_comments enable row level security;
revoke all on public.mate_activity_comments from public, anon, authenticated;
grant select, insert, update, delete on public.mate_activity_comments to service_role;

commit;
