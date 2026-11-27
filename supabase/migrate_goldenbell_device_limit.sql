-- 연말 이벤트: 같은 기기(브라우저 쿠키)에서 이벤트당 1회만 응모.
-- migrate_goldenbell_once_per_person.sql 실행 뒤에 한 번 실행한다. 다시 실행해도 안전하다.
-- 반드시 코드 배포 전에 실행한다. (컬럼이 없으면 응모가 접수되지 않는다)
-- 값이 없는 기존 행(null)은 서로 충돌하지 않는다.

alter table public.goldenbell_entries add column if not exists device_hash text;

create unique index if not exists goldenbell_entries_event_device_key
  on public.goldenbell_entries (event_id, device_hash);
