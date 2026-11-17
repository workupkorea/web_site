// 사이즈 표기 정리 — 입고 스케쥴 값을 고객에게 보이는 형태로 바꾼다.
//  "00S~4XL" → "S - 4XL"  (앞의 00 제거, 구분 기호를 " - "로 통일)
//  "26N~38N" → "26 - 38"  (바지 사이즈 뒤의 N 제거)
export function cleanSizeLabel(size?: string): string {
  return (size ?? "")
    .replace(/\s*[~～\-–—]\s*/g, " - ")
    .replace(/(^| - )00(?=[A-Za-z])/g, "$1")
    .replace(/(\d)N(?=\s-|,|\s|$)/g, "$1")
    .trim();
}
