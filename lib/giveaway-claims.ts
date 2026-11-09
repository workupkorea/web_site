// 이벤트 당첨자 배송 정보 수집 — 공용 타입·상수 (서버/클라이언트 공용)
//
// 흐름: 추첨 확정 → 관리자가 당첨자별 고유 링크 생성 → 당첨자가 /claim/<토큰> 에서 이름·연락처·주소·사이즈 입력
//       → 관리자가 추첨기에서 제출 현황 확인·CSV 내보내기. 데이터는 site_settings 의 "giveaway_claims_<이벤트ID>" 에 저장.

/** 마감일로부터 이 기간이 지나면 제출된 개인정보를 자동 파기한다 (접속 시점에 정리). */
export const CLAIM_RETENTION_DAYS = 90;

export interface ClaimSubmission {
  name: string;
  phone: string;
  addr1: string;
  addr2: string;
  size: string;
  /** 제출 시각 (ISO) */
  at: string;
}

export interface ClaimEntry {
  /** 추측할 수 없는 고유 토큰 (이 값이 곧 링크). 형식: <이벤트ID>-<무작위 16바이트 hex> */
  token: string;
  user: string;
  prize: string;
  label: string;
  submitted?: ClaimSubmission;
}

export interface ClaimDoc {
  eventId: string;
  eventName: string;
  /** 마감 시각 (ISO). 이후에는 제출할 수 없다. */
  deadline: string;
  /** 사이즈 선택지. 비어 있으면 사이즈 입력을 받지 않는다. */
  sizes: string[];
  createdAt: string;
  entries: ClaimEntry[];
}

/** 당첨자 한 명 (링크 발급 대상) */
export interface ClaimWinner {
  user: string;
  prize: string;
  label: string;
}

export const claimSection = (eventId: string) => `giveaway_claims_${eventId}`;
/** 당첨자 1명의 제출 내용 저장 행 (동시 제출 시 서로 덮어쓰지 않도록 이벤트 문서와 분리) */
export const subSection = (token: string) => `giveaway_claimsub_${token}`;
export const validEventId = (id: string) => /^[a-z0-9]{6,40}$/.test(id);
export const eventIdOfToken = (token: string) => token.split("-")[0] ?? "";
export const validToken = (token: string) => /^[a-z0-9]{6,40}-[a-f0-9]{32}$/.test(token);
