begin;

alter table public.mate_activity_responses
  add column if not exists result_instagram_url text check (char_length(result_instagram_url) <= 500),
  add column if not exists result_submitted_at timestamptz;

create or replace function public.mate_activity_progress(p_round integer)
returns table (activity_no integer, eligible bigint, joined bigint, declined bigint, submitted bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with roster as (
    select id from public.mate_applications
    where round = p_round and status = 'selected'
  ), totals as (
    select count(*) as headcount from roster
  ), answers as (
    select response.activity_no,
      count(*) filter (where response.choice = 'yes') as joined,
      count(*) filter (where response.choice = 'no') as declined,
      count(*) filter (where response.choice = 'yes' and response.result_instagram_url is not null) as submitted
    from public.mate_activity_responses as response
    join roster on response.application_id = roster.id
    where response.round = p_round
    group by response.activity_no
  )
  select activity.activity_no, totals.headcount, coalesce(answers.joined, 0),
    coalesce(answers.declined, 0), coalesce(answers.submitted, 0)
  from public.mate_activities as activity
  cross join totals
  left join answers on activity.activity_no = answers.activity_no
  where activity.round = p_round
  order by activity.activity_no;
$$;

create or replace function public.submit_mate_activity_result(
  p_round integer, p_activity_no integer, p_application_id uuid, p_link_version integer, p_instagram_url text
) returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submitted_at timestamptz;
begin
  perform 1 from public.mate_activities
    where round = p_round and activity_no = p_activity_no and published for share;
  if not found then return null; end if;

  perform 1 from public.mate_applications
    where round = p_round and id = p_application_id and status = 'selected'
      and link_version = p_link_version
      and retain_through >= (statement_timestamp() at time zone 'Asia/Seoul')::date for share;
  if not found then return null; end if;

  update public.mate_activity_responses
    set result_instagram_url = p_instagram_url, result_submitted_at = statement_timestamp()
    where round = p_round and activity_no = p_activity_no and application_id = p_application_id and choice = 'yes'
    returning result_submitted_at into submitted_at;
  return submitted_at;
end;
$$;

revoke all on function public.mate_activity_progress(integer) from public, anon, authenticated;
revoke all on function public.submit_mate_activity_result(integer, integer, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.mate_activity_progress(integer) to service_role;
grant execute on function public.submit_mate_activity_result(integer, integer, uuid, integer, text) to service_role;

commit;