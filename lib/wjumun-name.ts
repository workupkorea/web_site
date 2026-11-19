// W주문 상품명에서 품번·컬러·사이즈·제목을 분리한다. (입고스케쥴 팝업 / 개별 등록 공용)
export const normSize = (s: string) => s.replace(/^\d\((\w+)\)$/, "$1").replace(/^0{1,2}(?=[A-Za-z])/, "").replace(/^(\d+)N$/, "$1"); // 00S→S, 0XL→XL, 30N→30

export type ParsedWjumunName = { title: string; color: string; size: string; code: string };

// 품번처럼 보이는 토큰: 영문+숫자 혼합 6자 이상 (예: DEFWUJK01, MD6FUATL277)
const looksLikeCode = (t: string) => /^[A-Za-z0-9]{6,}$/.test(t) && /\d/.test(t) && /[A-Za-z]/.test(t);

export function parseWjumunName(name: string, code = ""): ParsedWjumunName {
  const clean = (s: string) => s.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  // ① 끝에 품번이 붙은 언더바 형식: "디월트_누르빅 퀄팅 재킷_BE_3XL_DEFWUJK01" → 제목_컬러_사이즈_품번
  const parts = name.split("_").map(s => s.trim());
  if (parts.length >= 4 && looksLikeCode(parts[parts.length - 1])) {
    const [codeP, sizeP, colorP] = [parts[parts.length - 1], parts[parts.length - 2], parts[parts.length - 3]];
    if (/^[A-Za-z0-9]{1,3}$/.test(colorP) && /^[A-Za-z0-9]{1,4}$/.test(sizeP)) {
      return { title: clean(parts.slice(0, -3).join(" ")), color: colorP, size: normSize(sizeP), code: codeP };
    }
  }

  // ② 품번이 앞에 붙은 언더바 형식: "GRBD GSGFUTS02_CG_4XL_소로나 웜 ..." → 컬러 CG, 사이즈 4XL
  // 이름 속 품번이 조회 품번과 달라도(예: VC6FUATL104 ↔ VWGFUTS04) 동작하도록 코드와 무관하게 매칭
  const m = name.match(/([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+(?:\([A-Za-z0-9]+\))?)_?(\S*)/);
  if (m && m.index !== undefined && looksLikeCode(m[1])) {
    const title = clean(name.slice(0, m.index) + m[4] + name.slice(m.index + m[0].length));
    return { title, color: m[2], size: normSize(m[3]), code: m[1] };
  }

  // ③ 공백 사이에 품번+컬러+사이즈가 붙은 형식: "매드독 MD6FUATL277GY0XL 피그먼트 …" → MD6FUATL277 / GY / XL
  const tokens = name.split(/\s+/);
  const ti = tokens.findIndex(t => /^[A-Za-z0-9]*\d[A-Za-z]{2}(?:\d{0,2}[A-Za-z]{1,3}|\d{2,3}N?)$/.test(t) && t.length >= 9);
  if (ti >= 0) {
    const mm = tokens[ti].match(/^([A-Za-z0-9]*\d)([A-Za-z]{2})(\d{0,2}[A-Za-z]{1,3}|\d{2,3}N?)$/)!;
    return { title: tokens.filter((_, i) => i !== ti).join(" "), color: mm[2], size: normSize(mm[3]), code: mm[1] };
  }

  // ⑤ 품번 없이 제목_컬러_사이즈(_사이즈…) 형식: "잭맨_DBN_45_295" → 제목 잭맨, 컬러 DBN, 사이즈 45/295 (품번은 직접 입력)
  if (parts.length >= 3 && /^[A-Za-z]{1,4}$/.test(parts[1]) && parts.slice(2).every(x => /^[\d.()A-Za-z]+$/.test(x))) {
    return { title: clean(parts[0]), color: parts[1], size: parts.slice(2).join("/"), code: "" };
  }

  // ④ 조회 품번으로 토큰을 찾는 기존 방식
  if (code) {
    const ci = tokens.findIndex(t => t.toUpperCase().startsWith(code.toUpperCase()));
    if (ci >= 0) {
      const suffix = tokens[ci].slice(code.length);
      return { title: tokens.filter((_, i) => i !== ci).join(" "), color: suffix.slice(0, 2), size: normSize(suffix.slice(2)), code };
    }
  }
  return { title: name, color: "", size: "", code };
}

// 우선순위: it_tag_code(품번11+컬러2+사이즈3, 형식 일정) → 없으면 상품명 해석
export function parseWjumunItem(item: { name: string; tagCode?: string }, queryCode = ""): ParsedWjumunName {
  const byName = parseWjumunName(item.name, queryCode);
  const t = (item.tagCode ?? "").trim();
  if (/^[A-Za-z0-9]{14,}$/.test(t)) {
    return { ...byName, code: t.slice(0, -5), color: t.slice(-5, -3), size: normSize(t.slice(-3)) };
  }
  return byName;
}
