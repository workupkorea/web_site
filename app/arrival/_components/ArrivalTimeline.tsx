"use client";

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ArrivalProduct, ArrivalStatus } from "@/lib/arrival";

// ─── 유틸 ────────────────────────────────────────────────────────────────────
const MONTH_KO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_KO   = ["일","월","화","수","목","금","토"];
const WEEKDAY_KO = ["월","화","수","목","금"]; // 캘린더 뷰: 토·일 제외
const DAY_EN   = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function parseDate(iso: string) {
  if (!iso?.trim()) return null;
  const d = new Date(iso.trim() + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(iso: string) {
  const d = parseDate(iso);
  if (!d) return { mm:"--", dd:"--", day:"--", dayKo:"", month:"--", full: iso };
  return {
    mm:    String(d.getMonth() + 1).padStart(2, "0"),
    dd:    String(d.getDate()).padStart(2, "0"),
    day:   DAY_EN[d.getDay()],
    dayKo: DAY_KO[d.getDay()],
    month: MONTH_KO[d.getMonth()],
    full:  `${d.getMonth()+1}/${d.getDate()}(${DAY_KO[d.getDay()]})`,
  };
}
const BRAND_BG: Record<string, string> = {
  "켄타":        "bg-[#5b73a3]",   // 로열 블루       hue 225
  "디트로잇":    "bg-[#9a5a5a]",   // 선명 레드       hue 0
  "GRBD":        "bg-[#4f8a68]",   // 선명 그린       hue 132
  "K-WORKERS":   "bg-[#7a6aa8]",   // 바이올렛        hue 264
  "케이워커스":  "bg-[#7a6aa8]",   // K-WORKERS 표시명
  "덴버":        "bg-[#9a5f84]",   // 마젠타/핫핑크   hue 330
  "디월트":      "bg-[#cbbd78]",   // 선명 옐로       hue 51
  "매드독캠프":  "bg-[#3f7468]",   // 다크 틸         hue 165
  "모디뜨":      "bg-[#a8708e]",   // 핑크            hue 335
  "몬스톤":      "bg-[#9db6d2]",   // 라이트 블루      hue 213
  "볼컴":        "bg-[#a8754a]",   // 선명 오렌지     hue 29
  "블랙스미스":  "bg-[#7d6247]",   // 브라운          hue 30 (dark)
  "블랙아머":    "bg-[#4a4c5e]",   // 다크 네이비     near black
  "유니보스":    "bg-[#4f8a94]",   // 아쿠아/시안     hue 186
  "이글서플라이":"bg-[#c1a86a]",   // 앰버/골드       hue 43
  "프레파라트":  "bg-[#8aa05a]",   // 라임 그린       hue 81
};

const BRAND_BG_HEX: Record<string, string> = {
  "켄타":        "#5b73a3",
  "디트로잇":    "#9a5a5a",
  "GRBD":        "#4f8a68",
  "K-WORKERS":   "#7a6aa8",
  "케이워커스":  "#7a6aa8",
  "덴버":        "#9a5f84",
  "디월트":      "#cbbd78",
  "매드독캠프":  "#3f7468",
  "모디뜨":      "#a8708e",
  "몬스톤":      "#9db6d2",
  "볼컴":        "#a8754a",
  "블랙스미스":  "#7d6247",
  "블랙아머":    "#4a4c5e",
  "유니보스":    "#4f8a94",
  "이글서플라이":"#c1a86a",
  "프레파라트":  "#8aa05a",
};

function brandBg(brand: string) {
  return BRAND_BG[brand] ?? "bg-[#edebe8]";
}
function brandBgHex(brand: string) {
  return BRAND_BG_HEX[brand] ?? "#edebe8";
}
// 밝은 배경색(노란색 계열)은 어두운 텍스트 사용
const LIGHT_BRANDS = new Set(["디월트", "프레파라트", "이글서플라이", "몬스톤"]);
function brandTextCls(brand: string) {
  return LIGHT_BRANDS.has(brand) ? "text-[#1a1a1a]" : "text-white";
}
function brandTextColor(brand: string) {
  return LIGHT_BRANDS.has(brand) ? "#1a1a1a" : "#fff";
}

function stripBrand(name: string, brand: string) {
  if (!brand) return name;
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 표시명(케이워커스)과 원본 상품명 접두(K-WORKERS_)가 달라 둘 다 제거 대상으로 본다
  const names = brand === "케이워커스" ? [brand, "K-WORKERS"] : [brand];
  const prefix = new RegExp(`^(?:${names.map(esc).join("|")})[_\\s]+`, "i");
  const noBrand = name.replace(prefix, "").trim() || name;
  // 제품명 앞의 영문 업체 코드("DVT077_", "GSGSUTS02_")는 언더바까지 비노출
  return noBrand.replace(/^[A-Za-z0-9-]+_+/, "").trim() || noBrand;
}

function fmtPrice(n: number) {
  return n > 0 ? n.toLocaleString("ko-KR") + "원" : "—";
}
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
// 오늘이 속한 주의 월~금 범위 (주말 제외, 캘린더 뷰와 동일한 기준)
function getThisWeekRange(today: Date) {
  const day = today.getDay(); // 0=일 ~ 6=토
  // 일요일 00:00부터 다음 주(월~금)로 전환 (토요일까지는 해당 주 유지)
  const mondayOffset = day === 0 ? 1 : 1 - day;
  const monday = new Date(today); monday.setDate(today.getDate() + mondayOffset);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  return { start: toIsoDate(monday), end: toIsoDate(friday), startFmt: fmtDate(toIsoDate(monday)).full, endFmt: fmtDate(toIsoDate(friday)).full };
}
// "10월 셋째주" 형태의 주차 라벨. 표시 중인 주(월~금)의 목요일 기준으로 월/주차를 정하고,
// 주는 일요일 시작(그 달 1일이 속한 주 = 첫째주)으로 센다.
const WEEK_ORDINALS = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];
function getWeekLabel(mondayIso: string) {
  const monday = parseDate(mondayIso);
  if (!monday) return "";
  const thu = new Date(monday); thu.setDate(monday.getDate() + 3);
  const firstDow = new Date(thu.getFullYear(), thu.getMonth(), 1).getDay();
  const week = Math.ceil((thu.getDate() + firstDow) / 7);
  return `${thu.getMonth() + 1}월 ${WEEK_ORDINALS[week - 1] ?? ""}주`;
}
// 관리자 등급: "관리자" 또는 "S관리자" (lib/admin-auth.ts 와 동일 기준 — 서버 전용이라 클라이언트에 별도 정의)
const isAdminGrade = (grade?: string) => grade === "관리자" || grade === "S관리자";
function isInWeekRange(iso: string | undefined, range: { start: string; end: string }) {
  if (!iso) return false;
  return iso >= range.start && iso <= range.end;
}
function toMonthKey(iso: string) {
  const d = parseDate(iso);
  if (!d) return "미정";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthKeyLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y}년 ${MONTH_KO[parseInt(m)-1]}`;
}
function monthKeyLabelShort(key: string) {
  const [y, m] = key.split("-");
  return `${String(y).slice(2)}.${parseInt(m)}월`;
}

const STATUS_META: Record<ArrivalStatus, { label: string; cls: string }> = {
  입고완료:   { label: "완료",      cls: "bg-gray-200 text-gray-600" },
  입고예정:   { label: "예정",      cls: "bg-[#1a1a1a] text-white"  },
  입고지연:   { label: "지연",      cls: "bg-amber-100 text-amber-800" },
  일정미정:   { label: "미정",      cls: "bg-gray-200 text-gray-600" },
  대기:       { label: "대기",      cls: "bg-blue-50 text-blue-600" },
  일정미표기: { label: "일정미정",   cls: "bg-gray-100 text-gray-500" },
};

// ─── 이미지 파싱 ─────────────────────────────────────────────────────────────
function parseImages(product: ArrivalProduct): string[] {
  if (!product.image) return [];
  return product.image.split(",").map(s => s.trim()).filter(Boolean);
}

// ─── 이미지 플레이스홀더 ──────────────────────────────────────────────────────
function ProductImage({ product, size = "md" }: { product: ArrivalProduct; size?: "sm" | "md" }) {
  const imgs = parseImages(product);
  const src = imgs[0] ?? `/images/arrival/${product.productCode}.jpg`;
  const [failed, setFailed] = useState(imgs.length === 0);
  const aspectCls = "aspect-[3/4]";
  if (failed) {
    return (
      <div className={`w-full ${aspectCls} bg-white flex flex-col items-center justify-center gap-1`}>
        <span className="text-[12px] tracking-widest text-gray-500 font-mono uppercase">{product.productCode}</span>
        <div className="w-6 h-px bg-gray-300" />
        <span className="text-[12px] text-gray-400">이미지 준비중입니다</span>
      </div>
    );
  }
  return (
    <img src={src} alt={product.productName}
      className={`w-full ${aspectCls} object-contain bg-white`}
      loading="lazy" decoding="async"
      onError={() => setFailed(true)} />
  );
}

// ─── 이미지 갤러리 (모달용) ───────────────────────────────────────────────────
function ImageGallery({ product, aspectCls = "aspect-[3/4]" }: { product: ArrivalProduct; aspectCls?: string }) {
  const customImages = parseImages(product);
  const fallback = `/images/arrival/${product.productCode}.jpg`;
  const images = customImages.length > 0 ? customImages : [fallback];

  const [index, setIndex] = useState(0);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());

  const markFailed = (i: number) => setFailedSet(prev => new Set(prev).add(i));
  const allFailed  = images.every((_, i) => failedSet.has(i));

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIndex(i => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIndex(i => (i + 1) % images.length); };

  if (allFailed) {
    return (
      <div className={`w-full ${aspectCls} bg-white flex flex-col items-center justify-center gap-1 rounded-sm`}>
        <span className="text-[12px] tracking-widest text-gray-500 font-mono uppercase">{product.productCode}</span>
        <div className="w-6 h-px bg-gray-300" />
        <span className="text-[12px] text-gray-400">이미지 준비중입니다</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 메인 이미지 + 양쪽 화살표 */}
      <div className="flex items-center gap-2">
        {/* 왼쪽 화살표 (이미지 바깥) */}
        {images.length > 1 ? (
          <button onClick={prev}
            className="shrink-0 w-9 h-9 bg-white border border-gray-200 hover:border-gray-400 rounded-full flex items-center justify-center text-[23px] text-gray-600 hover:text-[#1a1a1a] shadow-sm transition-all">
            ‹
          </button>
        ) : (
          <div className="shrink-0 w-9" />
        )}

        {/* 이미지 */}
        <div className={`relative flex-1 ${aspectCls} overflow-hidden rounded-sm bg-white`}>
          {!failedSet.has(index) && (
            <img
              key={images[index]}
              src={images[index]}
              alt={`${product.productName} ${index + 1}`}
              className="w-full h-full object-contain"
              decoding="async"
              onError={() => markFailed(index)}
            />
          )}
          {/* 다음 장 미리 받기 */}
          {images.length > 1 && (
            <img src={images[(index + 1) % images.length]} alt="" aria-hidden className="hidden" />
          )}
          {images.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/40 text-white text-[13px] font-semibold px-2 py-0.5 rounded-full">
              {index + 1} / {images.length}
            </div>
          )}
        </div>

        {/* 오른쪽 화살표 (이미지 바깥) */}
        {images.length > 1 ? (
          <button onClick={next}
            className="shrink-0 w-9 h-9 bg-white border border-gray-200 hover:border-gray-400 rounded-full flex items-center justify-center text-[23px] text-gray-600 hover:text-[#1a1a1a] shadow-sm transition-all">
            ›
          </button>
        ) : (
          <div className="shrink-0 w-9" />
        )}
      </div>

      {/* 썸네일 스트립 */}
      {images.length > 1 && (
        <div className="px-11">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full pb-1.5 pt-0.5 pl-0.5">
            {images.map((src, i) => (
              <button key={i} onClick={() => setIndex(i)}
                className={`shrink-0 w-14 h-14 rounded transition-all ${i === index ? "ring-2 ring-[#1a1a1a]" : "opacity-45 hover:opacity-75"}`}>
                <div className="w-full h-full overflow-hidden rounded">
                  {!failedSet.has(i) && (
                    <img src={src} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" onError={() => markFailed(i)} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 상품 상세 모달 ───────────────────────────────────────────────────────────
/** 사이즈 표기 간소화: "00M~4XL" → "M-4XL", 바지 "30N~38N" → "30-38" (표시 전용, 원본 데이터는 그대로) */
function fmtSize(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/\s+/g, "")
    .replace(/~/g, "-")
    .replace(/(^|-)0{1,2}(?=[A-Za-z])/g, "$1") // 앞쪽 "0"/"00" 접두 제거 (00S → S, 0XL → XL)
    .replace(/(\d+)N(?![A-Za-z])/g, "$1"); // 숫자 뒤 N 제거 (30N → 30)
}

function ProductModal({ product, onClose, openOrderLink, isAdmin }: { product: ArrivalProduct; onClose: () => void; openOrderLink: (url: string, e: React.MouseEvent) => void; isAdmin?: boolean }) {
  const { full } = fmtDate(product.arrivalDate);
  const meta = STATUS_META[product.status] ?? STATUS_META["입고예정"];
  const history = product.changeHistory ?? [];
  const [copied, setCopied] = useState(false);

  // 모바일 스와이프 다운으로 닫기
  const startY = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - startY.current > 80) onClose();
  };

  function handleShare() {
    const url = `${window.location.origin}/arrival?product=${product.productCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
      <div
        className="bg-white w-full max-w-[1025px] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* 닫기 버튼 (최소형, 오른쪽 상단) */}
        <div className="flex justify-end px-2 pt-1 pb-0 sm:px-3 sm:pt-2 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              title="링크 공유"
              className="hidden sm:flex items-center gap-1 text-[13px] font-semibold text-gray-400 hover:text-[#1a1a1a] transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
            >
              {copied ? <span className="text-green-600">복사됨</span> : <span>공유</span>}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-[23px] leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-0 sm:items-start">
            {/* 이미지 영역 */}
            <div className="w-full sm:w-[520px] shrink-0">
              <div className="relative px-3 pt-1 pb-1 sm:px-4 sm:pt-4 sm:pb-4">
                <ImageGallery product={product} aspectCls="aspect-square sm:aspect-[3/4]" />
                {isAdmin && product.marketingUsage && (
                  <span className="sm:hidden absolute top-4 left-6 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-[12px] font-bold rounded-full shadow">
                    마케팅
                  </span>
                )}
              </div>
            </div>

            {/* 정보 영역 */}
            <div className="flex-1 flex flex-col gap-1.5 sm:gap-3 px-3 sm:px-4 sm:pr-6 pb-3 sm:pb-6 pt-0.5 sm:pt-4 min-w-0 sm:border-l sm:border-gray-100">

            {/* ── PC 레이아웃 (sm: 이상) ── */}
            <div className="hidden sm:block">
              <p className="text-[13px] tracking-[0.2em] text-gray-400 uppercase font-semibold mb-1">{product.brand}</p>
              <h2 className="text-[26px] font-bold text-[#1a1a1a] leading-normal mb-4">{stripBrand(product.productName, product.brand)}</h2>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap w-24 align-middle">상태</td>
                    <td className="py-2.5 align-middle"><span className={`inline-block text-[14px] px-2.5 py-1 rounded-full font-bold ${meta.cls}`}>{meta.label}</span></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">코드</td>
                    <td className="py-2.5 font-mono text-[15px] text-[#1a1a1a] align-middle">{product.productCode}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">카테고리</td>
                    <td className="py-2.5 text-[15px] text-[#1a1a1a] align-middle">{product.category || "—"}</td>
                  </tr>
                  {product.newArrivalType && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">신상구분</td>
                      <td className="py-2.5 text-[15px] text-[#1a1a1a] align-middle">{product.newArrivalType}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">컬러</td>
                    <td className="py-2.5 text-[15px] text-[#1a1a1a] align-middle">{product.color || "—"}</td>
                  </tr>
                  {product.size && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">사이즈</td>
                      <td className="py-2.5 text-[15px] text-[#1a1a1a] align-middle">{fmtSize(product.size)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">판매가</td>
                    <td className="py-2.5 text-[15px] font-bold text-[#1a1a1a] align-middle">{product.price > 0 ? fmtPrice(product.price) : "—"}</td>
                  </tr>
                  {isAdmin && (
                    <tr className="border-b border-gray-100 bg-orange-50/40">
                      <td className="py-2.5 pr-4 text-[13px] tracking-widest text-orange-400 uppercase font-semibold whitespace-nowrap align-middle">원가</td>
                      <td className="py-2.5 text-[15px] font-bold text-orange-700 align-middle">{product.costPrice && product.costPrice > 0 ? fmtPrice(product.costPrice) : "—"}</td>
                    </tr>
                  )}
                  {isAdmin && (
                    <tr className="border-b border-gray-100 bg-orange-50/40">
                      <td className="py-2.5 pr-4 text-[13px] tracking-widest text-orange-400 uppercase font-semibold whitespace-nowrap align-middle">공급가</td>
                      <td className="py-2.5 text-[15px] font-bold text-orange-700 align-middle">{product.supplyPrice && product.supplyPrice > 0 ? fmtPrice(product.supplyPrice) : "—"}</td>
                    </tr>
                  )}
                  <tr className="last:border-0">
                    <td className="py-2.5 pr-4 text-[13px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">입고일</td>
                    <td className="py-2.5 text-[15px] text-[#1a1a1a] align-middle">{full}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── 모바일 레이아웃 (sm: 미만) ── */}
            <div className="sm:hidden">
              <h2 className="text-[18px] font-bold text-[#1a1a1a] leading-normal mb-1.5">{stripBrand(product.productName, product.brand)}</h2>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap w-[72px] align-middle">브랜드/코드</td>
                    <td className="py-1 text-[13px] text-[#1a1a1a] align-middle">
                      <span className="font-semibold">{product.brand}</span>
                      {product.productCode && <span className="text-gray-300 mx-1">|</span>}
                      <span className="font-mono text-gray-500">{product.productCode}</span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">상태</td>
                    <td className="py-1 text-[13px] align-middle">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#1a1a1a]">{full}</span>
                        <span className={`inline-block text-[12px] px-1.5 py-0.5 rounded-full font-bold ${meta.cls}`}>{meta.label}</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">카테고리</td>
                    <td className="py-1 text-[13px] text-[#1a1a1a] align-middle">{product.category || "—"}</td>
                  </tr>
                  {(product.productType || product.newArrivalType) && (
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">구분</td>
                      <td className="py-1 text-[13px] text-[#1a1a1a] align-middle">{[product.productType, product.newArrivalType].filter(Boolean).join(" / ")}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">컬러</td>
                    <td className="py-1 text-[13px] text-[#1a1a1a] align-middle">{product.color || "—"}</td>
                  </tr>
                  {product.size && (
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">사이즈</td>
                      <td className="py-1 text-[13px] text-[#1a1a1a] align-middle">{fmtSize(product.size)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[12px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">판매가</td>
                    <td className="py-1 text-[13px] text-[#1a1a1a] align-middle font-bold">{product.price > 0 ? fmtPrice(product.price) : "—"}</td>
                  </tr>
                  {isAdmin && (
                    <tr className="border-b border-gray-100 bg-orange-50/40">
                      <td className="py-1 pr-3 text-[12px] tracking-widest text-orange-400 uppercase font-semibold whitespace-nowrap align-middle">원가</td>
                      <td className="py-1 text-[13px] text-orange-700 align-middle font-bold">{product.costPrice && product.costPrice > 0 ? fmtPrice(product.costPrice) : "—"}</td>
                    </tr>
                  )}
                  {isAdmin && (
                    <tr className="border-b border-gray-100 bg-orange-50/40">
                      <td className="py-1 pr-3 text-[12px] tracking-widest text-orange-400 uppercase font-semibold whitespace-nowrap align-middle">공급가</td>
                      <td className="py-1 text-[13px] text-orange-700 align-middle font-bold">{product.supplyPrice && product.supplyPrice > 0 ? fmtPrice(product.supplyPrice) : "—"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {isAdmin && product.marketingUsage && (
              <div className="hidden sm:block border border-orange-300 bg-orange-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] tracking-widest text-orange-400 uppercase font-bold shrink-0">마케팅</span>
                  <span className="text-[15px] text-orange-700 font-semibold">{product.marketingUsage}</span>
                </div>
              </div>
            )}

            {product.description && (
              <div>
                <p className="text-[13px] tracking-widest text-gray-400 uppercase font-semibold mb-2">설명</p>
                <p className="text-[15px] text-gray-700 leading-loose whitespace-pre-line">
                  {product.description.replace(/\\n/g, "\n")}
                </p>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <p className="text-[13px] tracking-widest text-gray-400 uppercase font-semibold mb-2">변경 이력</p>
                <div className="space-y-2">
                  {history.slice().reverse().map((h, i) => (
                    <div key={i} className="text-[15px] bg-gray-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="line-through">{h.previousDate}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-[#1a1a1a]">{h.newDate}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{h.reason}</p>
                      <p className="text-[13px] text-gray-400 mt-1">{new Date(h.changedAt).toLocaleString("ko-KR")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type ViewMode  = "grid" | "calendar" | "timeline" | "gantt";
// 사이즈 문자열("S/M/L", "95,100,105" 등)을 낱개 사이즈로 분리
// 필터용 낱개 사이즈. 표기 간소화와 동일하게 정규화: 00S→S, 0XL→XL, 00F→F, 26N→26
function splitSizes(size?: string | null): string[] {
  return (size ?? "").split(/[\s,/|·~\-]+/)
    .map(t => t.trim().toUpperCase().replace(/^0{1,2}(?=[A-Z])/, "").replace(/^(\d+)N$/, "$1"))
    .filter(Boolean);
}
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "FREE", "F"];
// 알파벳 사이즈는 S→XL 순, 숫자 사이즈는 오름차순, 그 외는 가나다순
function compareSize(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  if (!isNaN(na)) return -1;
  if (!isNaN(nb)) return 1;
  return a.localeCompare(b);
}

type GroupMode = "date" | "month" | "category" | "brand";
/** 판매량/주문량 정렬 시 모든 제품을 한 그룹으로 모을 때 쓰는 내부 키 */
const SORTED_GROUP_KEY = "__sorted__";

// ─── 상품 카드 (그리드용) ─────────────────────────────────────────────────────
// 이미지·타임라인·캘린더 뷰가 같은 가로폭을 쓰도록 상단 바와 본문이 공유하는 좌우 여백
const PAGE_X_PAD = "px-3 sm:px-5";

// 관리자 전용: 주문율·판매율(시트 값)·재고수량 표기. inline이면 PC(sm+)에서 한 줄로, 모바일은 줄 나눔
function RateLine({ product, inline }: { product: ArrivalProduct; inline?: boolean }) {
  const o = orderRateOf(product);
  const s = salesRateOf(product);
  const stock = product.stockQuantity;
  if (o == null && s == null && stock == null) return null;
  const sep = <span className="hidden sm:inline mx-1 text-gray-300">|</span>;
  const txt = "text-[12px] text-gray-500 whitespace-nowrap tabular-nums";
  return (
    <div className={inline ? "flex flex-col items-end sm:flex-row sm:items-center sm:justify-end" : "flex flex-col"}>
      {(o != null || s != null) && (
        <p className={txt}>
          주문 <span className="font-bold text-blue-600">{o != null ? `${o}%` : "—"}</span>
          <span className="mx-1 text-gray-300">|</span>
          판매 <span className="font-bold text-green-600">{s != null ? `${s}%` : "—"}</span>
        </p>
      )}
      {stock != null && (
        <>
          {inline && (o != null || s != null) && sep}
          <p className={txt}>
            재고 <span className="font-bold text-[#1a1a1a]">{stock.toLocaleString("ko-KR")}</span>
          </p>
        </>
      )}
    </div>
  );
}

// 마케팅 체크 시 이미지 하단에 얹는 용도 뱃지 (관리자 전용 — 호출 측에서 showMarketing으로 게이트)
function MarketingBadge({ usage, lifted }: { usage?: string; lifted?: boolean }) {
  if (!usage) return null;
  return (
    <span className={`absolute ${lifted ? "bottom-[22px]" : "bottom-1"} left-1 right-1 z-10 max-w-[calc(100%-8px)] truncate rounded bg-blue-500/95 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm w-fit`} title={usage}>
      {usage}
    </span>
  );
}
/** 현재 목록 전체 기준 주문량·판매량 순위 (관리자 이미지 뷰 전용) */
type SalesRank = { order?: number; sales?: number; total: number };
const rankKey = (p: ArrivalProduct) => `${p.productCode}__${p.arrivalDate || "none"}`;

/** 초도 입고일 기준 경과일 라벨: 입고 후 D+92, 입고 전 D-3, 당일 D+0 (날짜 없으면 빈 값) */
function daysSinceLabel(arrivalDate?: string | null): string {
  const d = arrivalDate ? parseDate(arrivalDate) : null;
  if (!d) return "";
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((t.getTime() - a.getTime()) / 86400000);
  return diff >= 0 ? `D+${diff}` : `D${diff}`;
}

function ProductCard({ product, onSelect, showDate, showMarketing, showRates, rank, qtyMode }: { product: ArrivalProduct; onSelect: () => void; showDate?: boolean; showMarketing?: boolean; showRates?: boolean; rank?: SalesRank; qtyMode?: boolean }) {
  const meta = STATUS_META[product.status] ?? STATUS_META["입고예정"];
  const { full } = fmtDate(product.arrivalDate);
  const dLabel = daysSinceLabel(product.arrivalDate);
  return (
    <button onClick={onSelect}
      className="text-left transition-opacity hover:opacity-80 flex flex-col">
      <div className={`relative w-full overflow-hidden rounded-sm border ${showMarketing && product.marketingUsage ? "border-blue-500 border-2" : "border-[#979797]"}`}>
        <ProductImage product={product} size="sm" />
        {/* 우측 상단: 주문(파랑)·판매(초록) 순위 (관리자) */}
        {/* 좌측 상단(이미지 안): 초도 입고 경과일 + 입고일 (관리자) */}
        {showRates && (dLabel || product.arrivalDate) && (
          <div className="absolute top-1.5 left-1.5 z-10 flex flex-col items-start gap-1 tabular-nums">
            {dLabel && <span className="rounded-md bg-gray-900/80 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm" title="초도 입고일 기준 경과일">{dLabel}</span>}
            {product.arrivalDate && <span className="rounded-md bg-white/85 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-gray-700 shadow-sm">{full}</span>}
          </div>
        )}
        {rank && (
          <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-1 tabular-nums">
            {rank.order !== undefined && <span className="flex items-center gap-1 rounded-md bg-blue-600/90 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm" title={`주문량 ${rank.order}위`}><span className="opacity-70">O</span>{rank.order}</span>}
            {rank.sales !== undefined && <span className="flex items-center gap-1 rounded-md bg-green-600/90 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm" title={`판매량 ${rank.sales}위`}><span className="opacity-70">S</span>{rank.sales}</span>}
          </div>
        )}
        {product.newArrivalType === "재진행" && (
          <span
            className={`absolute ${showRates && (dLabel || product.arrivalDate) ? "top-12" : "top-1.5"} left-1.5 w-5 h-5 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[12px] font-bold flex items-center justify-center leading-none shadow`}
            title="재진행 상품"
          >
            R
          </span>
        )}
        {showMarketing && <MarketingBadge usage={product.marketingUsage} lifted={showRates} />}
      </div>
      {/* 관리자 전용: 이미지 하단 경계에 걸치는 정보 바 — 위쪽 일부만 사진과 겹치고 나머지는 사진 바깥으로 (원가·판매가 / 주문율·판매율·재고) */}
      {showRates && (() => {
        const o = orderRateOf(product);
        const sr = salesRateOf(product);
        const stock = product.stockQuantity;
        const dash = "—";
        const num = (n?: number | null) => (n != null && n > 0 ? n.toLocaleString("ko-KR") : dash);
        return (
          <div className="relative z-10 -mt-4 mx-1.5 rounded-md border border-gray-200 bg-white/95 px-2.5 py-1.5 text-[11px] leading-tight tabular-nums shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">원가 <b className="font-semibold text-gray-700">{num(product.costPrice)}</b></span>
              <span className="text-gray-500">판매가 <b className="text-[12px] font-bold text-[#1a1a1a]">{num(product.price)}</b></span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1">
              {/* 판매량순·주문량순 정렬 중에는 비율(%) 대신 주문·판매 수량을 표기 */}
              <span className="text-gray-500">주문 <b className="font-bold text-blue-600">{qtyMode ? num(product.orderQuantity) : o != null ? `${o}%` : dash}</b></span>
              <span className="text-gray-500">판매 <b className="font-bold text-green-600">{qtyMode ? num(product.salesQuantity) : sr != null ? `${sr}%` : dash}</b></span>
              <span className="text-gray-500">재고 <b className="font-bold text-[#1a1a1a]">{stock != null ? stock.toLocaleString("ko-KR") : dash}</b></span>
            </div>
          </div>
        );
      })()}
      <div className="pt-2 flex flex-col gap-0.5 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-[13px] tracking-wider text-gray-500 uppercase truncate font-medium shrink-0 max-w-[50%]">{product.brand}</span>
            <span className="text-[11px] text-gray-400 font-mono truncate">{product.productCode}</span>
          </span>
          <span className={`text-[12px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${meta.cls}`}>{meta.label}</span>
        </div>
        {/* 제품명이 길면 줄바꿈 대신 글자 크기를 줄여 한 줄에 맞춤 */}
        <FitName name={stripBrand(product.productName, product.brand)} align="left" compact />
        {(() => {
          // 사이즈 · 컬러를 한 줄로 ("카키,블랙" → "카키, 블랙")
          const colorTxt = (product.color || "").split(",").map(c => c.trim()).filter(Boolean).join(", ");
          const line = [fmtSize(product.size), colorTxt].filter(Boolean).join(" · ");
          return line ? <p className="text-[12px] text-gray-500 leading-tight truncate" title={line}>{line}</p> : null;
        })()}
        <div className="flex-1" />
        {showRates ? null : showDate && product.arrivalDate ? (
          <div className="text-[13px] text-gray-600 flex items-center justify-between gap-1 mt-auto">
            <span className="truncate">{full}</span>
            {!showRates && product.price > 0 && <span className="font-medium text-[#1a1a1a] whitespace-nowrap shrink-0">{fmtPrice(product.price)}</span>}
          </div>
        ) : (
          !showRates && <p className="text-[13px] text-gray-600 font-medium text-right mt-auto">{fmtPrice(product.price)}</p>
        )}
      </div>
    </button>
  );
}

const GRID_COLS = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3";

// ─── 브랜드 카탈로그 URL 매핑 ────────────────────────────────────────────────
const BRAND_CATALOG_SLUGS: Record<string, string> = {
  "켄타":      "kenta",
  "블랙아머":  "black-armor",
  "블랙스미스":"black-smith",
  "덴버":      "denver",
  "디트로잇":  "detroit",
  "디월트":    "dewalt",
  "이글서플라이": "eagle-supply",
  "GRBD":      "grbd",
  "K-WORKERS": "k-workers",
  "케이워커스": "k-workers",
  "매드독캠프":"maddog",
  "몬스톤":    "monston",
  "유니보스":  "uniboss",
  "볼컴":      "volcom",
};

function getBrandCatalogUrl(brand: string): string | null {
  const slug = BRAND_CATALOG_SLUGS[brand];
  return slug ? `/brands/${slug}/catalog` : null;
}

function BrandCatalogLink({ brand }: { brand: string }) {
  const url = getBrandCatalogUrl(brand);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-[13px] text-[#1a1a1a] bg-gray-100 hover:bg-[#1a1a1a] hover:text-white border border-gray-300 hover:border-[#1a1a1a] rounded-md px-3 py-1 transition-all ml-2 font-semibold shrink-0"
      title={`${brand} 카탈로그 보기`}
    >
      카탈로그
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  );
}

// ─── 그룹 헤더 ───────────────────────────────────────────────────────────────
function GroupHeader({ groupKey, groupMode, count, sortLabel }: { groupKey: string; groupMode: GroupMode; count: number; sortLabel?: string }) {
  if (groupKey === SORTED_GROUP_KEY) {
    return (
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-[21px] font-black text-[#1a1a1a] tracking-tight leading-none">전체 {sortLabel}</span>
        <span className="text-[14px] text-gray-500 font-medium">{count}개</span>
      </div>
    );
  }
  if (groupMode === "date") {
    const { mm, dd, day, month } = fmtDate(groupKey);
    return (
      <div className="flex items-baseline gap-3 mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[23px] font-black text-[#1a1a1a] tracking-tighter leading-none">{mm}.{dd}</span>
          <span className="text-[14px] tracking-[0.12em] text-gray-600 uppercase font-semibold">{day}</span>
          <span className="text-[14px] text-gray-500">{month}</span>
        </div>
        <span className="text-[14px] text-gray-500 font-medium">{count}개</span>
      </div>
    );
  }
  if (groupMode === "month") {
    const label = groupKey === "미정" ? "일정 미정" : monthKeyLabel(groupKey);
    return (
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-[21px] font-black text-[#1a1a1a] tracking-tight leading-none">{label}</span>
        <span className="text-[14px] text-gray-500 font-medium">{count}개</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[19px] font-black text-[#1a1a1a] tracking-tight leading-none uppercase">{groupKey || "미분류"}</span>
      {groupMode === "brand" && groupKey && groupKey !== "미분류" && <BrandCatalogLink brand={groupKey} />}
      <span className="text-[14px] text-gray-500 font-medium ml-auto">{count}개</span>
    </div>
  );
}

// ─── 그리드 뷰 ───────────────────────────────────────────────────────────────
function GridView({ grouped, groupMode, onSelect, showMarketing, showRates, ranks, sortLabel, qtyMode }: {
  grouped: [string, ArrivalProduct[]][]; groupMode: GroupMode; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean; showRates?: boolean;
  ranks?: Map<string, SalesRank>; sortLabel?: string; qtyMode?: boolean;
}) {
  const collapsible = (groupMode === "category" || groupMode === "brand") && !grouped.some(([k]) => k === SORTED_GROUP_KEY);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div>
      {grouped.map(([key, items]) => {
        const isCollapsed = collapsible && collapsed.has(key);
        return (
          <div key={key} id={`group-${key}`} className="border-t border-gray-100 pt-6 pb-10">
            {collapsible ? (
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => toggle(key)} className="flex items-center gap-3 group text-left flex-1 min-w-0">
                  <span className="text-[19px] font-black text-[#1a1a1a] tracking-tight leading-none uppercase">{key || "미분류"}</span>
                  <span className="text-[14px] text-gray-500 font-medium">{items.length}개</span>
                  <span className="text-[13px] text-gray-400 group-hover:text-gray-600">{isCollapsed ? "▼ 펼치기" : "▲ 접기"}</span>
                </button>
                {groupMode === "brand" && key && key !== "미분류" && <BrandCatalogLink brand={key} />}
              </div>
            ) : (
              <GroupHeader groupKey={key} groupMode={groupMode} count={items.length} sortLabel={sortLabel} />
            )}
            {!isCollapsed && (
              <div className={GRID_COLS}>
                {items.map((p, i) => <ProductCard key={`${p.productCode}_${p.arrivalDate || "none"}_${i}`} product={p} onSelect={() => onSelect(p)} showDate={groupMode !== "date"} showMarketing={showMarketing} showRates={showRates} rank={ranks?.get(rankKey(p))} qtyMode={qtyMode} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ─── 한 줄 맞춤 제품명: 브랜드 배지 + 제품명이 한 줄에 들어가도록 글자 크기를 자동 축소 ─────
const FIT_MAX_PX = 14;
const FIT_MIN_PX = 9;
function FitName({ name, reorder, align = "center", compact }: { name: string; reorder?: boolean; align?: "center" | "left"; compact?: boolean }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FIT_MAX_PX);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const fit = () => {
      const text = row.querySelector<HTMLElement>("[data-fit-text]");
      if (!text) return;
      let px = FIT_MAX_PX;
      text.style.fontSize = `${px}px`;
      while (row.scrollWidth > row.clientWidth && px > FIT_MIN_PX) {
        px -= 0.5;
        text.style.fontSize = `${px}px`;
      }
      setSize(px);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, [name]);

  return (
    <div ref={rowRef} className={`relative flex items-center ${align === "left" ? "justify-start" : "justify-center"} gap-1.5 whitespace-nowrap overflow-hidden ${compact ? "h-5" : "h-8"} ${reorder ? "px-8" : align === "left" ? "px-0" : "px-1.5"}`}>
      <span data-fit-text className="font-semibold text-[#1a1a1a]" style={{ fontSize: size, lineHeight: 1.2 }}>{name}</span>
      {reorder && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[13px] font-bold flex items-center justify-center leading-none shadow" title="재입고 상품">R</span>
      )}
    </div>
  );
}

// ─── 캘린더 셀 미니 썸네일 ──────────────────────────────────────────────────
function MiniThumb({ product, fit = "cover" }: { product: ArrivalProduct; fit?: "cover" | "contain" }) {
  const images = parseImages(product);
  const src = images[0] ?? (product.image ? product.image : null);
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center px-1">
        <span className="text-[9px] text-gray-400 text-center leading-tight">이미지 준비중입니다</span>
      </div>
    );
  }
  return (
    <img src={src} alt={product.productName}
      className={`absolute inset-0 w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
      loading="lazy" decoding="async"
      onError={() => setFailed(true)} />
  );
}

// ─── PDF 생성 ─────────────────────────────────────────────────────────────────
// A4 가로 기준 높이 추정값 (mm)
const PDF_COL_W_MM   = 281 / 7;          // 열 너비 ≈ 40mm
const PDF_IMG_MM     = 40;               // 이미지 고정 높이 (CSS .pi-img height와 동일)
const PDF_PRODUCT_MM = PDF_IMG_MM + 22;  // 이미지 40mm + 텍스트·여유 22mm = 62mm
const PDF_THEAD_MM   = 20;                // 월 제목 + 요일 헤더
const PDF_PAGE_MM    = 210 - 12;          // A4 가로 사용 가능 높이 (상하 마진 6mm×2)
const PDF_CONTENT_MM = PDF_PAGE_MM - PDF_THEAD_MM; // 178mm

function pdfWeekHeightMM(
  week: (number | null)[],
  dateMap: Map<string, ArrivalProduct[]>,
  year: number,
  month: number
): number {
  let max = 0;
  for (const day of week) {
    if (!day) continue;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cnt = dateMap.get(key)?.length ?? 0;
    if (cnt > max) max = cnt;
  }
  return Math.max(max * PDF_PRODUCT_MM + 4, 14);
}

function buildCalendarPDF(
  products: ArrivalProduct[],
  dateMap: Map<string, ArrivalProduct[]>,
  months: { year: number; month: number }[],
  allDates: string[]
) {
  let isFirstTable = true;
  const monthsHTML = months.map(({ year, month }) => {
    const monthTotal = allDates.filter(d => {
      const dd = parseDate(d);
      return dd && dd.getFullYear() === year && dd.getMonth() === month;
    }).reduce((sum, d) => sum + (dateMap.get(d)?.length ?? 0), 0);
    if (monthTotal === 0) return "";

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    // 주 단위로 분할 + 입고 없는 주 제거
    const allWeeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) allWeeks.push(cells.slice(i, i + 7));
    const weeks = allWeeks.filter(week =>
      week.some(day => {
        if (!day) return false;
        const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return (dateMap.get(k)?.length ?? 0) > 0;
      })
    );

    // 추정 높이 기반으로 청크 분리 (각 청크 = 독립 테이블 + 헤더)
    const chunks: (number | null)[][][] = [];
    let curChunk: (number | null)[][] = [];
    let curH = 0;
    for (const week of weeks) {
      const wh = pdfWeekHeightMM(week, dateMap, year, month);
      if (curH + wh > PDF_CONTENT_MM && curChunk.length > 0) {
        chunks.push(curChunk);
        curChunk = [];
        curH = 0;
      }
      curChunk.push(week);
      curH += wh;
    }
    if (curChunk.length > 0) chunks.push(curChunk);

    const dayHeaderCells = DAY_KO.map(d => `<th class="dh">${d}</th>`).join("");
    const theadHTML = `<thead>
      <tr><td colspan="7" class="mh-cell">
        <span class="mt">WORKUP — ${year}. ${MONTH_KO[month]}</span>
        <span class="mc">${monthTotal}개 상품</span>
      </td></tr>
      <tr>${dayHeaderCells}</tr>
    </thead>`;

    return chunks.map(chunk => {
      const weeksHTML = chunk.map(week => {
        const tds = week.map(day => {
          if (!day) return `<td class="ec"></td>`;
          const isoKey   = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const items    = dateMap.get(isoKey) ?? [];
          const done     = items.length > 0 && items.every(p => p.status === "입고완료");
          const itemsHTML = items.map(p => {
            const imgSrc      = parseImages(p)[0] ?? "";
            const statusLabel = STATUS_META[p.status]?.label ?? "";
            const statusCls   = p.status === "입고예정" ? "s-upcoming" : p.status === "입고지연" ? "s-delay" : "s-done";
            const bgHex       = brandBgHex(p.brand);
            const pName       = stripBrand(p.productName, p.brand);
            const priceLine   = p.price > 0 ? `판매 ${p.price.toLocaleString("ko-KR")}` : "";
            return `<div class="pi">
              <div class="pi-img">
                ${imgSrc
                  ? `<img class="pimg" src="${imgSrc}" alt="" />`
                  : `<div class="pimg-no"></div>`}
              </div>
              <div class="pi-body">
                <div class="pi-meta">
                  <span class="${statusCls}">${statusLabel}</span>
                  <span class="pbrand" style="background:${bgHex};color:${brandTextColor(p.brand)};">${p.brand}</span>
                </div>
                <p class="pname">${pName}</p>
                ${priceLine ? `<p class="pprice">${priceLine}</p>` : ""}
              </div>
            </div>`;
          }).join("");
          return `<td class="cell${done ? " done" : ""}">
            <span class="dn${items.length === 0 ? " dn-empty" : ""}">${day}</span>
            ${itemsHTML}
          </td>`;
        }).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      const needsBreak = !isFirstTable;
      isFirstTable = false;
      return `<table class="cg${needsBreak ? " cg-break" : ""}">${theadHTML}<tbody>${weeksHTML}</tbody></table>`;
    }).join("");
  }).filter(Boolean).join("");

  if (!monthsHTML) return null;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>WORKUP Arrival Calendar</title>
<style>
  @page { size: A4 landscape; margin: 6mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* 각 페이지 청크를 독립 테이블로 생성 → 헤더(월 제목+요일) 100% 반복 보장 */
  .cg { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .cg-break { page-break-before: always; }
  thead { display: table-header-group; }
  tbody { display: table-row-group; }

  /* 월 제목 행 */
  .mh-cell { padding: 2px 0 5px 0; border-bottom: 1.5px solid #1a1a1a; }
  .mt { font-size: 13px; font-weight: 900; letter-spacing: -0.02em; margin-right: 8px; }
  .mc { font-size: 9px; color: #6b7280; font-weight: 600; }

  /* 요일 헤더 */
  .dh {
    text-align: center;
    font-size: 8px;
    font-weight: 800;
    padding: 3px 2px;
    color: #6b7280;
    border: 1px solid #d1d5db;
    letter-spacing: 0.05em;
    background: #fff;
  }

  /* 주(tr) 단위 잘림 방지 — 각 청크가 이미 독립 테이블이므로 thead 반복과 충돌 없음 */
  tr { page-break-inside: avoid; break-inside: avoid; }

  /* 날짜 셀 */
  .cell {
    padding: 3px 3px 4px;
    vertical-align: top;
    border: 1px solid #d1d5db;
  }
  .ec {
    border: 1px solid #d1d5db;
    min-height: 8mm;
  }

  .dn { display: block; font-size: 10px; font-weight: 900; color: #1a1a1a; margin-bottom: 2px; line-height: 1; }
  .dn-empty { color: #d1d5db; }

  /* 제품 아이템 단위 잘림 방지 */
  .pi { margin-bottom: 3px; page-break-inside: avoid; break-inside: avoid; }
  .pi:last-child { margin-bottom: 0; }
  /* 이미지 컨테이너: 인쇄 모드에서 aspect-ratio 미지원 대비 명시적 고정 높이 사용 */
  .pi-img { width: 100%; height: 40mm; background: #fff; display: flex; align-items: center; justify-content: center; }
  .pi-body { padding: 2px 3px 3px; }

  .pimg     { width: 100%; height: 100%; object-fit: contain; display: block; }
  .pimg-no  { width: 100%; height: 100%; display: block; background: #f3f4f6; }
  .pi-meta    { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; margin-bottom: 1px; }
  .s-upcoming { font-size: 6.5px; font-weight: 700; color: #374151; }
  .s-delay    { font-size: 6.5px; font-weight: 700; color: #b45309; }
  .s-done     { font-size: 6.5px; font-weight: 600; color: #9ca3af; }
  .pbrand     { font-size: 6.5px; font-weight: 700; color: #fff; padding: 1px 3px; border-radius: 2px; }
  .pname    { font-size: 7.5px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
  .pprice   { font-size: 6.5px; color: #6b7280; margin-top: 1px; }
  .pqty     { font-size: 6.5px; color: #6b7280; }
  .cell.done .pname { color: #9ca3af; }
  .cell.done .dn    { color: #9ca3af; }
</style>
</head>
<body>${monthsHTML}</body>
</html>`;
}

// ─── 캘린더 뷰 ───────────────────────────────────────────────────────────────
function CalendarView({ products, onSelect, showMarketing, thisWeekRange, filterThisWeek, openOrderLink, syncLabel }: {
  products: ArrivalProduct[]; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
  thisWeekRange?: { start: string; end: string }; filterThisWeek?: boolean;
  openOrderLink: (url: string, e: React.MouseEvent) => void;
  /** 데이터 기준 시각 문구. 첫 번째 월 헤더 우측 끝에 표시 */
  syncLabel?: string;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/member/me")
      .then(r => r.json())
      .then(data => setIsAdmin(isAdminGrade(data?.grade)))
      .catch(() => setIsAdmin(false));
  }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const thisYear  = today.getFullYear();
  const thisMonth = today.getMonth();

  const dateMap = useMemo(() => {
    const m = new Map<string, ArrivalProduct[]>();
    for (const p of products) {
      const key = p.arrivalDate?.trim();
      if (!key) continue;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return m;
  }, [products]);

  // 매장입고일이 비어 있는 품목은 달력에 못 올라가므로 "일정미정" 그룹으로 따로 모은다
  const undated = useMemo(() => products.filter(p => !p.arrivalDate?.trim()), [products]);

  const allDates = Array.from(dateMap.keys()).sort();
  if (allDates.length === 0) return undated.length > 0
    ? <UndatedSection items={undated} onSelect={onSelect} showMarketing={showMarketing} />
    : <div className="py-20 text-center text-gray-400 text-[16px]">표시할 데이터가 없습니다.</div>;

  const minDate = parseDate(allDates[0])!;
  const maxDate = parseDate(allDates[allDates.length-1])!;
  const months: { year: number; month: number }[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  const isPast = (year: number, month: number) =>
    year < thisYear || (year === thisYear && month < thisMonth);

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    new Set(months.filter(({ year, month }) => isPast(year, month)).map(({ year, month }) => `${year}-${month}`))
  );
  const toggleCollapse = (key: string) =>
    setCollapsed(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  const scrollToTodayLine = useCallback(() => {
    const target = months.find(({ year, month }) => !isPast(year, month)) ?? months[months.length - 1];
    if (!target) return;
    const monthId = `cal-month-${target.year}-${target.month}`;
    setTimeout(() => {
      // 모바일/PC 캘린더가 동시에 DOM에 존재할 수 있으므로(반응형으로 하나만 보임),
      // 실제로 화면에 보이는(레이아웃된) 오늘 셀만 골라서 스크롤 대상으로 삼는다.
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-cal-today]"));
      const todayEl = candidates.find(el => el.offsetParent !== null) ?? null;
      if (todayEl) {
        // 날짜가 쓰인 셀의 맨 윗줄(날짜 라인)이 상단 sticky 필터바 바로 아래에 오도록 정확히 스크롤
        const topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--arrival-topbar-h")) || 64;
        const todayY = todayEl.getBoundingClientRect().top + window.scrollY - topbarH - 8;
        // 월 헤더(월·개수·재입고·클릭 안내)가 상단 바에 가려지지 않도록,
        // 오늘 줄이 월 헤더 바로 아래(약 350px 이내)에 있으면 월 헤더 기준으로 스크롤한다.
        const monthHeaderEl = document.getElementById(monthId);
        const headerY = monthHeaderEl ? monthHeaderEl.getBoundingClientRect().top + window.scrollY - topbarH - 8 : todayY;
        const targetY = todayY - headerY < 350 ? headerY : todayY;
        window.scrollTo({ top: targetY, behavior: "smooth" });
        return;
      }
      document.getElementById(monthId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToTodayLine();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "이번주 입고품목"을 해제하면(전체 보기로 전환) 지난 달은 다시 접고, 이번주 라인으로 이동
  const prevFilterThisWeekRef = useRef(filterThisWeek);
  useEffect(() => {
    if (prevFilterThisWeekRef.current === true && filterThisWeek === false) {
      setCollapsed(new Set(months.filter(({ year, month }) => isPast(year, month)).map(({ year, month }) => `${year}-${month}`)));
      scrollToTodayLine();
    }
    prevFilterThisWeekRef.current = filterThisWeek;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterThisWeek]);

  // 클릭 안내 + 기준 시각 박스 (이번 달 헤더 또는 접힌 달 줄 오른쪽 끝에 표시)
  const infoBox = (
    <span className={`ml-auto items-center divide-x divide-gray-200 shrink-0 whitespace-nowrap rounded-lg border border-gray-200 bg-white overflow-hidden ${syncLabel ? "flex" : "hidden sm:flex"}`}>
      {/* 클릭 안내 (PC) + 기준 시각을 한 박스로 묶음 */}
      <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-[13px] font-semibold text-[#1a1a1a] animate-pulse motion-reduce:animate-none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        제품을 클릭하면 크게 볼 수 있습니다
      </span>
      {syncLabel && <span className="px-3 py-1 text-[12px] font-normal text-gray-500 tabular-nums">{syncLabel}</span>}
    </span>
  );
  // 월별 입고 건수 / 재진행 건수
  const monthStats = (y: number, m: number) => {
    let total = 0, reorder = 0;
    for (const d of allDates) {
      const dd = parseDate(d);
      if (!dd || dd.getFullYear() !== y || dd.getMonth() !== m) continue;
      const items = dateMap.get(d) ?? [];
      total += items.length;
      reorder += items.filter(p => p.newArrivalType === "재진행").length;
    }
    return { total, reorder };
  };

  function handlePDF() {
    const html = buildCalendarPDF(products, dateMap, months, allDates);
    if (!html) return;
    const w = window.open("", "_blank", "width=1400,height=900");
    if (!w) { alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."); return; }
    w.document.write(html);
    w.document.close();
    // 이미지 로드 완료 후 인쇄 (최대 6초 대기)
    let printed = false;
    const doPrint = () => { if (!printed) { printed = true; w.focus(); w.print(); } };
    const imgs = Array.from(w.document.images);
    if (imgs.length === 0) { setTimeout(doPrint, 300); return; }
    let loaded = 0;
    const onLoad = () => { if (++loaded >= imgs.length) setTimeout(doPrint, 200); };
    imgs.forEach(img => {
      if (img.complete) onLoad();
      else { img.addEventListener("load", onLoad); img.addEventListener("error", onLoad); }
    });
    setTimeout(doPrint, 6000);
  }

  return (
    <div className="space-y-4">

      {months.map(({ year, month }, monthIdx) => {
        // 클릭 안내·기준 시각 박스는 "이번 달" 헤더에 고정 (필터로 앞 달이 사라져도 위치가 바뀌지 않게). 이번 달이 없으면 첫 달.
        const infoMonthIdx = (() => {
          const base = (thisWeekRange?.start && parseDate(thisWeekRange.start)) || new Date();
          const i = months.findIndex(m => m.year === base.getFullYear() && m.month === base.getMonth());
          return i >= 0 ? i : 0;
        })();
        const monthKey = `${year}-${month}`;
        const isCollapsed = collapsed.has(monthKey);
        // 연속으로 접힌 달들은 한 줄에 칩으로 나란히 표시 (줄의 첫 달에서 한 번에 렌더링, 나머지는 건너뜀)
        if (isCollapsed) {
          const isCol = (i: number) => i >= 0 && i < months.length && collapsed.has(`${months[i].year}-${months[i].month}`);
          if (isCol(monthIdx - 1)) return null;
          const run: number[] = [];
          for (let j = monthIdx; isCol(j); j++) run.push(j);
          return (
            <div key={`run-${monthKey}`} className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-gray-200 pb-2">
              {run.map((j, n) => {
                const m = months[j];
                const st = monthStats(m.year, m.month);
                const showYear = n === 0 || months[run[n - 1]].year !== m.year;
                return (
                  <button key={`${m.year}-${m.month}`} id={`cal-month-${m.year}-${m.month}`}
                    onClick={() => toggleCollapse(`${m.year}-${m.month}`)}
                    title="클릭하면 펼쳐집니다"
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[13px] font-bold text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-colors">
                    <span>{showYear ? `${m.year}. ` : ""}{MONTH_KO[m.month]}</span>
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">{st.total}개</span>
                    {st.reorder > 0 && <span className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-500"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ffd700] text-[10px] font-bold leading-none text-[#1a1a1a]">R</span>{st.reorder}</span>}
                    <span className="text-[11px] font-medium text-gray-400">▼</span>
                  </button>
                );
              })}
              {run.includes(infoMonthIdx) && <span className="ml-auto">{infoBox}</span>}
            </div>
          );
        }
        const past = isPast(year, month);

        const monthDates = allDates.filter(d => {
          const dd = parseDate(d);
          return dd && dd.getFullYear() === year && dd.getMonth() === month;
        });
        const monthTotal = monthDates.reduce((sum, d) => sum + (dateMap.get(d)?.length ?? 0), 0);
        const monthReorder = monthDates.reduce((sum, d) => sum + (dateMap.get(d)?.filter(p => p.newArrivalType === "재진행").length ?? 0), 0);

        // 월요일 시작 기준 오프셋(토·일 제외한 5일 그리드 구성용)
        const firstDay = new Date(year, month, 1).getDay();
        const mondayOffset = (firstDay + 6) % 7;
        const daysInMonth = new Date(year, month+1, 0).getDate();
        const rawCells: (number|null)[] = [...Array(mondayOffset).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
        while (rawCells.length % 7 !== 0) rawCells.push(null);
        // 주 단위(월~일 7칸)로 분리한 뒤 토·일(뒤 2칸)을 잘라내 월~금만 사용
        const allWeeks: (number|null)[][] = [];
        for (let i = 0; i < rawCells.length; i += 7) allWeeks.push(rawCells.slice(i, i + 5));
        // 입고 상품이 하나도 없는 주는 숨긴다 (주 안에 하루라도 있으면 그 주는 전체 표시)
        const weeks = allWeeks.filter(week =>
          week.some(day => {
            if (!day) return false;
            const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            return (dateMap.get(key)?.length ?? 0) > 0;
          })
        );
        const cells = allWeeks.flat();

        return (
          <div key={monthKey} id={`cal-month-${year}-${month}`} className={isCollapsed ? "mb-2" : ""}>
            {/* 월 헤더 */}
            <button onClick={() => toggleCollapse(monthKey)}
              className={`w-full flex items-center group text-left ${isCollapsed ? "gap-2.5 py-2 border-b border-gray-200" : "gap-3 mb-3"}`}>
              <span className={`${isCollapsed ? "text-[14px] tracking-[0.05em]" : "text-[16px] tracking-[0.1em]"} uppercase font-bold transition-colors ${past ? "text-gray-400" : "text-gray-700"} group-hover:text-gray-900`}>
                {year}. {MONTH_KO[month]}
              </span>
              {monthTotal > 0 && (
                <span className={`${isCollapsed ? "text-[12px]" : "text-[14px]"} px-2 py-0.5 rounded-full font-semibold ${past ? "bg-gray-100 text-gray-500" : "bg-[#1a1a1a]/10 text-gray-700"}`}>
                  {monthTotal}개
                </span>
              )}
              {monthReorder > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-5 h-5 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[11px] font-bold flex items-center justify-center leading-none">R</span>
                  <span className="text-[14px] text-gray-600 font-medium">재입고 {monthReorder}개</span>
                </span>
              )}
              {isCollapsed && monthTotal === 0 && <span className="text-[12px] text-gray-400">입고 스케쥴 없음</span>}
              <span className={`${isCollapsed ? "text-[12px]" : "text-[14px]"} font-medium ${past ? "text-gray-400" : "text-gray-500"} group-hover:text-gray-700`}>
                {isCollapsed ? "▼ 펼치기" : "▲ 접기"}
              </span>
              {monthIdx === infoMonthIdx && infoBox}
            </button>

            {isCollapsed ? null : (
              <>
                {/* ── 모바일: 날짜별 이미지 카드 (2열) ─────────────────────── */}
                <div className="sm:hidden space-y-4">
                  {allDates
                    .filter(d => { const dd = parseDate(d); return dd && dd.getFullYear() === year && dd.getMonth() === month; })
                    .map(d => {
                      const items = dateMap.get(d) ?? [];
                      const dd = parseDate(d)!;
                      const isToday = year === thisYear && month === thisMonth && dd.getDate() === today.getDate();
                      const isThisWeek = thisWeekRange ? isInWeekRange(d, thisWeekRange) : false;
                      return (
                        <div key={d} data-cal-today={isToday ? "true" : undefined}>
                          <div className={`mb-2 flex items-center gap-2 border-b-2 border-gray-300 px-1 pb-1 ${isThisWeek ? "bg-orange-100" : ""}`}>
                            <span className="text-[15px] font-black text-[#1a1a1a]">{month + 1}/{dd.getDate()}({DAY_KO[dd.getDay()]})</span>
                            <span className="text-[13px] text-gray-500">{items.length}개</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                            {items.map(p => (
                              <ProductCard key={`${p.productCode}_${p.arrivalDate || "none"}`} product={p} onSelect={() => onSelect(p)} showMarketing={showMarketing} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* ── PC: 이미지 + 텍스트 (좌우 스크롤) ──────────────────── */}
                <div className="hidden sm:block overflow-x-auto">
                  <div className="min-w-[600px] space-y-px">
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-5 gap-px bg-gray-200 rounded-t-xl overflow-hidden border border-b-0 border-gray-200">
                      {WEEKDAY_KO.map(d => (
                        <div key={d} className="bg-gray-50 text-center text-[11px] text-gray-400 py-0.5 font-semibold leading-tight">{d}</div>
                      ))}
                    </div>
                    {/* 모든 주 렌더 (데이터 없는 주도 가로라인 표시) */}
                    {weeks.map((week, wi) => (
                      <div key={wi} className={`grid grid-cols-5 gap-px bg-gray-200 border border-gray-200 ${wi === weeks.length - 1 ? "rounded-b-xl overflow-hidden" : ""}`}>
                        {week.map((day, di) => {
                          if (!day) return <div key={di} className="bg-[#fafaf8]" />;
                          const isoKey     = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                          const items      = dateMap.get(isoKey) ?? [];
                          // 같은 주(줄)에서 가장 제품이 많은 날의 개수 — 이보다 적은 날은 마지막 제품 아래에도 얇은 선을 둔다
                          const weekMax    = Math.max(0, ...week.map(d => d ? (dateMap.get(`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`)?.length ?? 0) : 0));
                          const hasItems   = items.length > 0;
                          const completedAll = hasItems && items.every(p => p.status === "입고완료");
                          const isToday    = year === thisYear && month === thisMonth && day === today.getDate();
                          const dayKoLabel = DAY_KO[new Date(year, month, day).getDay()];
                          // 오늘 이전 날짜: 점 깜빡임 중지 + 날짜 짙은 회색
                          const isPastDay  = new Date(year, month, day).getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                          return (
                            <div key={di} data-cal-today={isToday ? "true" : undefined} className="bg-white flex flex-col">
                              {!hasItems && (
                                <div className="flex flex-1 flex-col">
                                  {/* 입고 없는 날: 입고완료처럼 회색 날짜 + 안내 문구 */}
                                  <div className="flex h-9 items-center px-2 border-b border-gray-100 bg-gray-50/70">
                                    <span className="text-[13px] font-bold leading-none whitespace-nowrap text-gray-400">
                                      {month + 1}/{day}
                                      <span className="ml-0.5 font-medium text-gray-300">({dayKoLabel})</span>
                                    </span>
                                  </div>
                                  <p className="pt-3 text-center text-[13px] font-medium text-gray-300">입고 없음</p>
                                </div>
                              )}
                              {hasItems && (
                                <div className="flex flex-1 flex-col">
                                  {items.map((p, pi) => {
                                    const meta = STATUS_META[p.status] ?? STATUS_META["입고예정"];
                                    const isThisWeek = thisWeekRange ? isInWeekRange(p.arrivalDate, thisWeekRange) : false;
                                    return (
                                      <button key={`${p.productCode}_${p.arrivalDate || "none"}`} onClick={() => onSelect(p)}
                                        className={`flex flex-col items-stretch justify-start w-full text-left transition-opacity hover:opacity-75 pb-2 border-b ${pi < items.length - 1 || items.length < weekMax ? "border-gray-200" : "border-transparent pb-1.5"}`}>
                                        {/* 날짜/상태 줄: 오늘 이후(미래) 날짜는 주황 깜빡이는 점·날짜, 지난 날짜는 짙은 회색. 이번 주는 연한 주황 배경 */}
                                        <div className={`flex h-9 items-center justify-between gap-1 px-2 border-b border-gray-100 ${isThisWeek ? "bg-orange-50" : "bg-gray-50/70"}`}>
                                          <span className={`flex items-center gap-1.5 text-[13px] font-bold leading-none whitespace-nowrap ${isPastDay ? "text-gray-700" : "text-orange-600"}`}>
                                            {!isToday && (!isPastDay || isThisWeek) && (
                                              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                                                {!isPastDay && <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping motion-reduce:hidden" />}
                                                <span className={`relative inline-flex h-2 w-2 rounded-full ${isPastDay ? "bg-gray-400" : "bg-orange-500"}`} />
                                              </span>
                                            )}
                                            {/* 오늘: 날짜를 주황 채움 알약으로 (캘린더 앱의 '오늘' 표기 방식) */}
                                            <span className={isToday ? "rounded-full bg-orange-500 px-2 py-1 text-white" : ""}>
                                              {month + 1}/{day}
                                              <span className={`ml-0.5 font-medium ${isToday ? "text-orange-100" : isPastDay ? "text-gray-500" : "text-orange-400"}`}>({dayKoLabel})</span>
                                            </span>
                                          </span>
                                          <span className="flex items-center gap-1 shrink-0">
                                            <span className={`text-[11px] font-bold px-1.5 py-[3px] rounded-full leading-none ${brandTextCls(p.brand)} ${brandBg(p.brand)}`}>{p.brand}</span>
                                            <span className={`text-[11px] font-bold px-1.5 py-[3px] rounded-full leading-none ${meta.cls}`}>{meta.label}</span>
                                          </span>
                                        </div>
                                        <FitName name={stripBrand(p.productName, p.brand).replace(/^[A-Za-z][A-Za-z0-9]*_/, "")} reorder={p.newArrivalType === "재진행"} />
                                        {(() => {
                                          // 사이즈 · 컬러 (컬러는 "카키,블랙" → "카키, 블랙")
                                          const sizeTxt = fmtSize(p.size);
                                          const colorTxt = (p.color || "").split(",").map(c => c.trim()).filter(Boolean).join(", ");
                                          const line = [sizeTxt, colorTxt].filter(Boolean).join(" · ");
                                          return <p className="px-1.5 py-1 min-h-[26px] border-t border-gray-100 text-[12px] text-gray-500 leading-tight text-center truncate" title={line}>{line || " "}</p>;
                                        })()}
                                        <div className={`relative w-full aspect-[5/4] max-h-44 overflow-hidden bg-white border-y border-gray-100 ${showMarketing && p.marketingUsage ? "ring-2 ring-blue-500" : ""}`}>
                                          <div className="relative w-4/5 h-full mx-auto">
                                            <MiniThumb product={p} fit="contain" />
                                          </div>
                                          {showMarketing && <MarketingBadge usage={p.marketingUsage} />}
                                        </div>
                                        <div className="px-1.5">
                                          <div className="mt-1 flex flex-col gap-1">
                                            <p className="h-[14px] text-[14px] text-gray-400 font-mono leading-none truncate text-center">{p.productCode}</p>
                                            <p className="h-[19px] border-t border-gray-100 pt-1 text-[14px] text-gray-500 leading-none whitespace-nowrap text-center">
                                              {p.price > 0 && (<>판매가 <span className="font-semibold text-[#1a1a1a]">{p.price.toLocaleString("ko-KR")}</span></>)}
                                            </p>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
      {undated.length > 0 && <UndatedSection items={undated} onSelect={onSelect} showMarketing={showMarketing} />}
    </div>
  );
}

// ─── 캘린더 하단: 매장입고일 미정 그룹 ────────────────────────────────────────
function UndatedSection({ items, onSelect, showMarketing }: {
  items: ArrivalProduct[]; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
}) {
  const [open, setOpen] = useState(false); // 기본은 접힌 상태
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 mb-3 text-left">
        <span className="text-[18px] font-black text-gray-500 tracking-wide">일정미정</span>
        <span className="text-[14px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 leading-none">{items.length}개</span>
        <span className="text-[14px] text-gray-500 whitespace-nowrap">{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {open && (
        <div className={GRID_COLS}>
          {items.map((p, i) => (
            <ProductCard key={`${p.productCode}_none_${i}`} product={p} onSelect={() => onSelect(p)} showMarketing={showMarketing} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 간트 뷰 (브랜드 × 날짜 매트릭스) ──────────────────────────────────────
function GanttView({ products, onSelect, showMarketing }: {
  products: ArrivalProduct[]; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
}) {
  const todayIso = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);

  // 고유 날짜 목록 (오름차순) & 브랜드 목록 (오름차순)
  const dates  = useMemo(() => Array.from(new Set(products.map(p => p.arrivalDate).filter(Boolean))).sort(), [products]);
  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand))).sort(), [products]);

  // 셀 조회용 맵 [brand][date] → ArrivalProduct[]
  const cellMap = useMemo(() => {
    const m = new Map<string, Map<string, ArrivalProduct[]>>();
    for (const p of products) {
      if (!p.arrivalDate) continue;
      if (!m.has(p.brand)) m.set(p.brand, new Map());
      const dm = m.get(p.brand)!;
      if (!dm.has(p.arrivalDate)) dm.set(p.arrivalDate, []);
      dm.get(p.arrivalDate)!.push(p);
    }
    return m;
  }, [products]);

  // 날짜 미정 제품
  const undated = useMemo(() => products.filter(p => !p.arrivalDate), [products]);

  if (dates.length === 0) return (
    <div className="py-20 text-center text-gray-400 text-[16px]">표시할 데이터가 없습니다.</div>
  );

  // 날짜 헤더를 월별로 그룹 (colspan용)
  type MonthGroup = { label: string; dates: string[] };
  const monthGroups: MonthGroup[] = [];
  for (const iso of dates) {
    const { mm: m } = fmtDate(iso);
    const d = parseDate(iso)!;
    const label = `${d.getFullYear()}. ${d.getMonth()+1}월`;
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.dates.push(iso);
    else monthGroups.push({ label, dates: [iso] });
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[13px]" style={{ minWidth: `${140 + dates.length * 56}px` }}>
        <thead>
          {/* 월 헤더 */}
          <tr>
            <th className="w-[140px] min-w-[140px] bg-gray-50 border border-gray-200 px-3 py-2 text-left text-[12px] text-gray-400 font-semibold">브랜드</th>
            {monthGroups.map(mg => (
              <th key={mg.label} colSpan={mg.dates.length}
                className="bg-gray-50 border border-gray-200 px-2 py-2 text-center text-[12px] font-bold text-gray-600 whitespace-nowrap">
                {mg.label}
              </th>
            ))}
          </tr>
          {/* 날짜 헤더 */}
          <tr>
            <th className="bg-gray-50 border border-gray-200" />
            {dates.map(iso => {
              const { mm, dd, dayKo } = fmtDate(iso);
              const isToday = iso === todayIso;
              return (
                <th key={iso} className={`border border-gray-200 px-1 py-1.5 text-center whitespace-nowrap w-14 ${isToday ? "bg-red-50" : "bg-white"}`}>
                  <span className={`block text-[13px] font-black ${isToday ? "text-red-500" : "text-gray-700"}`}>{mm}.{dd}</span>
                  <span className={`block text-[11px] font-medium ${isToday ? "text-red-400" : "text-gray-400"}`}>{dayKo}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {brands.map((brand, bi) => {
            const dm = cellMap.get(brand);
            const brandTotal = products.filter(p => p.brand === brand).length;
            return (
              <tr key={brand} className={bi % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                {/* 브랜드명 열 */}
                <td className="border border-gray-200 px-3 py-2 font-bold text-gray-700 uppercase whitespace-nowrap sticky left-0 bg-inherit z-10">
                  <span className="block text-[13px] leading-snug">{brand}</span>
                  <span className="block text-[11px] text-gray-400 font-normal">{brandTotal}개</span>
                </td>
                {/* 날짜 셀 */}
                {dates.map(iso => {
                  const ps = dm?.get(iso) ?? [];
                  if (ps.length === 0) {
                    return <td key={iso} className={`border border-gray-100 w-14 ${iso === todayIso ? "bg-red-50/40" : ""}`} />;
                  }
                  const hasMarketing = showMarketing && ps.some(p => p.marketingUsage);
                  const allDone      = ps.every(p => p.status === "입고완료");
                  const cellCls = hasMarketing
                    ? "bg-blue-50 border-blue-200"
                    : allDone
                    ? "bg-gray-100 border-gray-200"
                    : "bg-[#1a1a1a]/5 border-gray-200";
                  const badgeCls = hasMarketing
                    ? "bg-orange-400 text-white"
                    : allDone
                    ? "bg-gray-300 text-gray-600"
                    : "bg-[#1a1a1a] text-white";
                  return (
                    <td key={iso} className={`border w-14 p-1 text-center align-middle ${cellCls}`}>
                      <button
                        onClick={() => onSelect(ps[0])}
                        title={ps.map(p => p.productName).join("\n")}
                        className="w-full h-full flex items-center justify-center hover:opacity-70 transition-opacity">
                        <span className={`inline-flex items-center justify-center text-[12px] font-black rounded-full w-5 h-5 leading-none ${badgeCls}`}>
                          {ps.length}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 날짜 미정 */}
      {undated.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-[13px] font-bold text-gray-400 mb-2">일정 미정 ({undated.length}개)</p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map(p => (
              <button key={`${p.productCode}_none`} onClick={() => onSelect(p)}
                className="text-[12px] text-gray-500 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400 hover:text-gray-700 transition-colors">
                {p.brand} · {stripBrand(p.productName, p.brand).slice(0, 14)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-5 mt-5 pt-4 border-t border-gray-100 text-[12px] text-gray-400">
        <span className="flex items-center gap-1.5"><span className="inline-flex w-5 h-5 rounded-full bg-[#1a1a1a] items-center justify-center text-white text-[11px] font-black">N</span>입고예정</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex w-5 h-5 rounded-full bg-gray-300 items-center justify-center text-gray-600 text-[11px] font-black">N</span>입고완료</span>
        {showMarketing && <span className="flex items-center gap-1.5"><span className="inline-flex w-5 h-5 rounded-full bg-orange-400 items-center justify-center text-white text-[11px] font-black">N</span>마케팅 활용</span>}
      </div>
    </div>
  );
}

// ─── 타임라인 뷰 ─────────────────────────────────────────────────────────────
function TimelineView({ products, onSelect, showMarketing, showRates }: {
  products: ArrivalProduct[]; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean; showRates?: boolean;
}) {
  // 월별 → 날짜별 2단 그룹
  const byMonth = useMemo(() => {
    const monthMap = new Map<string, Map<string, ArrivalProduct[]>>();
    for (const p of products) {
      const dateKey = p.arrivalDate?.trim() || "미정";
      const mKey = toMonthKey(dateKey);
      if (!monthMap.has(mKey)) monthMap.set(mKey, new Map());
      const dateMap = monthMap.get(mKey)!;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(p);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mKey, dateMap]) => ({
        mKey,
        label: mKey === "미정" ? "일정 미정" : monthKeyLabel(mKey),
        dates: Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
        total: Array.from(dateMap.values()).reduce((s, v) => s + v.length, 0),
      }));
  }, [products]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const currentMonthKey = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
  }, []);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  // 데이터 로드 시 현재 월 외 모두 접기 (최초 1회)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || byMonth.length === 0) return;
    initializedRef.current = true;
    const nonCurrent = new Set(byMonth.map(m => m.mKey).filter(k => k !== currentMonthKey));
    if (nonCurrent.size > 0) setCollapsedMonths(nonCurrent);
  }, [byMonth, currentMonthKey]);
  const toggleMonth = (mKey: string) =>
    setCollapsedMonths(prev => { const n = new Set(prev); n.has(mKey) ? n.delete(mKey) : n.add(mKey); return n; });

  // 오늘 날짜 라인으로 자동 스크롤 (최초 1회)
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || byMonth.length === 0) return;
    scrolledRef.current = true;
    setTimeout(() => {
      let targetEl = document.getElementById("timeline-today");
      if (!targetEl) {
        // 오늘 입고 상품이 없으면(타임라인엔 상품 있는 날짜만 표시) 오늘 이후 가장 가까운 날짜로 이동
        const todayIso = toIsoDate(today);
        const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-timeline-date]"));
        targetEl = rows.find(r => (r.dataset.timelineDate ?? "") >= todayIso)
          ?? rows[rows.length - 1]
          ?? null;
      }
      if (!targetEl) return;
      const topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--arrival-topbar-h")) || 64;
      const targetY = targetEl.getBoundingClientRect().top + window.scrollY - topbarH - 12;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }, 80);
  }, [byMonth]);

  if (byMonth.length === 0) return (
    <div className="py-20 text-center text-gray-400 text-[16px]">표시할 데이터가 없습니다.</div>
  );

  return (
    <div className="space-y-4 overflow-x-hidden">
      {byMonth.map(({ mKey, label, dates, total }, idx) => {
        const isCollapsed = collapsedMonths.has(mKey);
        // 연속으로 접힌 달들은 한 줄에 칩으로 나란히 표시 (줄의 첫 달에서 한 번에 렌더링, 나머지는 건너뜀)
        if (isCollapsed) {
          const isCol = (i: number) => i >= 0 && i < byMonth.length && collapsedMonths.has(byMonth[i].mKey);
          if (isCol(idx - 1)) return null;
          const run: number[] = [];
          for (let j = idx; isCol(j); j++) run.push(j);
          const yearOf = (k: string) => k.split("-")[0];
          const monthLabel = (k: string) => k === "미정" ? "일정 미정" : `${parseInt(k.split("-")[1], 10)}월`;
          return (
            <div key={`run-${mKey}`} className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-gray-200 pb-2">
              {run.map((j, n) => {
                const m = byMonth[j];
                const showYear = m.mKey !== "미정" && (n === 0 || yearOf(byMonth[run[n - 1]].mKey) !== yearOf(m.mKey));
                return (
                  <button key={m.mKey} onClick={() => toggleMonth(m.mKey)} title="클릭하면 펼쳐집니다"
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[13px] font-bold text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-colors">
                    <span>{showYear ? `${yearOf(m.mKey)}. ` : ""}{monthLabel(m.mKey)}</span>
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">{m.total}개</span>
                    <span className="text-[11px] font-medium text-gray-400">▼</span>
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <div key={mKey}>
            {/* 월 헤더 */}
            <button
              onClick={() => toggleMonth(mKey)}
              className="w-full flex items-center gap-2 mb-4 group text-left"
            >
              <span className="sm:hidden text-[13px] font-black text-gray-700 tracking-wide group-hover:text-[#1a1a1a]">{mKey === "미정" ? "일정 미정" : monthKeyLabelShort(mKey)}</span>
              <span className="hidden sm:inline text-[15px] font-black text-gray-700 tracking-wide group-hover:text-[#1a1a1a]">{label}</span>
              <span className="text-[13px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">{total}개</span>
              <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full transition-colors ${isCollapsed ? "bg-[#1a1a1a] text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"}`}>{isCollapsed ? "▼ 펼치기" : "▲ 접기"}</span>
            </button>

            {isCollapsed ? (
              <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                {dates.map(([dateKey, items]) => {
                  const { dd } = fmtDate(dateKey);
                  return (
                    <span key={dateKey} className="text-[14px] text-gray-600 border border-gray-200 rounded px-2 py-0.5 font-medium">
                      {dd}일 {items.length}개
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="relative">
                {/* 세로 연결선: 날짜열(3.5rem) + 도트열(1.5rem) 절반 */}
                <div className="absolute left-[3.25rem] sm:left-[5rem] top-2 bottom-2 w-px bg-gray-200 pointer-events-none" />

                <div>
                  {dates.map(([dateKey, items]) => {
                    const { mm, dd, dayKo } = fmtDate(dateKey);
                    const isToday = dateKey === toIsoDate(today);
                    return (
                      <div key={dateKey} id={isToday ? "timeline-today" : undefined} data-timeline-date={dateKey} className="flex items-start gap-0 mt-4 pt-4 border-t border-gray-300 first:mt-0 first:pt-0 first:border-t-0">
                        {/* 날짜 레이블 열 */}
                        <div className="w-[2.5rem] sm:w-[4rem] shrink-0 flex flex-col items-end pr-1.5 pt-0.5">
                          <span className="text-[9px] sm:text-[18px] font-black text-[#1a1a1a] leading-none">{mm}.{dd}</span>
                          <span className="text-[9px] text-gray-500 font-semibold mt-0.5">{dayKo}요일</span>
                          <span className="text-[9px] text-gray-400">{items.length}개</span>
                        </div>

                        {/* 도트 열 */}
                        <div className="w-6 shrink-0 flex justify-center pt-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#303236] z-10 relative" />
                        </div>

                        {/* 상품 카드 가로 스크롤 */}
                        <div className="flex-1 min-w-0 overflow-x-auto pb-2 pl-1 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                          <div className="flex items-start gap-3" style={{ width: "max-content" }}>
                            {items.map(p => {
                              const meta = STATUS_META[p.status] ?? STATUS_META["입고예정"];
                              return (
                                <button
                                  key={`${p.productCode}_${p.arrivalDate || "none"}`}
                                  onClick={() => onSelect(p)}
                                  className="shrink-0 w-[130px] sm:w-[200px] text-left hover:opacity-75 transition-opacity"
                                >
                                  <div className={`w-[130px] sm:w-[145px] aspect-[3/4] border ${showMarketing && p.marketingUsage ? "border-blue-500 border-2" : "border-[#979797]"}`}>
                                    <div className="relative w-full h-full overflow-hidden bg-white">
                                      <MiniThumb product={p} fit="contain" />
                                      <span className={`absolute top-1 left-1 text-[11px] font-bold px-1 py-0.5 rounded leading-none ${meta.cls}`}>
                                        {meta.label}
                                      </span>
                                      {p.newArrivalType === "재진행" && (
                                        <span className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[11px] font-bold flex items-center justify-center leading-none shadow" title="재진행 상품">R</span>
                                      )}
                                      {showMarketing && <MarketingBadge usage={p.marketingUsage} />}
                                    </div>
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    <span className={`inline-block text-[12px] font-bold px-1.5 py-0.5 rounded leading-none ${brandBg(p.brand)} ${brandTextCls(p.brand)}`}>
                                      {p.brand}
                                    </span>
                                    <p className="text-[12px] text-gray-400 font-mono truncate">{p.productCode}</p>
                                    <p className="text-[15px] font-semibold text-[#1a1a1a] leading-snug line-clamp-2">
                                      {stripBrand(p.productName, p.brand)}
                                    </p>
                                    {p.size && <p className="text-[12px] text-gray-500 leading-tight">{fmtSize(p.size)}</p>}
                                    {p.orderQuantity != null && p.orderQuantity > 0 && (
                                      <p className="text-[14px] text-gray-500">
                                        주문 <span className="font-semibold text-[#1a1a1a]">{p.orderQuantity.toLocaleString("ko-KR")}</span>
                                      </p>
                                    )}
                                    {p.price > 0 && (
                                      <p className="text-[14px] text-gray-500">판매가 <span className="font-semibold text-[#1a1a1a]">{p.price.toLocaleString("ko-KR")}</span></p>
                                    )}
                                    {showRates && <RateLine product={p} />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 주문 현황 순위표 모달 ───────────────────────────────────────────────────
type RankSortKey = "orderRate" | "orderQty" | "stockQty" | "salesQty" | "inQty" | "salesRate";

function pct(n?: number, d?: number) {
  if (n == null || !d) return null;
  return Math.round((n / d) * 100);
}

// 시트의 주문율/판매율(수기 보정 포함)을 우선 사용하고, 없으면(재동기화 전 데이터) 수량으로 계산
const orderRateOf = (p: ArrivalProduct) => p.orderRate ?? pct(p.orderQuantity, p.quantity);
const salesRateOf = (p: ArrivalProduct) => p.salesRate ?? pct(p.salesQuantity, p.quantity);

function OrderRankModal({ products, onClose, onSelect }: {
  products: ArrivalProduct[]; onClose: () => void; onSelect: (p: ArrivalProduct) => void;
}) {
  const [sortKey, setSortKey] = useState<RankSortKey>("orderRate");

  // 주문이 있는 상품만
  const ordered = useMemo(() => products.filter(p => (p.orderQuantity ?? 0) > 0), [products]);

  const rows = useMemo(() => {
    const val = (p: ArrivalProduct): number => {
      switch (sortKey) {
        case "orderRate": return orderRateOf(p) ?? -1;
        case "salesRate": return salesRateOf(p) ?? -1;
        case "orderQty":  return p.orderQuantity ?? -1;
        case "stockQty":  return p.stockQuantity ?? -1;
        case "salesQty":  return p.salesQuantity ?? -1;
        case "inQty":     return p.quantity ?? -1;
      }
    };
    return [...ordered].sort((a, b) => val(b) - val(a));
  }, [ordered, sortKey]);

  const totals = useMemo(() => ordered.reduce((t, p) => ({
    inQty:    t.inQty + (p.quantity ?? 0),
    orderQty: t.orderQty + (p.orderQuantity ?? 0),
    stockQty: t.stockQty + (p.stockQuantity ?? 0),
    salesQty: t.salesQty + (p.salesQuantity ?? 0),
  }), { inQty: 0, orderQty: 0, stockQty: 0, salesQty: 0 }), [ordered]);

  const num = (n?: number) => (n != null && n > 0 ? n.toLocaleString("ko-KR") : "—");
  const sortBtn = (key: RankSortKey, label: string, cls = "") => (
    <button
      onClick={() => setSortKey(key)}
      className={`px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${sortKey === key ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"} ${cls}`}
    >
      {label}{sortKey === key ? " ▼" : ""}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full max-w-[1100px] my-4 mx-2 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[18px] font-black text-[#1a1a1a]">주문 순위</h2>
            <p className="text-[13px] text-gray-400 mt-0.5">
              주문 {rows.length}개 · 입고 {totals.inQty.toLocaleString("ko-KR")} / 주문 {totals.orderQty.toLocaleString("ko-KR")}
              {totals.inQty > 0 && <span className="text-blue-600 font-bold"> ({Math.round(totals.orderQty / totals.inQty * 100)}%)</span>}
              {" "}/ 재고 {totals.stockQty.toLocaleString("ko-KR")} / 판매 {totals.salesQty.toLocaleString("ko-KR")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-[23px] leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">×</button>
        </div>

        {/* 정렬 */}
        <div className="px-4 sm:px-6 py-2 border-b border-gray-100 flex items-center gap-1 text-[13px] font-semibold overflow-x-auto shrink-0">
          <span className="text-gray-400 mr-1 shrink-0">정렬</span>
          {sortBtn("orderRate", "주문율")}
          {sortBtn("orderQty", "주문량")}
          {sortBtn("inQty", "입고량")}
          {sortBtn("stockQty", "재고량")}
          {sortBtn("salesQty", "판매량")}
          {sortBtn("salesRate", "판매율")}
        </div>

        {/* 표 */}
        <div className="overflow-auto">
          <table className="w-full text-[14px] border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-[12px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
                <th className="px-2 py-2 text-right w-8">#</th>
                <th className="px-2 py-2 text-left">상품</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">입고일</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">입고</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">주문</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">주문율</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">재고</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">판매</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">판매율</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">공급가</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">판매가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((p, i) => {
                const oRate = orderRateOf(p);
                const sRate = salesRateOf(p);
                return (
                  <tr key={`${p.productCode}_${p.arrivalDate || "none"}`}
                    onClick={() => onSelect(p)}
                    className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-2 py-1.5 text-right text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <div className="w-7 h-9 shrink-0 relative overflow-hidden rounded bg-[#f0efed]">
                          <MiniThumb product={p} />
                        </div>
                        <div className="min-w-0">
                          <span className="inline-flex items-center gap-1">
                            <span className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded-sm leading-none ${brandBg(p.brand)} ${brandTextCls(p.brand)}`}>{p.brand}</span>
                            {p.newArrivalType === "재진행" && (
                              <span className="inline-block text-[9px] font-bold px-1 py-0.5 rounded-sm leading-none bg-[#ffd700] text-[#1a1a1a]" title="재진행 상품">재진행</span>
                            )}
                          </span>
                          <p className="text-[14px] font-semibold text-[#1a1a1a] leading-snug truncate">{stripBrand(p.productName, p.brand)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-500 tabular-nums whitespace-nowrap">{parseDate(p.arrivalDate) ? fmtDate(p.arrivalDate).full : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(p.quantity)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{num(p.orderQuantity)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold text-blue-600">{oRate != null ? `${oRate}%` : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(p.stockQuantity)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(p.salesQuantity)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold text-green-600">{sRate != null ? `${sRate}%` : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{p.supplyPrice && p.supplyPrice > 0 ? p.supplyPrice.toLocaleString("ko-KR") : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">{p.price > 0 ? p.price.toLocaleString("ko-KR") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="py-16 text-center text-gray-400 text-[15px]">표시할 상품이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function ArrivalTimeline() {
  const [products,    setProducts]   = useState<ArrivalProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ArrivalProduct | null>(null);
  const [showRank, setShowRank] = useState(false);
  // 주문순위는 관리자 로그인 상태에서만 노출
  const [isAdmin, setIsAdmin] = useState(false);
  // 이 페이지는 사이트 헤더가 없어 별도 로그인 진입점이 필요 — 이미지 뷰 우측 상단의 작은 로그인 버튼
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  useEffect(() => {
    fetch("/api/member/me")
      .then(r => r.json())
      .then(data => { setLoggedIn(!!data); setIsAdmin(isAdminGrade(data?.grade)); })
      .catch(() => { setLoggedIn(false); setIsAdmin(false); });
  }, []);
  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true); setLoginError("");
    try {
      const res = await fetch("/api/member/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoginError(data?.error ?? "로그인에 실패했습니다."); return; }
      setLoggedIn(true);
      setIsAdmin(isAdminGrade(data?.member?.grade));
      setLoginOpen(false); setLoginPw("");
    } catch { setLoginError("오류가 발생했습니다."); }
    finally { setLoginBusy(false); }
  };
  const doLogout = async () => {
    try { await fetch("/api/member/logout", { method: "POST" }); } catch { /* noop */ }
    setLoggedIn(false); setIsAdmin(false);
  };

  // 팝업(iframe)으로 삽입된 상태인지 여부. 이 경우 "주문하기"를 매번 새 탭으로 열면
  // 클릭할 때마다 창이 계속 쌓이므로, 고정된 이름의 창 하나를 재사용해 열어준다.
  const [isEmbedded] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.self !== window.top; } catch { return true; }
  });

  // 발주 링크 클릭: 임베드 상태면 "wjumun_order"라는 이름의 창을 재사용(같은 이름 → 새 창 안 만들고 기존 창 재활용),
  // 아니면 기본 동작(target=_blank로 새 탭) 그대로 둔다.
  const openOrderLink = useCallback((url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEmbedded) {
      e.preventDefault();
      window.open(url, "wjumun_order");
    }
  }, [isEmbedded]);

  // ?popup=1: W주문 팝업(iframe) 전용 — 상단에 이번 주차 띠("10월 셋째주")를 자동 표시
  const [isPopup] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    // "&amp;popup=1" 처럼 HTML 이스케이프된 채로 걸린 링크("amp;popup")도 팝업으로 인식
    return q.get("popup") === "1" || q.get("amp;popup") === "1";
  });

  // ?view=calendar 같은 링크로 접속하면 해당 뷰로 바로 진입 (캘린더뷰 전용 공유 링크)
  const [viewMode,  setViewMode]  = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view");
    if (v === "calendar" || v === "timeline" || v === "gantt") return v as ViewMode;
    // 팝업(W주문)은 view 파라미터가 없어도 캘린더가 기본
    return q.get("popup") === "1" || q.get("amp;popup") === "1" ? "calendar" : "grid";
  });
  const [groupMode, setGroupMode] = useState<GroupMode>("month");

  // 이미지(그리드) 탭으로 전환하면 항상 맨 위에서 시작
  useEffect(() => {
    if (viewMode === "grid") window.scrollTo({ top: 0, behavior: "auto" });
  }, [viewMode]);

  // 현재 뷰를 URL(?view=)에 반영 → 캘린더뷰 등을 그대로 링크로 공유 가능
  useEffect(() => {
    const url = new URL(window.location.href);
    if (viewMode === "grid") url.searchParams.delete("view");
    else url.searchParams.set("view", viewMode);
    window.history.replaceState(null, "", url.toString());
  }, [viewMode]);

  const [filterBrand,     setFilterBrand]     = useState("all");
  const [filterCategory,  setFilterCategory]  = useState("all");
  const [filterSize,      setFilterSize]      = useState("all");
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [sortKey,         setSortKey]         = useState<"" | "sales" | "order">(""); // 관리자 이미지 뷰: 판매량/주문량 정렬
  const [filterKind,      setFilterKind]      = useState(""); // 데스크탑 필터: 현재 값을 고르는 중인 필터 종류
  const [filterNewArrival, setFilterNewArrival] = useState("all"); // all / 신규 / 재진행
  const [searchQuery,     setSearchQuery]     = useState("");
  const [filterMarketing, setFilterMarketing] = useState(false);
  const [filterThisWeek,  setFilterThisWeek]  = useState(true);
  const [filterOpen,      setFilterOpen]      = useState(false);

  const [todayKey, setTodayKey] = useState(() => toIsoDate(new Date()));
  const thisWeekRange = useMemo(() => getThisWeekRange(new Date()), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 탭을 열어둔 채 자정을 넘기면 날짜 갱신 → 일요일 00:00에 이번주 범위가 자동 전환
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => setTodayKey(toIsoDate(new Date()));
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { sync(); schedule(); }, next.getTime() - now.getTime());
    };
    schedule();
    // 절전/백그라운드 탭에서 타이머가 밀렸을 때 복귀 즉시 보정
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    fetch("/api/arrival")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProducts(data.map((p: ArrivalProduct) => p.brand === "K-WORKERS" ? { ...p, brand: "케이워커스" } : p)); })
      .finally(() => setLoadingData(false));
  }, []);

  // 상단 sticky 필터바 실측 높이 → 캘린더 요일바가 그 아래에 고정되도록 CSS 변수로 공개
  const topBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty("--arrival-topbar-h", `${el.getBoundingClientRect().height}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 마운트 시점의 ?product= 값을 미리 저장 (URL sync effect가 지우기 전에)
  const initialProductCode = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("product")
      : null
  );

  // 공유 링크 (?product=CODE) 로 접속 시 해당 제품 팝업 자동 오픈
  useEffect(() => {
    if (loadingData || products.length === 0) return;
    const code = initialProductCode.current;
    if (code) {
      const found = products.find(p => p.productCode === code);
      if (found) setSelectedProduct(found);
    }
  }, [loadingData, products]);

  // 팝업 열림/닫힘에 따라 URL 파라미터 동기화 (로딩 중엔 건드리지 않음)
  useEffect(() => {
    if (loadingData) return;
    const url = new URL(window.location.href);
    if (selectedProduct) {
      url.searchParams.set("product", selectedProduct.productCode);
    } else {
      url.searchParams.delete("product");
    }
    window.history.replaceState(null, "", url.toString());
  }, [selectedProduct, loadingData]);

  const brands     = useMemo(() => Array.from(new Set(products.map(p => p.brand))).sort(),     [products]);
  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort(), [products]);
  // 사이즈 드롭다운 옵션: 상품별 사이즈 문자열("S/M/L", "95,100" 등)을 낱개로 쪼개 중복 제거 후 정렬
  const sizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) splitSizes(p.size).forEach(s => set.add(s));
    return Array.from(set).sort(compareSize);
  }, [products]);
  const lastSync = useMemo(() => {
    const t = products.map(p => p.syncedAt).filter(Boolean) as string[];
    return t.length ? t.reduce((a, b) => (a > b ? a : b)) : null;
  }, [products]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter(p => {
        if (filterBrand    !== "all" && p.brand    !== filterBrand)    return false;
        if (filterCategory !== "all" && p.category !== filterCategory) return false;
        if (filterSize     !== "all" && !splitSizes(p.size).includes(filterSize)) return false;
        if (filterStatus   !== "all" && p.status   !== filterStatus)   return false;
        if (filterNewArrival !== "all" && (p.newArrivalType ?? "") !== filterNewArrival) return false;
        if (isAdmin && viewMode !== "calendar" && filterMarketing && !p.marketingUsage) return false;
        if (viewMode === "calendar" && filterThisWeek && !isInWeekRange(p.arrivalDate, thisWeekRange)) return false;
        if (q && !p.productName.toLowerCase().includes(q) && !p.productCode.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = a.arrivalDate || "9999-99-99";
        const db = b.arrivalDate || "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        return (a.brand || "").localeCompare(b.brand || "");
      });
  }, [products, filterBrand, filterCategory, filterSize, filterStatus, filterNewArrival, filterMarketing, isAdmin, filterThisWeek, thisWeekRange, viewMode, searchQuery]);


  // 전체 누적(필터와 무관한 전체 데이터) 기준 주문량·판매량 순위 — 관리자 이미지 뷰 카드 우상단 뱃지용 (동률은 같은 순위)
  // 수량이 0/없음인 제품은 해당 순위에서 제외(뱃지 없음)
  const salesRanks = useMemo(() => {
    const map = new Map<string, SalesRank>();
    if (!isAdmin) return map;
    const rankBy = (pick: (p: ArrivalProduct) => number) => {
      const vals = products.map(pick).filter(v => v > 0);
      return (v: number) => (v > 0 ? 1 + vals.filter(x => x > v).length : undefined);
    };
    const orderRank = rankBy(p => p.orderQuantity ?? 0);
    const salesRank = rankBy(p => p.salesQuantity ?? 0);
    for (const p of products) {
      const order = orderRank(p.orderQuantity ?? 0);
      const sales = salesRank(p.salesQuantity ?? 0);
      if (order === undefined && sales === undefined) continue;
      map.set(rankKey(p), { order, sales, total: products.length });
    }
    return map;
  }, [products, isAdmin]);

  const grouped = useMemo<[string, ArrivalProduct[]][]>(() => {
    const map = new Map<string, ArrivalProduct[]>();
    for (const p of filtered) {
      let key: string;
      if      (groupMode === "date")     key = p.arrivalDate || "미정";
      else if (groupMode === "month")    key = toMonthKey(p.arrivalDate);
      else if (groupMode === "brand")    key = p.brand || "미분류";
      else                               key = p.category || "미분류";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // 관리자: 판매량/주문량 정렬은 월·그룹과 무관하게 전체 누적 기준으로 한 목록에 (1위부터 순서대로)
    if (isAdmin && sortKey) {
      const qty = (p: ArrivalProduct) => (sortKey === "sales" ? p.salesQuantity : p.orderQuantity) ?? 0;
      // 수량이 0/없는 제품은 해당 정렬(순위) 목록에서 제외
      return [[SORTED_GROUP_KEY, filtered.filter(p => qty(p) > 0).sort((a, b) => qty(b) - qty(a))]];
    }
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [filtered, groupMode, isAdmin, sortKey]);

  // 날짜별 모드로 전환 시 오늘과 가장 가까운 날짜 그룹으로 스크롤
  useEffect(() => {
    if (groupMode !== "date" || viewMode === "calendar" || viewMode === "gantt" || grouped.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = grouped.find(([key]) => {
      const d = parseDate(key);
      return d !== null && d >= today;
    }) ?? grouped[grouped.length - 1];
    if (!target) return;
    setTimeout(() => {
      document.getElementById(`group-${target[0]}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [groupMode, viewMode]);

  const stats = useMemo(() => ({
    total:     products.length,
    completed: products.filter(p => p.status === "입고완료").length,
    upcoming:  products.filter(p => p.status === "입고예정").length,
    brands:    new Set(products.map(p => p.brand)).size,
  }), [products]);

  const resetFilters = useCallback(() => {
    setFilterBrand("all"); setFilterCategory("all"); setFilterSize("all");
    setFilterStatus("all"); setFilterNewArrival("all"); setSearchQuery(""); setFilterMarketing(false); setFilterThisWeek(false);
  }, []);
  const filterDefs = [
    { key: "brand",    label: "브랜드",   value: filterBrand,    set: setFilterBrand,    options: brands.map(b => ({ v: b, l: b })) },
    { key: "category", label: "카테고리", value: filterCategory, set: setFilterCategory, options: categories.map(c => ({ v: c, l: c })) },
    { key: "size",     label: "사이즈",   value: filterSize,     set: setFilterSize,     options: sizes.map(z => ({ v: z, l: z })) },
    { key: "status",   label: "상태",     value: filterStatus,   set: setFilterStatus,   options: [{ v: "입고예정", l: "입고예정" }, { v: "입고완료", l: "입고완료" }, { v: "일정미표기", l: "일정미정" }] },
  ];
  const activeFilterDef = filterDefs.find(d => d.key === filterKind);
  const hasFilter = filterBrand !== "all" || filterCategory !== "all" || filterSize !== "all" || filterStatus !== "all" || filterNewArrival !== "all" || searchQuery !== "" || (filterMarketing && viewMode !== "calendar") || (viewMode === "calendar" && filterThisWeek);

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[14px] tracking-[0.2em] text-gray-400 uppercase">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]" style={{ paddingTop: "var(--arrival-topbar-h, 90px)", fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* 타이틀 전용 폰트(페이퍼로지 Bold 700만 로드). Pretendard 는 layout.tsx 에서 전역 로드됨 */}
      <style>{`@font-face{font-family:'Paperlogy';font-weight:700;font-style:normal;font-display:swap;src:url('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/Paperlogy-7Bold.woff2') format('woff2');}`}</style>
      {/* ── 필터 + 뷰 전환 ──
          일부 레이아웃(특히 모바일)에서는 조상 요소 중 하나가 overflow-y:auto 스크롤 컨테이너인데
          정작 그 컨테이너 자신은 내부적으로 스크롤되지 않고(항상 scrollTop 0) 대신 문서 전체가
          스크롤되는 경우가 있다. 이때 position:sticky는 "가장 가까운 스크롤 컨테이너" 기준으로
          계산되므로 화면상 고정되지 않고 그냥 같이 흘러가버린다(모바일에서 상단바가 고정되지 않던
          원인). position:fixed는 조상의 스크롤 컨테이너 여부와 무관하게 항상 뷰포트 기준으로
          고정되므로 이 문제를 확실하게 피해간다. 대신 fixed는 문서 흐름에서 빠지므로, 위 wrapper에
          그 높이만큼 padding-top을 줘서 본문이 가려지지 않게 한다. */}
      <div ref={topBarRef} className={`fixed top-0 md:top-[var(--wu-header-h,0px)] left-0 right-0 z-30 ${PAGE_X_PAD} pt-3 pb-1.5 bg-[#fafaf8]`}>
        {isPopup && viewMode === "calendar" && (
          <div className="sm:hidden mb-2 rounded-xl border border-[#ffe08a] bg-[#fff3cd] py-2 text-center text-[13px] font-semibold text-[#7a5c00]">
            {getWeekLabel(thisWeekRange.start)}
          </div>
        )}
        <div className="relative bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2">

          {/* ── Row 1: 타이틀 / 검색 / 필터토글(모바일) / 뷰버튼 / 개수 ── */}
          <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-y-1.5">
            {/* 타이틀 (모바일에서 검색 왼쪽) */}
            {/* 타이틀 영역(PC): 주차 뱃지(팝업 전용) + 제목을 한 줄로. 모바일은 위 배너 사용 */}
            <div className="hidden sm:flex sm:order-1 flex-row items-center gap-2 shrink-0 mr-2" style={{ fontFamily: "'Paperlogy', 'Pretendard', sans-serif" }}>
              {isPopup && viewMode === "calendar" && (
                <span className="shrink-0 whitespace-nowrap text-[15px] font-bold leading-none tracking-tight text-orange-600">
                  {getWeekLabel(thisWeekRange.start)}
                </span>
              )}
              {isPopup && viewMode === "calendar" && <span className="h-4 w-px bg-gray-300 shrink-0" aria-hidden="true" />}
              <span title={lastSync ? `${new Date(lastSync).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} 기준` : undefined} className="text-[15px] font-bold leading-none text-[#1a1a1a] tracking-tight shrink-0 whitespace-nowrap">워크업 입고 스케쥴</span>
            </div>

            {/* 검색 */}
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="상품명 / 코드"
              className="border border-gray-200 px-2.5 py-1 text-[14px] rounded-lg focus:outline-none focus:border-[#1a1a1a] w-full sm:w-32 sm:order-3 text-gray-800 placeholder:text-gray-400 min-w-0" />

            {/* 모바일 필터 토글 버튼 */}
            <button
              onClick={() => setFilterOpen(v => !v)}
              className={`sm:hidden flex items-center gap-1 px-2.5 py-1 text-[14px] font-semibold rounded-lg border transition-all shrink-0 ${
                filterOpen || hasFilter ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-gray-200 text-gray-600"
              }`}>
              필터{hasFilter ? ` (${[filterBrand!=="all",filterCategory!=="all",filterSize!=="all",filterStatus!=="all",filterNewArrival!=="all",(filterMarketing&&viewMode!=="calendar"),viewMode==="calendar"&&filterThisWeek].filter(Boolean).length})` : ""}
            </button>

            {/* 데스크탑 인라인 필터 */}
            <div className="hidden sm:flex sm:order-4 items-center gap-1.5 flex-1 min-w-0">
              {isPopup ? (
                <>
                {/* 1단계: 필터 종류 선택 → 2단계: 해당 값 선택. 선택된 필터는 칩으로 쌓이며 서로 AND 로 적용 */}
                <select value={filterKind} onChange={e => setFilterKind(e.target.value)}
                  aria-label="필터 종류"
                  className="w-[96px] shrink-0 border border-gray-200 px-1 py-1 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700">
                  <option value="">필터 선택</option>
                  {filterDefs.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
                {activeFilterDef && (
                  <select value="" autoFocus
                    aria-label={`${activeFilterDef.label} 값`}
                    onChange={e => { if (e.target.value) { activeFilterDef.set(e.target.value); setFilterKind(""); } }}
                    className="w-[120px] shrink-0 border border-[#1a1a1a] px-1 py-1 text-[14px] rounded-lg bg-white focus:outline-none text-gray-700">
                    <option value="">{activeFilterDef.label} 선택</option>
                    {activeFilterDef.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                )}
                {filterDefs.filter(d => d.value !== "all").map(d => (
                  <button key={d.key} type="button" onClick={() => d.set("all")}
                    title="클릭하면 이 필터를 해제합니다"
                    className="flex items-center gap-1 min-w-0 max-w-[140px] whitespace-nowrap rounded-full bg-[#1a1a1a] text-white text-[13px] font-semibold px-2.5 py-1 hover:bg-gray-700">
                    <span className="truncate">{d.label}: {d.options.find(o => o.v === d.value)?.l ?? d.value}</span>
                    <span aria-hidden="true" className="text-[12px] opacity-70">×</span>
                  </button>
                ))}
                </>
              ) : (
                /* 일반 페이지: 필터를 펼쳐서 바로 선택 (너무 넓지 않게 고정 폭) */
                filterDefs.map(d => (
                  <select key={d.key} value={d.value} onChange={e => d.set(e.target.value)} aria-label={d.label}
                    className="w-[104px] shrink-0 border border-gray-200 px-1 py-1 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700">
                    <option value="all">{d.label}</option>
                    {d.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ))
              )}
              {isAdmin && viewMode !== "calendar" && <label className="flex items-center gap-1 cursor-pointer select-none bg-gray-50 rounded-lg px-2 py-1">
                <input type="checkbox" checked={filterMarketing} onChange={e => setFilterMarketing(e.target.checked)}
                  className="w-3 h-3 accent-blue-500 cursor-pointer" />
                <span className={`text-[13px] font-semibold whitespace-nowrap ${filterMarketing ? "text-blue-500" : "text-gray-500"}`}>마케팅</span>
              </label>}
              {viewMode === "calendar" && (
                <button type="button" onClick={() => setFilterThisWeek(v => !v)} aria-pressed={filterThisWeek}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                    filterThisWeek ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}>
                  이번주 입고
                </button>
              )}
              {hasFilter && (
                <button onClick={resetFilters} className="text-[13px] text-gray-400 hover:text-[#1a1a1a] underline underline-offset-2 whitespace-nowrap shrink-0">초기화</button>
              )}
            </div>

            {/* PC: 한 줄 — 주차·타이틀·검색·필터·보기 버튼 (필터 칩이 많아지면 자연스럽게 줄바꿈) */}
            <div className="ml-auto sm:order-7 flex items-center gap-1.5 shrink-0">
              {/* 그룹 기준 (sm+, 캘린더·타임라인·간트 제외) */}
              {viewMode !== "calendar" && viewMode !== "timeline" && viewMode !== "gantt" && (
                <div className="hidden sm:flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
                  {([ ["month","월별"], ["brand","브랜드별"] ] as [GroupMode, string][]).map(([mode, label]) => (
                    <button key={mode} onClick={() => { setGroupMode(mode); setSortKey(""); }}
                      className={`px-2 py-0.5 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap ${
                        groupMode === mode && !sortKey ? "bg-gray-800 text-white" : "text-gray-500 hover:text-[#1a1a1a]"
                      }`}>
                      {label}
                    </button>
                  ))}
                  {/* 관리자 전용: 전체 누적 판매량/주문량순 (그룹 구분 없이 한 목록) */}
                  {isAdmin && ([ ["sales","판매량순"], ["order","주문량순"] ] as ["sales" | "order", string][]).map(([key, label]) => (
                    <button key={key} onClick={() => setSortKey(key)}
                      className={`px-2 py-0.5 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap ${
                        sortKey === key ? "bg-gray-800 text-white" : "text-gray-500 hover:text-[#1a1a1a]"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {isAdmin && (
              <button
                onClick={() => setShowRank(true)}
                title="주문 순위"
                className="flex items-center gap-1 px-2 py-1 text-[13px] font-bold rounded-lg border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:border-orange-400 transition-all whitespace-nowrap shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="9" width="3" height="8"/><rect x="13" y="5" width="3" height="12"/></svg>
                <span className="hidden sm:inline">주문순위</span>
              </button>
              )}
              {/* 뷰 전환 버튼 — 팝업(W주문)은 캘린더 고정 + 이미지·타임라인은 드롭다운(새 창으로 열기) */}
              {isPopup ? (
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
                  <span className="px-2 py-0.5 text-[13px] font-semibold rounded-md bg-[#1a1a1a] text-white whitespace-nowrap">⊞<span className="hidden sm:inline"> 캘린더</span></span>
                  <select value="" aria-label="뷰 변경 (새 창)"
                    onChange={e => {
                      const v = e.target.value;
                      if (!v) return;
                      // 새 창(탭 아님)으로 전체 페이지를 연다. popup 파라미터는 붙이지 않는다.
                      window.open(`${window.location.origin}/arrival${v === "timeline" ? "?view=timeline" : ""}`, "arrival_full", "width=1280,height=900,scrollbars=yes,resizable=yes");
                    }}
                    className="max-w-[110px] cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-[13px] font-semibold text-gray-600 focus:outline-none">
                    <option value="" hidden>뷰 변경</option>
                    <option value="grid">▦ 이미지 (새 창)</option>
                    <option value="timeline">↓ 타임라인 (새 창)</option>
                  </select>
                </div>
              ) : (
              <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
                <button onClick={() => setViewMode("grid")}
                  className={`px-2 py-0.5 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "grid" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ▦<span className="hidden sm:inline"> 이미지</span>
                </button>
                <button onClick={() => setViewMode("timeline")}
                  className={`px-2 py-0.5 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "timeline" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ↓<span className="hidden sm:inline"> 타임라인</span>
                </button>
                {/* 간트 버튼: 개선 예정, 임시 비노출 */}
                {false && <button onClick={() => setViewMode("gantt")} className="hidden">▬ 간트</button>}
                <button onClick={() => setViewMode("calendar")}
                  className={`px-2 py-0.5 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "calendar" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ⊞<span className="hidden sm:inline"> 캘린더</span>
                </button>
              </div>
              )}
            </div>
          {/* 로그인/로그아웃 — 이미지 뷰. PC는 상단바 한 줄의 맨 끝(겹침 방지), 모바일은 바 위쪽 */}
          {(viewMode === "grid" || (viewMode === "calendar" && !isPopup)) && (
            <div className="max-sm:absolute max-sm:right-3 max-sm:-top-0.5 max-sm:-translate-y-full sm:relative sm:order-8 sm:shrink-0">
              <button type="button"
                onClick={() => loggedIn ? doLogout() : setLoginOpen(v => !v)}
                className="text-[10px] leading-none px-1 py-0.5 text-gray-300 hover:text-gray-600 transition-colors">
                {loggedIn ? "로그아웃" : "로그인"}
              </button>
              {loginOpen && !loggedIn && (
                <form onSubmit={submitLogin} className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 flex flex-col gap-1.5 z-40">
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="이메일" autoComplete="username"
                    className="border border-gray-200 rounded-md px-2 py-1.5 text-[14px] focus:outline-none focus:border-[#1a1a1a]" />
                  <input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} placeholder="비밀번호" autoComplete="current-password"
                    className="border border-gray-200 rounded-md px-2 py-1.5 text-[14px] focus:outline-none focus:border-[#1a1a1a]" />
                  {loginError && <p className="text-[12px] text-red-500">{loginError}</p>}
                  <button type="submit" disabled={loginBusy}
                    className="bg-[#1a1a1a] text-white text-[13px] font-semibold rounded-md py-1.5 disabled:opacity-50">
                    {loginBusy ? "확인 중…" : "로그인"}
                  </button>
                </form>
              )}
            </div>
          )}
          </div>

          {/* ── 모바일: 마케팅/이번주 체크박스는 필터 펼치기와 무관하게 항상 노출 ── */}
          <div className="sm:hidden mt-2 flex items-center gap-2 flex-wrap">
            {isAdmin && viewMode !== "calendar" && <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 rounded-lg px-2.5 py-1.5">
              <input type="checkbox" checked={filterMarketing} onChange={e => setFilterMarketing(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
              <span className={`text-[14px] font-semibold ${filterMarketing ? "text-blue-500" : "text-gray-500"}`}>마케팅 활용</span>
            </label>}
            {viewMode === "calendar" && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 rounded-lg px-2.5 py-1.5">
                <input type="checkbox" checked={filterThisWeek} onChange={e => setFilterThisWeek(e.target.checked)}
                  className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" />
                <span className={`text-[14px] font-semibold ${filterThisWeek ? "text-orange-500" : "text-gray-500"}`}>
                  이번주 입고 예정 품목
                </span>
              </label>
            )}
          </div>

          {/* ── Row 2: 모바일 펼침 필터 ── */}
          {filterOpen && (
            <div className="sm:hidden mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">브랜드</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">카테고리</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterSize} onChange={e => setFilterSize(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">사이즈</option>
                {sizes.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">상태</option>
                <option value="입고예정">입고예정</option>
                <option value="입고완료">입고완료</option>
                <option value="일정미표기">일정미정</option>
              </select>
              <div className="flex items-center gap-2 w-full flex-wrap">
                {hasFilter && (
                  <button onClick={resetFilters} className="text-[14px] text-gray-400 hover:text-[#1a1a1a] underline underline-offset-2 font-medium">초기화</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className={`${PAGE_X_PAD} pt-1 pb-4`}>
        {filtered.length === 0 ? (
          <div className="py-32 text-center">
            <p className="text-[15px] text-gray-400">조건에 맞는 상품이 없습니다.</p>
            <button onClick={resetFilters} className="mt-3 text-[14px] text-[#1a1a1a] underline underline-offset-2">필터 초기화</button>
          </div>
        ) : viewMode === "grid" ? (
          <GridView grouped={grouped} groupMode={groupMode} onSelect={setSelectedProduct} showMarketing={isAdmin && filterMarketing} showRates={isAdmin} ranks={isAdmin ? salesRanks : undefined} sortLabel={sortKey === "sales" ? "판매량순" : sortKey === "order" ? "주문량순" : ""} qtyMode={isAdmin && !!sortKey} />
        ) : viewMode === "timeline" ? (
          <TimelineView products={filtered} onSelect={setSelectedProduct} showMarketing={isAdmin && filterMarketing} showRates={isAdmin} />
        ) : viewMode === "gantt" ? (
          <GanttView products={filtered} onSelect={setSelectedProduct} showMarketing={isAdmin && filterMarketing} />
        ) : (
          <CalendarView products={filtered} onSelect={setSelectedProduct} showMarketing={false} thisWeekRange={thisWeekRange} filterThisWeek={filterThisWeek} openOrderLink={openOrderLink} syncLabel={lastSync ? `${new Date(lastSync).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} 기준` : undefined} />
        )}
      </div>

      {isAdmin && showRank && (
        <OrderRankModal products={filtered} onClose={() => setShowRank(false)} onSelect={setSelectedProduct} />
      )}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} openOrderLink={openOrderLink} isAdmin={isAdmin} />
      )}
    </div>
  );
}
