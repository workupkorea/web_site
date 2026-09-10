-- arrival_products: 구글 시트 행별 최종수정일시 (Apps Script onEdit 가 기록한 값)
-- 시트 "행최종수정일시" 열을 sync-sheet 가 읽어 상품별 최신 수정시각을 저장한다.
ALTER TABLE arrival_products ADD COLUMN IF NOT EXISTS sheet_edited_at TIMESTAMPTZ;
