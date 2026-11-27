-- Internal Vercel Preview data. The production Golden Bell tables are separate.
create table if not exists public.goldenbell_v2_preview_entries (
  id uuid primary key,
  name text not null,
  phone text not null,
  store text not null,
  mime text not null,
  photo bytea not null check (octet_length(photo) between 1 and 4194304),
  photo_hash text not null,
  created_at timestamptz not null,
  entry_day date not null,
  week_start date not null,
  outcome text not null check (outcome in ('won', 'lost')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  unique (phone, entry_day)
);

create index if not exists goldenbell_v2_preview_winners_week_idx
  on public.goldenbell_v2_preview_entries (week_start) where outcome = 'won';

alter table public.goldenbell_v2_preview_entries enable row level security;
revoke all on public.goldenbell_v2_preview_entries from public, anon, authenticated;
grant select, insert, update on public.goldenbell_v2_preview_entries to service_role;

create or replace function public.goldenbell_v2_preview_draw(
  p_id uuid, p_name text, p_phone text, p_store text,
  p_mime text, p_photo_base64 text, p_photo_hash text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draw_time timestamptz;
  local_day date;
  local_week date;
  result text;
begin
  -- Keep same-day deduplication and the weekly cap atomic across functions.
  perform pg_advisory_xact_lock(hashtextextended('goldenbell_v2_preview_draw', 0));
  select outcome into result from public.goldenbell_v2_preview_entries where id = p_id;
  if found then return result; end if;

  draw_time := clock_timestamp();
  local_day := (draw_time at time zone 'Asia/Seoul')::date;
  local_week := date_trunc('week', local_day::timestamp)::date;
  if (select count(*) from public.goldenbell_v2_preview_entries where week_start = local_week and outcome = 'won') >= 200 then
    return 'sold-out';
  end if;
  if exists (select 1 from public.goldenbell_v2_preview_entries where phone = p_phone and entry_day = local_day) then
    return 'already-entered';
  end if;

  -- 커피쿠폰은 번호당 1회만 당첨. 반려된 당첨 건은 쿠폰이 나가지 않으므로 제외한다.
  if exists (select 1 from public.goldenbell_v2_preview_entries where phone = p_phone and outcome = 'won' and status <> 'rejected') then
    result := 'lost';
  else
    result := case when random() < 0.5 then 'won' else 'lost' end;
  end if;
  insert into public.goldenbell_v2_preview_entries
    (id, name, phone, store, mime, photo, photo_hash, created_at, entry_day, week_start, outcome)
  values
    (p_id, p_name, p_phone, p_store, p_mime, decode(p_photo_base64, 'base64'), p_photo_hash, draw_time, local_day, local_week, result);
  return result;
end;
$$;

revoke all on function public.goldenbell_v2_preview_draw(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.goldenbell_v2_preview_draw(uuid, text, text, text, text, text, text) to service_role;
