-- 상단 메뉴 클릭 / 이동 페이지 체류시간 수집
-- Supabase SQL Editor(/admin/db-status)에서 실행하세요

CREATE TABLE IF NOT EXISTS nav_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,          -- nav_click | dwell
  nav_label TEXT NOT NULL DEFAULT '',-- 메뉴명(한글명 우선)
  href TEXT DEFAULT '',              -- 메뉴 링크
  path TEXT DEFAULT '',              -- 이벤트 발생 페이지
  duration_sec INTEGER,              -- dwell 전용: 메뉴로 이동한 페이지 체류 초
  visitor_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nav_events_created_idx ON nav_events (created_at);
CREATE INDEX IF NOT EXISTS nav_events_label_idx ON nav_events (nav_label);

ALTER TABLE nav_events ENABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE nav_events TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE nav_events_id_seq TO service_role;

-- 메뉴별 집계 RPC
CREATE OR REPLACE FUNCTION aggregate_nav_events(
  since_iso timestamptz,
  until_iso timestamptz DEFAULT NULL
)
RETURNS TABLE (
  nav_label       text,
  click_count     bigint,
  visitor_count   bigint,
  dwell_count     bigint,
  avg_dwell_sec   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    nav_label,
    COUNT(*) FILTER (WHERE event_type = 'nav_click')                         AS click_count,
    COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'nav_click')       AS visitor_count,
    COUNT(*) FILTER (WHERE event_type = 'dwell')                             AS dwell_count,
    ROUND(AVG(duration_sec) FILTER (WHERE event_type = 'dwell'), 1)          AS avg_dwell_sec
  FROM nav_events
  WHERE created_at >= since_iso
    AND (until_iso IS NULL OR created_at <= until_iso)
  GROUP BY nav_label;
$$;
