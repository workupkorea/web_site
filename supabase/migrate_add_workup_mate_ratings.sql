begin;

-- Ratings belong to a submitted result, so they follow its retention: purging the application removes them too.
create table if not exists public.mate_activity_ratings (
  round integer not null,
  activity_no integer not null,
  application_id uuid not null,
  score smallint not null check (score between 1 and 5),
  rated_at timestamptz not null default now(),
  primary key (round, activity_no, application_id),
  foreign key (round, activity_no, application_id)
    references public.mate_activity_responses (round, activity_no, application_id) on delete cascade
);

alter table public.mate_activity_ratings enable row level security;
revoke all on public.mate_activity_ratings from public, anon, authenticated;
grant select, insert, update, delete on public.mate_activity_ratings to service_role;

create or replace function public.clear_changed_mate_rating()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if split_part(split_part(new.result_instagram_url, '?', 1), '#', 1)
    is distinct from split_part(split_part(old.result_instagram_url, '?', 1), '#', 1) then
    delete from public.mate_activity_ratings
      where round = new.round and activity_no = new.activity_no and application_id = new.application_id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_changed_mate_rating on public.mate_activity_responses;
create trigger clear_changed_mate_rating
  after update of result_instagram_url on public.mate_activity_responses
  for each row execute function public.clear_changed_mate_rating();

revoke all on function public.clear_changed_mate_rating() from public, anon, authenticated;

commit;
