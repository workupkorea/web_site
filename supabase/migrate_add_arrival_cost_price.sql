-- 입고 스케쥴: 원가(시트 AF열) 컬럼 추가
ALTER TABLE arrival_products ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0;
