begin;

create table if not exists public.mate_activity_analysis_archive (
  round integer not null,
  activity_no integer not null,
  eligible bigint not null,
  joined bigint not null,
  declined bigint not null,
  submitted bigint not null,
  primary key (round, activity_no),
  foreign key (round, activity_no) references public.mate_activities(round, activity_no) on delete cascade
);

alter table public.mate_activity_analysis_archive enable row level security;
revoke all on public.mate_activity_analysis_archive from public, anon, authenticated;
grant select, insert on public.mate_activity_analysis_archive to service_role;

create or replace function public.mate_activity_progress(p_round integer)
returns table (activity_no integer, eligible bigint, joined bigint, declined bigint, submitted bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with roster as (
    select id from public.mate_applications where round = p_round and status = 'selected'
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
  select activity.activity_no, coalesce(archive.eligible, totals.headcount), coalesce(archive.joined, answers.joined, 0),
    coalesce(archive.declined, answers.declined, 0), coalesce(archive.submitted, answers.submitted, 0)
  from public.mate_activities as activity
  cross join totals
  left join answers on activity.activity_no = answers.activity_no
  left join public.mate_activity_analysis_archive archive on archive.round = activity.round and archive.activity_no = activity.activity_no
  where activity.round = p_round
  order by activity.activity_no;
$$;

create or replace function public.archive_expired_mate_activity_counts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.mate_activity_analysis_archive (round, activity_no, eligible, joined, declined, submitted)
  select cohort.round, progress.activity_no, progress.eligible, progress.joined, progress.declined, progress.submitted
  from public.mate_rounds cohort
  cross join lateral public.mate_activity_progress(cohort.round) progress
  where cohort.retain_through < (statement_timestamp() at time zone 'Asia/Seoul')::date
    and not exists (
      select 1 from public.mate_activity_analysis_archive archive
      where archive.round = cohort.round and archive.activity_no = progress.activity_no
    )
  on conflict (round, activity_no) do nothing;
  return null;
end;
$$;

drop trigger if exists archive_expired_mate_activity_counts on public.mate_applications;
create trigger archive_expired_mate_activity_counts
  before delete on public.mate_applications
  for each statement execute function public.archive_expired_mate_activity_counts();

revoke all on function public.archive_expired_mate_activity_counts() from public, anon, authenticated;

commit;
