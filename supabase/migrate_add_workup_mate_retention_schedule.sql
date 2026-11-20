begin;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- The production scheduler runs in UTC, so 15:00 UTC is midnight in Korea.
select cron.schedule(
  'workup-mate-retention-cleanup',
  '0 15 * * *',
  $job$
    delete from public.mate_applications
    where retain_through < (statement_timestamp() at time zone 'Asia/Seoul')::date;
  $job$
);

commit;
