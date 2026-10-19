-- 폐업 처리 일시 (값이 있으면 폐업 상태)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
