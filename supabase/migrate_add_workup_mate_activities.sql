begin;

create unique index if not exists mate_application_round_id_idx on public.mate_applications (round, id);

create table if not exists public.mate_activities (
  round integer not null references public.mate_rounds (round),
  activity_no integer not null check (activity_no between 1 and 999),
  product_name text not null check (char_length(product_name) between 1 and 120),
  product_info text not null default '' check (char_length(product_info) <= 2000),
  product_url text check (char_length(product_url) <= 500),
  published boolean not null default false,
  primary key (round, activity_no)
);

create table if not exists public.mate_activity_responses (
  round integer not null,
  activity_no integer not null,
  application_id uuid not null,
  choice text not null check (choice in ('yes','no')),
  size text check (char_length(size) between 1 and 60),
  updated_at timestamptz not null default now(),
  primary key (round, activity_no, application_id),
  foreign key (round, activity_no) references public.mate_activities (round, activity_no) on delete cascade,
  foreign key (round, application_id) references public.mate_applications (round, id) on delete cascade,
  check ((choice = 'yes' and size is not null) or (choice = 'no' and size is null))
);
create index if not exists mate_activity_responses_app_idx on public.mate_activity_responses (round, application_id);

alter table public.mate_activities enable row level security;
alter table public.mate_activity_responses enable row level security;
revoke all on table public.mate_activities, public.mate_activity_responses from anon, authenticated, public;
grant select, insert, update on table public.mate_activities to service_role;
grant select, insert, update on table public.mate_activity_responses to service_role;

create or replace function public.save_mate_activity_response(
  p_round integer, p_activity_no integer, p_application_id uuid, p_choice text, p_size text
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
      and retain_through >= (statement_timestamp() at time zone 'Asia/Seoul')::date for share;
  if not found then return false; end if;

  insert into public.mate_activity_responses (round, activity_no, application_id, choice, size)
  values (p_round, p_activity_no, p_application_id, p_choice, p_size)
  on conflict (round, activity_no, application_id) do update
    set choice = excluded.choice, size = excluded.size, updated_at = now();
  return true;
end;
$$;

revoke all on function public.save_mate_activity_response(integer, integer, uuid, text, text) from anon, authenticated, public;
grant execute on function public.save_mate_activity_response(integer, integer, uuid, text, text) to service_role;

commit;