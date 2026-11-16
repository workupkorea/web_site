-- 관리자 전단 원본: 브라우저 DB 접근 없이 인증된 서버 라우트에서만 사용한다.
create table if not exists public.print_studio_projects (
  id uuid primary key,
  owner_key text not null,
  title text not null check (char_length(title) between 1 and 200),
  object_path text not null,
  revision uuid not null,
  paper text not null default 'A3',
  width_mm numeric not null,
  height_mm numeric not null,
  cell_count integer not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists print_studio_projects_owner_updated on public.print_studio_projects(owner_key, updated_at desc);
alter table public.print_studio_projects enable row level security;
revoke all on public.print_studio_projects from public, anon, authenticated;
grant all on public.print_studio_projects to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('print-studio-private', 'print-studio-private', false, 83886080, array['application/json','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
update storage.buckets set allowed_mime_types = array['application/json','image/png','image/jpeg','image/webp'] where id = 'print-studio-private';
