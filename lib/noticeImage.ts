// 공지 대표 썸네일 표준 비율 — 가로형 640×451 이미지가 대부분이라 이 비율로 보여준다.
export const NOTICE_COVER_ASPECT = "640 / 451";
export const NOTICE_COVER_RATIO = 451 / 640;

// 세로형으로 체크한 이미지는 박스 자체를 세로 비율로 바꿔 잘리지 않게 보여준다.
export const noticeCoverAspect = (portrait?: boolean) => (portrait ? "451 / 640" : NOTICE_COVER_ASPECT);
