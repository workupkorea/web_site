-- 오류 수정 내역 테이블 (출고패스·입고스케쥴 등 외부 지점이 보는 화면의 오류 기록)
-- 증상·원인·조치·영향 범위·재발 방지 조치를 상세히 남긴다.
-- Supabase SQL Editor(또는 /admin/db-status SQL 에디터)에서 1회 실행하세요.

create table if not exists fix_logs (
  id               bigint generated always as identity primary key,
  target           text not null default '기타',     -- 출고패스 | 입고스케쥴 | 기타
  title            text not null,                    -- 한 줄 제목
  occurred_on      date,                             -- 오류 발생일
  resolved_on      date,                             -- 해결(조치)일
  symptom          text,                             -- 증상
  cause            text,                             -- 원인
  action_taken     text,                             -- 조치
  impact           text,                             -- 영향 범위
  prevention       text,                             -- 재발 방지 조치
  status           text not null default '조치완료', -- 조치완료 | 재발방지 진행중
  author_id        text,                             -- 작성한 회원(members.id)
  author_name      text not null default '알 수 없음',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_fix_logs_created_at on fix_logs (created_at desc);
create index if not exists idx_fix_logs_target     on fix_logs (target);

-- 서버(service_role)만 읽고 쓰도록 권한 부여 (audit_logs 와 동일 방식).
grant all on table fix_logs to service_role;
alter table fix_logs enable row level security;
