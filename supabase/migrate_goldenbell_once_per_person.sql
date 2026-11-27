-- 연말 이벤트 응모 제한: 번호당 하루 1회 → 이벤트당 번호 1회 + 같은 영수증 사진 1회.
-- migrate_add_goldenbell_events.sql 실행 뒤에 한 번 실행한다. 다시 실행해도 안전하다.
-- 직원 테스트 응모(<이벤트>:test)는 예전 규칙으로 중복이 있어 지운다. 실제 응모는 지우지 않으며,
-- 실제 응모에 중복이 남아 있으면 인덱스 생성이 실패한다.

delete from public.goldenbell_winners where event_id like '%:test';
delete from public.goldenbell_entries where event_id like '%:test';

create unique index if not exists goldenbell_entries_event_phone_key
  on public.goldenbell_entries (event_id, entry_phone);
create unique index if not exists goldenbell_entries_event_photo_key
  on public.goldenbell_entries (event_id, photo_hash);

drop index if exists public.goldenbell_entries_phone_day_key;
alter table public.goldenbell_entries drop constraint if exists goldenbell_entries_phone_photo_hash_key;
