-- arrival_products: 구글 시트 동기화로 채워지는 기본 상품 목록
CREATE TABLE IF NOT EXISTS arrival_products (
  id BIGSERIAL PRIMARY KEY,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  product_type TEXT,
  new_arrival_type TEXT,
  color TEXT NOT NULL DEFAULT '',
  supply_price INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  arrival_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '입고예정',
  description TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  marketing_usage TEXT,
  image TEXT,
  detail_url TEXT,
  change_history JSONB NOT NULL DEFAULT '[]',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_code, arrival_date)
);

-- arrival_overrides: 관리자 수동 수정 오버라이드
-- override_key 형식: "productCode" 또는 "productCode::arrivalDate"
CREATE TABLE IF NOT EXISTS arrival_overrides (
  override_key TEXT PRIMARY KEY,
  arrival_date TEXT,
  status TEXT,
  image TEXT,
  detail_url TEXT,
  change_history JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
