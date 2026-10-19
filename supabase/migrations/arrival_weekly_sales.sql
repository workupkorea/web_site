-- arrival_weekly_sales: 시트의 주차별 주문·판매(주간 증분)를 영구 보관 — "언제, 얼마만에 팔렸나" 분석용
CREATE TABLE IF NOT EXISTS arrival_weekly_sales (
  product_code TEXT NOT NULL,
  arrival_date TEXT NOT NULL,
  week_start   TEXT NOT NULL,
  week_end     TEXT NOT NULL,
  order_qty    INTEGER NOT NULL DEFAULT 0,
  sales_qty    INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_code, arrival_date, week_start)
);

CREATE INDEX IF NOT EXISTS idx_arrival_weekly_sales_week
  ON arrival_weekly_sales (week_start);

ALTER TABLE arrival_weekly_sales ENABLE ROW LEVEL SECURITY;
-- SQL 에디터로 만든 테이블은 service_role 권한이 자동 부여되지 않아 명시 필요
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.arrival_weekly_sales TO service_role;
