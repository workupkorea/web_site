-- 비활성→활성 전환 시각 (NEW 뱃지 기준에 반영)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
