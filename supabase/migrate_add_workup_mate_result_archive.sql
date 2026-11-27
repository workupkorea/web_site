-- Run after migrate_add_workup_mate_ratings.sql.
begin;

create extension if not exists pg_cron with schema pg_catalog;

-- Replaces the earlier anonymous per-activity totals.
drop trigger if exists archive_expired_mate_ratings on public.mate_applications;
drop function if exists public.archive_expired_mate_ratings();
drop table if exists public.mate_activity_rating_archive;

-- Set only for applications submitted under the notice that includes the one-year retention.
alter table public.mate_applications add column if not exists result_consent_at timestamptz;

create table if not exists public.mate_result_archive (
  id uuid primary key default gen_random_uuid(),
  round integer not null references public.mate_rounds(round) on delete cascade,
  sns_id text not null,
  name text not null,
  scores jsonb not null default '{}'::jsonb,
  expires_on date not null,
  unique (round, sns_id)
);

alter table public.mate_result_archive enable row level security;
revoke all on public.mate_result_archive from public, anon, authenticated;
grant select, insert, delete on public.mate_result_archive to service_role;

create or replace function public.archive_expired_mate_result()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Manual deletions before the activity ends (e.g. a withdrawal request) are not archived.
  if old.status = 'selected' and old.result_consent_at is not null
    and old.retain_through < (statement_timestamp() at time zone 'Asia/Seoul')::date then
    insert into public.mate_result_archive (round, sns_id, name, scores, expires_on)
    values (old.round, old.sns_id, old.name,
      coalesce((select jsonb_object_agg(rating.activity_no::text, rating.score)
        from public.mate_activity_ratings as rating
        where rating.round = old.round and rating.application_id = old.id), '{}'::jsonb),
      (old.retain_through + interval '1 year')::date)
    on conflict (round, sns_id) do nothing;
  end if;
  return old;
end;
$$;

-- Runs before the cascade removes the individual ratings.
drop trigger if exists archive_expired_mate_result on public.mate_applications;
create trigger archive_expired_mate_result
  before delete on public.mate_applications
  for each row execute function public.archive_expired_mate_result();

revoke all on function public.archive_expired_mate_result() from public, anon, authenticated;

-- 00:05 KST: destroy results whose one-year retention has passed.
select cron.schedule(
  'workup-mate-result-archive-cleanup',
  '5 15 * * *',
  $job$
    delete from public.mate_result_archive
    where expires_on < (statement_timestamp() at time zone 'Asia/Seoul')::date;
  $job$
);

commit;
