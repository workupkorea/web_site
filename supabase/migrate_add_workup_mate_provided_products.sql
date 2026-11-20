begin;

alter table public.mate_activities
  add column if not exists source_code text,
  add column if not exists unit_cost integer check (unit_cost between 0 and 100000000),
  add column if not exists additional_products jsonb not null default '[]' check (jsonb_typeof(additional_products) = 'array');

alter table public.mate_activity_responses
  add column if not exists additional_selections jsonb not null default '[]' check (jsonb_typeof(additional_selections) = 'array');

create or replace function public.save_mate_activity_response(
  p_round integer, p_activity_no integer, p_application_id uuid, p_choice text, p_size text,
  p_link_version integer, p_color text, p_additional_selections jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  activity public.mate_activities%rowtype;
  product jsonb;
  selection jsonb;
  normalized jsonb := '[]';
  selected_size text;
  selected_color text;
begin
  select * into activity from public.mate_activities
    where round = p_round and activity_no = p_activity_no and published for share;
  if not found then return null; end if;

  perform 1 from public.mate_applications
    where round = p_round and id = p_application_id and status = 'selected'
      and link_version = p_link_version
      and retain_through >= (statement_timestamp() at time zone 'Asia/Seoul')::date for share;
  if not found or jsonb_typeof(p_additional_selections) is distinct from 'array' then return null; end if;

  if p_choice = 'yes' then
    if p_size is null or (cardinality(activity.size_options) > 0 and not (p_size = any(activity.size_options)))
      or (cardinality(activity.color_options) > 0 and (p_color is null or not (p_color = any(activity.color_options))))
      or jsonb_array_length(p_additional_selections) <> jsonb_array_length(activity.additional_products) then
      return null;
    end if;
    for product in select value from jsonb_array_elements(activity.additional_products)
    loop
      select value into selection from jsonb_array_elements(p_additional_selections)
        where value->>'product_id' = product->>'id';
      if not found then return null; end if;
      selected_size := selection->>'size';
      selected_color := selection->>'color';
      if nullif(selected_size, '') is null or char_length(selected_size) > 60 or char_length(selected_color) > 60
        or (jsonb_array_length(product->'size_options') > 0 and not ((product->'size_options') ? selected_size))
        or (jsonb_array_length(product->'color_options') > 0 and (selected_color is null or not ((product->'color_options') ? selected_color))) then
        return null;
      end if;
      normalized := normalized || jsonb_build_array(jsonb_build_object(
        'product_id', product->>'id', 'product_name', product->>'name', 'size', selected_size, 'color', selected_color));
    end loop;
  elsif p_choice is distinct from 'no' or p_size is not null or p_color is not null or jsonb_array_length(p_additional_selections) <> 0 then
    return null;
  end if;

  insert into public.mate_activity_responses (round, activity_no, application_id, choice, size, color, additional_selections)
  values (p_round, p_activity_no, p_application_id, p_choice, p_size, p_color, normalized)
  on conflict (round, activity_no, application_id) do update
    set choice = excluded.choice, size = excluded.size, color = excluded.color,
      additional_selections = excluded.additional_selections, updated_at = now();
  return normalized;
end;
$$;

revoke all on function public.save_mate_activity_response(integer, integer, uuid, text, text, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_mate_activity_response(integer, integer, uuid, text, text, integer, text, jsonb) to service_role;

commit;