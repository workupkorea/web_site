begin;

create table if not exists public.mate_rounds (
  round integer primary key check (round between 1 and 999),
  activity_period text not null check (char_length(activity_period) between 1 and 120),
  starts_on date,
  ends_on date,
  announces_on date,
  retain_through date,
  outdoor_quota integer check (outdoor_quota between 0 and 9999),
  work_quota integer check (work_quota between 0 and 9999),
  lifestyle_quota integer check (lifestyle_quota between 0 and 9999),
  published boolean not null default false,
  check (starts_on <= ends_on and ends_on <= announces_on and announces_on <= retain_through),
  check (not published or (starts_on is not null and ends_on is not null
    and announces_on is not null and retain_through is not null))
);

create table if not exists public.mate_applications (
  id uuid primary key default gen_random_uuid(),
  round integer not null references public.mate_rounds(round),
  sns_id text not null check (sns_id ~ '^[a-z0-9._]{1,30}$'),
  feed_styles text[] not null check (
    cardinality(feed_styles) between 1 and 3
    and feed_styles <@ array['outdoor', 'work', 'lifestyle']::text[]
  ),
  name text not null check (char_length(name) between 1 and 60),
  gender text not null check (gender in ('male', 'female', 'other', 'undisclosed')),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  address text not null check (char_length(address) between 1 and 240),
  height_cm numeric(4,1) not null check (height_cm between 50 and 260),
  message text not null default '' check (char_length(message) <= 1500),
  status text not null default 'received' check (status in ('received', 'reviewing', 'selected', 'not_selected')),
  submitted_at timestamptz not null default now(),
  retain_through date not null,
  unique (round, sns_id)
);

create index if not exists mate_applications_round_submitted_idx
  on public.mate_applications (round, submitted_at desc, id desc);
create index if not exists mate_applications_retention_idx
  on public.mate_applications (retain_through);

alter table public.mate_rounds enable row level security;
alter table public.mate_applications enable row level security;
revoke all on table public.mate_rounds, public.mate_applications from public, anon, authenticated;
grant select, insert, update on table public.mate_rounds to service_role;
grant select, insert, update, delete on table public.mate_applications to service_role;

-- Serialize a submission against edits to its round and keep the retention date shown at consent.
create or replace function public.submit_mate_application(
  p_round integer, p_retain_through date, p_sns_id text, p_feed_styles text[],
  p_name text, p_gender text, p_phone text, p_address text, p_height_cm numeric, p_message text
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recruitment public.mate_rounds%rowtype;
  today date := (statement_timestamp() at time zone 'Asia/Seoul')::date;
begin
  select * into recruitment from public.mate_rounds where round = p_round for share;
  if not found or not recruitment.published or today not between recruitment.starts_on and recruitment.ends_on then
    return 'closed';
  end if;
  if p_retain_through is distinct from recruitment.retain_through then
    return 'changed';
  end if;

  insert into public.mate_applications (
    round, sns_id, feed_styles, name, gender, phone, address, height_cm, message, retain_through
  ) values (
    p_round, p_sns_id, p_feed_styles, p_name, p_gender, p_phone, p_address, p_height_cm, p_message, recruitment.retain_through
  )
  on conflict (round, sns_id) do nothing;
  if not found then
    return 'duplicate';
  end if;
  return 'accepted';
end;
$$;

revoke all on function public.submit_mate_application(integer, date, text, text[], text, text, text, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.submit_mate_application(integer, date, text, text[], text, text, text, text, numeric, text)
  to service_role;

insert into public.mate_rounds (round, activity_period)
values (3, '2026FW 시즌부터 2027SS 시즌까지')
on conflict (round) do nothing;

commit;