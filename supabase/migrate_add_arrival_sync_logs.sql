-- 입고 스케쥴 구글시트 동기화 이력 테이블
-- 기존에는 브라우저 localStorage에만 남아 기기별로 이력이 달랐다.
-- DB에 저장해 관리자 누구나, 어느 기기에서든 동일한 이력을 계속 추적할 수 있게 한다.
-- Supabase SQL Editor 에서 1회 실행하세요.

create table if not exists arrival_sync_logs (
  id           bigint generated always as identity primary key,
  synced_at    timestamptz not null default now(),
  duration_sec numeric,
  total        integer not null default 0,
  by_status    jsonb not null default '{}',
  diff         jsonb not null default '[]',
  actor_name   text,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_arrival_sync_logs_synced_at on arrival_sync_logs (synced_at desc);

-- 서버(service_role)만 읽고 쓰도록 권한 부여.
grant all on table arrival_sync_logs to service_role;
alter table arrival_sync_logs enable row level security;
