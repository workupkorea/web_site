-- 골든벨을 반복해서 쓰도록 응모·당첨·제외번호를 이벤트별로 나눈다.
-- migrate_add_goldenbell_draws.sql 실행 뒤에 한 번 실행한다. 다시 실행해도 안전하다.
-- 기존 데이터는 첫 이벤트('goldenbell')로 귀속된다.

alter table public.goldenbell_entries add column if not exists event_id text not null default 'goldenbell';
create index if not exists goldenbell_entries_event_idx on public.goldenbell_entries (event_id, created_at desc);

-- 하루 1회 제한용 컬럼 (migrations/20261124041229 를 실행하지 않은 DB 에서도 동작하도록 여기서도 만든다)
alter table public.goldenbell_entries
  add column if not exists entry_phone text generated always as (
    regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'), '^82(10[0-9]{8})$', '0\1')
  ) stored,
  add column if not exists entry_day date generated always as ((created_at at time zone 'Asia/Seoul')::date) stored;

-- 하루 1회·같은 영수증 제한은 이벤트별로 센다. (테스트 응모가 실제 응모를 막지 않는다)
drop index if exists public.goldenbell_entries_phone_day_key;
create unique index if not exists goldenbell_entries_phone_day_key
  on public.goldenbell_entries (event_id, entry_phone, entry_day);
alter table public.goldenbell_entries drop constraint if exists goldenbell_entries_phone_photo_hash_key;
alter table public.goldenbell_entries add constraint goldenbell_entries_phone_photo_hash_key unique (event_id, phone, photo_hash);

alter table public.goldenbell_winners add column if not exists event_id text not null default 'goldenbell';
alter table public.goldenbell_winners drop constraint if exists goldenbell_winners_prize_phone_key;
create unique index if not exists goldenbell_winners_event_prize_phone_key
  on public.goldenbell_winners (event_id, prize, phone);

alter table public.goldenbell_excluded_phones add column if not exists event_id text not null default 'goldenbell';
alter table public.goldenbell_excluded_phones drop constraint if exists goldenbell_excluded_phones_pkey;
alter table public.goldenbell_excluded_phones add constraint goldenbell_excluded_phones_pkey primary key (event_id, phone);

-- 테스트 데이터 삭제용
grant delete on public.goldenbell_winners to service_role;

drop function if exists public.goldenbell_save_winners(text, int, int, jsonb);
create or replace function public.goldenbell_save_winners(
  p_event text, p_prize text, p_round int, p_quota int, p_winners jsonb
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
      where event_id = p_event and prize = p_prize and round = p_round and canceled_at is null)
     + jsonb_array_length(p_winners) > p_quota then
    raise exception 'goldenbell_quota_exceeded';
  end if;
  insert into public.goldenbell_winners (event_id, prize, round, entry_id, phone, name, store)
  select p_event, p_prize, p_round, w.entry_id, w.phone, w.name, w.store
  from jsonb_to_recordset(p_winners) as w(entry_id uuid, phone text, name text, store text);
  get diagnostics saved = row_count;
  return saved;
end;
$$;

revoke all on function public.goldenbell_save_winners(text, text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.goldenbell_save_winners(text, text, int, int, jsonb) to service_role;
