begin;

alter table public.mate_activities
  add column if not exists size_options text[] not null default '{}',
  add column if not exists color_options text[] not null default '{}';

alter table public.mate_activity_responses add column if not exists color text check (char_length(color) between 1 and 60);

create or replace function public.save_mate_activity_response(
  p_round integer, p_activity_no integer, p_application_id uuid, p_choice text, p_size text,
  p_link_version integer, p_color text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  configured_sizes text[];
  configured_colors text[];
begin
  select size_options, color_options into configured_sizes, configured_colors
    from public.mate_activities where round = p_round and activity_no = p_activity_no and published for share;
  if not found then return false; end if;

  perform 1 from public.mate_applications
    where round = p_round and id = p_application_id and status = 'selected'
      and link_version = p_link_version
      and retain_through >= (statement_timestamp() at time zone 'Asia/Seoul')::date for share;
  if not found then return false; end if;

  if p_choice = 'yes' then
    if p_size is null or (cardinality(configured_sizes) > 0 and not (p_size = any(configured_sizes))) then
      return false;
    end if;
    if cardinality(configured_colors) > 0 and (p_color is null or not (p_color = any(configured_colors))) then
      return false;
    end if;
  elsif p_choice is distinct from 'no' or p_size is not null or p_color is not null then
    return false;
  end if;

  insert into public.mate_activity_responses (round, activity_no, application_id, choice, size, color)
  values (p_round, p_activity_no, p_application_id, p_choice, p_size, p_color)
  on conflict (round, activity_no, application_id) do update
    set choice = excluded.choice, size = excluded.size, color = excluded.color, updated_at = now();
  return true;
end;
$$;

revoke all on function public.save_mate_activity_response(integer, integer, uuid, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.save_mate_activity_response(integer, integer, uuid, text, text, integer, text)
  to service_role;

commit;