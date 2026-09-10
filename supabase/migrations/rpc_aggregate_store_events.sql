-- store_events 집계 RPC
-- Supabase SQL 에디터에서 실행하세요
-- 기존 402회 순차 쿼리를 단일 DB 집계로 교체합니다

CREATE OR REPLACE FUNCTION aggregate_store_events(
  since_iso  timestamptz,
  until_iso  timestamptz DEFAULT NULL
)
RETURNS TABLE (
  store_id            bigint,
  store_name          text,
  view_count          bigint,
  list_click_count    bigint,
  directions_kakao_count bigint,
  directions_naver_count bigint,
  call_count          bigint,
  kakao_chat_count    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    store_id,
    store_name,
    COUNT(*) FILTER (WHERE event_type = 'view')              AS view_count,
    COUNT(*) FILTER (WHERE event_type = 'list_click')        AS list_click_count,
    COUNT(*) FILTER (WHERE event_type = 'directions_kakao')  AS directions_kakao_count,
    COUNT(*) FILTER (WHERE event_type = 'directions_naver')  AS directions_naver_count,
    COUNT(*) FILTER (WHERE event_type = 'call')              AS call_count,
    COUNT(*) FILTER (WHERE event_type = 'kakao_chat')        AS kakao_chat_count
  FROM store_events
  WHERE created_at >= since_iso
    AND (until_iso IS NULL OR created_at <= until_iso)
  GROUP BY store_id, store_name;
$$;
