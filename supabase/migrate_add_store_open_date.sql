-- 지점 오픈 예약(오픈일 도래 시 자동 활성화) + 수정 내역 기록
ALTER TABLE stores ADD COLUMN IF NOT EXISTS open_date DATE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS change_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
