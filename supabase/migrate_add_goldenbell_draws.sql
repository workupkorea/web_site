-- 연말 이벤트 당첨기: 당첨자와 추첨 제외번호. 서버(service role)만 읽고 쓴다.
-- 당첨자 테이블도 개인정보를 담으므로 이벤트 종료 후 180일 파기 대상이다.

create table if not exists public.goldenbell_winners (
  id          uuid primary key default gen_random_uuid(),
  prize       text not null check (prize in ('coffee', 'gold')),
  round       smallint not null,          -- 커피 1~4주차, 금 0
  entry_id    uuid not null,
  phone       text not null,
  name        text not null,
  store       text not null,
  drawn_at    timestamptz not null default now(),
  canceled_at timestamptz,
  unique (prize, phone)                   -- 경품별 번호당 1회 (취소한 번호도 다시 뽑지 않음)
);

create table if not exists public.goldenbell_excluded_phones (
  phone      text primary key check (phone ~ '^010[0-9]{8}$'),
  memo       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.goldenbell_winners enable row level security;
alter table public.goldenbell_excluded_phones enable row level security;
revoke all on public.goldenbell_winners, public.goldenbell_excluded_phones from public, anon, authenticated;
grant select, insert, update on public.goldenbell_winners to service_role;
grant select, insert, update, delete on public.goldenbell_excluded_phones to service_role;

-- 동시에 추첨해도 정원을 넘지 않도록 저장을 한 번에 하나씩 처리한다.
create or replace function public.goldenbell_save_winners(
  p_prize text, p_round int, p_quota int, p_winners jsonb
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved int;
begin
  perform pg_advisory_xact_lock(hashtextextended('goldenbell_save_winners', 0));
  if (select count(*) from public.goldenbell_winners
      where prize = p_prize and round = p_round and canceled_at is null)
     + jsonb_array_length(p_winners) > p_quota then
    raise exception 'goldenbell_quota_exceeded';
  end if;
  insert into public.goldenbell_winners (prize, round, entry_id, phone, name, store)
  select p_prize, p_round, w.entry_id, w.phone, w.name, w.store
  from jsonb_to_recordset(p_winners) as w(entry_id uuid, phone text, name text, store text);
  get diagnostics saved = row_count;
  return saved;
end;
$$;

revoke all on function public.goldenbell_save_winners(text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.goldenbell_save_winners(text, int, int, jsonb) to service_role;
