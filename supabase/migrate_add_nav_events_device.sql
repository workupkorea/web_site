-- 메뉴 분석: 기기별(모바일/태블릿/PC) 구분용 컬럼
-- Supabase SQL Editor(/admin/db-status)에서 실행하세요. 실행 전에도 사이트는 정상 동작합니다.
ALTER TABLE nav_events ADD COLUMN IF NOT EXISTS device TEXT DEFAULT '';
