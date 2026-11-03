-- 폐업 예정일 (도래하면 자동 폐업 처리: closed_at 기록 + 비활성)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS close_date DATE;
-- 폐업 사유 (목록 매장명 앞 배지로 표시)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS close_reason TEXT;
