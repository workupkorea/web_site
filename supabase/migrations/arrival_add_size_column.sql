-- arrival_products 추가 컬럼
--  size:           사이즈런 (시트 "사이즈런" 열, 예 "00S~4XL")
--  order_quantity: 총주문 수량 (시트 "총주문 수량" 열). 주문율 = order_quantity / quantity
--  sales_quantity: 총판매 수량 (시트 "총판매 수량" 열)
--  stock_quantity: 총재고 수량 (시트 "총재고 수량" 열)
ALTER TABLE arrival_products ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE arrival_products ADD COLUMN IF NOT EXISTS order_quantity INTEGER;
ALTER TABLE arrival_products ADD COLUMN IF NOT EXISTS sales_quantity INTEGER;
ALTER TABLE arrival_products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;
