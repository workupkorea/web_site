begin;

alter table public.mate_applications
  add column if not exists link_version integer not null default 0 check (link_version >= 0),
  add column if not exists link_first_issued_at timestamptz,
  add column if not exists link_issued_at timestamptz;

-- Selected applications follow the cohort's configured activity end, including later extensions.
create or replace function public.sync_mate_selected_retention() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.mate_applications set retain_through = new.retain_through
    where round = new.round and status = 'selected' and retain_through <> new.retain_through;
  return new;
end;
$$;

drop trigger if exists mate_selected_retention on public.mate_rounds;
create trigger mate_selected_retention
  after update of retain_through on public.mate_rounds
  for each row when (new.retain_through is not null and new.retain_through is distinct from old.retain_through)
  execute function public.sync_mate_selected_retention();

create or replace function public.set_mate_selected_retention() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  activity_end date;
begin
  select retain_through into activity_end from public.mate_rounds where round = new.round;
  new.retain_through := coalesce(activity_end, new.retain_through);
  return new;
end;
$$;

drop trigger if exists mate_select_retention on public.mate_applications;
create trigger mate_select_retention
  before update of status on public.mate_applications
  for each row when (new.status = 'selected' and new.status is distinct from old.status)
  execute function public.set_mate_selected_retention();

update public.mate_applications as application
  set retain_through = cohort.retain_through
  from public.mate_rounds as cohort
  where application.round = cohort.round and application.status = 'selected'
    and cohort.retain_through is not null and application.retain_through <> cohort.retain_through;

create or replace function public.issue_mate_participant_link(
  p_round integer, p_application_id uuid, p_expected_version integer, p_reissue boolean
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.mate_applications
    set link_first_issued_at = coalesce(link_first_issued_at, statement_timestamp()),
        link_issued_at = statement_timestamp(),
        link_version = case when p_reissue then link_version + 1 else link_version end
    where round = p_round and id = p_application_id and status = 'selected'
      and retain_through >= (statement_timestamp() at time zone 'Asia/Seoul')::date
      and link_version = p_expected_version and (link_issued_at is not null) = p_reissue;
  return found;
end;
$$;

revoke all on function public.sync_mate_selected_retention(), public.set_mate_selected_retention()
  from public, anon, authenticated;
revoke all on function public.issue_mate_participant_link(integer, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.issue_mate_participant_link(integer, uuid, integer, boolean) to service_role;

-- Keep the prior overload available during deployment. New participant writes also verify the current link version.
create or replace function public.save_mate_activity_response(
  p_round integer, p_activity_no integer, p_application_id uuid, p_choice text, p_size text, p_link_version integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.mate_activities
    where round = p_round and activity_no = p_activity_no and published for share;
  if not found then return false; end if;

  perform 1 from public.mate_applications
    where round = p_round and id = p_application_id and status = 'selected'
      and link_version = p_link_version
      and retain_through >= (statement_timestamp() at time zone 'Asia/Seoul')::date for share;
  if not found then return false; end if;

  insert into public.mate_activity_responses (round, activity_no, application_id, choice, size)
  values (p_round, p_activity_no, p_application_id, p_choice, p_size)
  on conflict (round, activity_no, application_id) do update
    set choice = excluded.choice, size = excluded.size, updated_at = now();
  return true;
end;
$$;

revoke all on function public.save_mate_activity_response(integer, integer, uuid, text, text, integer) from anon, authenticated, public;
grant execute on function public.save_mate_activity_response(integer, integer, uuid, text, text, integer) to service_role;

commit;