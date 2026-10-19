-- arrival_sales_archive: 시즌별 판매 비교용 영구 아카이브 (시트에서 빠져도 삭제하지 않음)
CREATE TABLE IF NOT EXISTS arrival_sales_archive (
  product_code   TEXT NOT NULL,
  arrival_date   TEXT NOT NULL,
  season         TEXT NOT NULL DEFAULT '',
  product_name   TEXT NOT NULL DEFAULT '',
  brand          TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT '',
  quantity       INTEGER NOT NULL DEFAULT 0,
  order_quantity INTEGER,
  sales_quantity INTEGER,
  stock_quantity INTEGER,
  order_rate     NUMERIC,
  sales_rate     NUMERIC,
  supply_price   INTEGER NOT NULL DEFAULT 0,
  price          INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_code, arrival_date)
);

CREATE INDEX IF NOT EXISTS idx_arrival_sales_archive_season_brand
  ON arrival_sales_archive (season, brand);

-- 서버(service role)만 접근. 공개 읽기 차단
ALTER TABLE arrival_sales_archive ENABLE ROW LEVEL SECURITY;
-- SQL 에디터로 만든 테이블은 service_role 권한이 자동 부여되지 않아 명시 필요
GRANT ALL ON TABLE arrival_sales_archive TO service_role;

-- 제품 이미지(쉼표로 이어진 URL, 대표는 첫 번째). 오버라이드가 정리돼도 지난 시즌 이미지를 보존
ALTER TABLE arrival_sales_archive ADD COLUMN IF NOT EXISTS image TEXT;
