-- 공지 대표 썸네일이 세로형일 때 잘리지 않게 표시하기 위한 플래그
ALTER TABLE notices ADD COLUMN IF NOT EXISTS temp_image_portrait BOOLEAN NOT NULL DEFAULT FALSE;
