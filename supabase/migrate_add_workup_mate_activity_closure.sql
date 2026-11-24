begin;

alter table public.mate_activities add column if not exists closed_at timestamptz;

create or replace function public.guard_closed_mate_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ended_at timestamptz;
begin
  select closed_at into ended_at from public.mate_activities
    where round = new.round and activity_no = new.activity_no for share;
  if ended_at is not null then
    raise exception 'mate_activity_closed' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_closed_mate_activity on public.mate_activity_responses;
create trigger guard_closed_mate_activity
  before insert or update of choice, size, color, additional_selections, result_instagram_url, result_submitted_at
  on public.mate_activity_responses
  for each row execute function public.guard_closed_mate_activity();

revoke all on function public.guard_closed_mate_activity() from public, anon, authenticated;

commit;
