begin;

alter table public.mate_activity_responses
  add column if not exists result_metrics jsonb,
  add column if not exists result_metrics_updated_at timestamptz;

create or replace function public.clear_changed_mate_result_metrics()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if split_part(split_part(new.result_instagram_url, '?', 1), '#', 1)
    is distinct from split_part(split_part(old.result_instagram_url, '?', 1), '#', 1) then
    new.result_metrics := null;
    new.result_metrics_updated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_changed_mate_result_metrics on public.mate_activity_responses;
create trigger clear_changed_mate_result_metrics
  before update of result_instagram_url on public.mate_activity_responses
  for each row execute function public.clear_changed_mate_result_metrics();

create or replace function public.mate_result_metrics_summary(p_round integer, p_activity integer default null)
returns table (views_sum bigint, views_count bigint, likes_sum bigint, likes_count bigint, comments_sum bigint, comments_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select sum((result_metrics->>'views')::integer), count(result_metrics->>'views'),
    sum((result_metrics->>'likes')::integer), count(result_metrics->>'likes'),
    sum((result_metrics->>'comments')::integer), count(result_metrics->>'comments')
  from public.mate_activity_responses
  where round = p_round and (p_activity is null or activity_no = p_activity)
    and result_instagram_url is not null and result_submitted_at is not null;
$$;

revoke all on function public.clear_changed_mate_result_metrics() from public, anon, authenticated;
revoke all on function public.mate_result_metrics_summary(integer, integer) from public, anon, authenticated;
grant execute on function public.mate_result_metrics_summary(integer, integer) to service_role;

commit;
