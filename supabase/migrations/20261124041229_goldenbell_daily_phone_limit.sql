alter table public.goldenbell_entries
  add column entry_phone text generated always as (
    regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'), '^82(10[0-9]{8})$', '0\1')
  ) stored,
  add column entry_day date generated always as ((created_at at time zone 'Asia/Seoul')::date) stored;

create unique index goldenbell_entries_phone_day_key
  on public.goldenbell_entries (entry_phone, entry_day);
