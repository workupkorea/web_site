-- 워크업 연말 이벤트: 응모 내역 테이블 + 영수증 사진 비공개 버킷
-- 고객은 /goldenbell, 관리자는 /goldenbell/admin 에서 사용한다. (service role 로만 접근)

create table if not exists goldenbell_entries (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  name          text not null,
  store         text not null,
  photo_path    text not null,
  photo_hash    text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  consent_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (phone, photo_hash)
);

create index if not exists goldenbell_entries_photo_hash_idx on goldenbell_entries (photo_hash);
create index if not exists goldenbell_entries_phone_idx on goldenbell_entries (phone);
create index if not exists goldenbell_entries_created_idx on goldenbell_entries (created_at desc);

-- 서버(service role)만 읽고 쓴다 — 외부 직접 접근 차단
alter table goldenbell_entries enable row level security;

-- 영수증 사진 저장소(비공개)
insert into storage.buckets (id, name, public)
values ('goldenbell-receipts', 'goldenbell-receipts', false)
on conflict (id) do nothing;

-- 서버(service role)가 접근할 수 있도록 권한 부여
grant all on public.goldenbell_entries to service_role;
