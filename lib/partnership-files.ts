// 제휴·입점 문의 첨부파일 공통 규칙 (클라이언트·서버 공용)
export const PARTNERSHIP_BUCKET = "partnership-files";
export const MAX_FILES = 5;                    // 문의 1건당 최대 개수
export const MAX_FILE_MB = 10;                 // 파일 1개당 최대 용량(MB)
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const MAX_TOTAL_MB = 30;                // 문의 1건당 총 용량(MB)
export const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;
export const RETENTION_MONTHS = 6;             // 보관 기간(개월)

export const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "hwp", "hwpx"] as const;
export const ACCEPT_ATTR = ALLOWED_EXT.map((e) => "." + e).join(",");

export type AttachedFile = { path: string; name: string; size: number; deleted?: boolean };

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** 파일 1개 검증 — 문제가 있으면 안내 문구, 없으면 null */
export function validateFileMeta(name: string, size: number): string | null {
  if (!(ALLOWED_EXT as readonly string[]).includes(extOf(name))) {
    return `'${name}'은(는) 첨부할 수 없는 형식입니다. (PDF·이미지·문서 파일만 가능)`;
  }
  if (size <= 0) return `'${name}' 파일이 비어 있습니다.`;
  if (size > MAX_FILE_BYTES) return `'${name}'은(는) ${MAX_FILE_MB}MB를 넘습니다.`;
  return null;
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + "MB";
  return Math.max(1, Math.round(bytes / 1024)) + "KB";
}

/** 문의 payload의 `_files`(JSON 문자열)를 안전하게 파싱 */
export function parseFiles(raw: unknown): AttachedFile[] {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(arr) ? arr.filter((f) => f && typeof f.path === "string") : [];
  } catch { return []; }
}
