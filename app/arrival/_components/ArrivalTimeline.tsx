"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ArrivalProduct, ArrivalStatus } from "@/lib/arrival";

// ─── 유틸 ────────────────────────────────────────────────────────────────────
const MONTH_KO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_KO   = ["일","월","화","수","목","금","토"];
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
  "켄타":        "bg-[#1a56db]",   // 로열 블루       hue 225
  "디트로잇":    "bg-[#cc0000]",   // 선명 레드       hue 0
  "GRBD":        "bg-[#009b3a]",   // 선명 그린       hue 132
  "K-WORKERS":   "bg-[#5e17eb]",   // 바이올렛        hue 264
  "덴버":        "bg-[#cc0077]",   // 마젠타/핫핑크   hue 330
  "디월트":      "bg-[#ffd700]",   // 선명 옐로       hue 51
  "매드독캠프":  "bg-[#007660]",   // 다크 틸         hue 165
  "모디뜨":      "bg-[#e74694]",   // 핑크            hue 335
  "몬스톤":      "bg-[#60a5fa]",   // 라이트 블루      hue 213
  "볼컴":        "bg-[#ff7700]",   // 선명 오렌지     hue 29
  "블랙스미스":  "bg-[#884400]",   // 브라운          hue 30 (dark)
  "블랙아머":    "bg-[#1f1f3a]",   // 다크 네이비     near black
  "유니보스":    "bg-[#00b4cc]",   // 아쿠아/시안     hue 186
  "이글서플라이":"bg-[#e6a817]",   // 앰버/골드       hue 43
  "프레파라트":  "bg-[#7cb900]",   // 라임 그린       hue 81
};

const BRAND_BG_HEX: Record<string, string> = {
  "켄타":        "#1a56db",
  "디트로잇":    "#cc0000",
  "GRBD":        "#009b3a",
  "K-WORKERS":   "#5e17eb",
  "덴버":        "#cc0077",
  "디월트":      "#ffd700",
  "매드독캠프":  "#007660",
  "모디뜨":      "#e74694",
  "몬스톤":      "#60a5fa",
  "볼컴":        "#ff7700",
  "블랙스미스":  "#884400",
  "블랙아머":    "#1f1f3a",
  "유니보스":    "#00b4cc",
  "이글서플라이":"#e6a817",
  "프레파라트":  "#7cb900",
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
  const prefix = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[_\\s]+`, "i");
  return name.replace(prefix, "").trim() || name;
}

function fmtPrice(n: number) {
  return n > 0 ? n.toLocaleString("ko-KR") + "원" : "—";
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
  일정미표기: { label: "일정미표기", cls: "bg-gray-100 text-gray-500" },
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
        <span className="text-[10px] tracking-widest text-gray-500 font-mono uppercase">{product.productCode}</span>
        <div className="w-6 h-px bg-gray-300" />
        <span className="text-[10px] tracking-widest text-gray-400 uppercase">no image</span>
      </div>
    );
  }
  return (
    <img src={src} alt={product.productName}
      className={`w-full ${aspectCls} object-cover bg-white`}
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
        <span className="text-[10px] tracking-widest text-gray-500 font-mono uppercase">{product.productCode}</span>
        <div className="w-6 h-px bg-gray-300" />
        <span className="text-[10px] tracking-widest text-gray-400 uppercase">no image</span>
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
            className="shrink-0 w-9 h-9 bg-white border border-gray-200 hover:border-gray-400 rounded-full flex items-center justify-center text-[20px] text-gray-600 hover:text-[#1a1a1a] shadow-sm transition-all">
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
              onError={() => markFailed(index)}
            />
          )}
          {images.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/40 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
              {index + 1} / {images.length}
            </div>
          )}
        </div>

        {/* 오른쪽 화살표 (이미지 바깥) */}
        {images.length > 1 ? (
          <button onClick={next}
            className="shrink-0 w-9 h-9 bg-white border border-gray-200 hover:border-gray-400 rounded-full flex items-center justify-center text-[20px] text-gray-600 hover:text-[#1a1a1a] shadow-sm transition-all">
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
function ProductModal({ product, onClose }: { product: ArrivalProduct; onClose: () => void }) {
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
              className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-[#1a1a1a] transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
            >
              {copied ? <span className="text-green-600">복사됨</span> : <span>공유</span>}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-0 sm:items-start">
            {/* 이미지 영역 */}
            <div className="w-full sm:w-[520px] shrink-0">
              <div className="relative px-3 pt-1 pb-1 sm:px-4 sm:pt-4 sm:pb-4">
                <ImageGallery product={product} aspectCls="aspect-square sm:aspect-[3/4]" />
                {product.marketingUsage && (
                  <span className="sm:hidden absolute top-4 left-6 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow">
                    마케팅
                  </span>
                )}
              </div>
            </div>

            {/* 정보 영역 */}
            <div className="flex-1 flex flex-col gap-1.5 sm:gap-3 px-3 sm:px-4 sm:pr-6 pb-3 sm:pb-6 pt-0.5 sm:pt-4 min-w-0 sm:border-l sm:border-gray-100">

            {/* ── PC 레이아웃 (sm: 이상) ── */}
            <div className="hidden sm:block">
              <p className="text-[11px] tracking-[0.2em] text-gray-400 uppercase font-semibold mb-1">{product.brand}</p>
              <h2 className="text-[22px] font-bold text-[#1a1a1a] leading-snug mb-4">{product.productName}</h2>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap w-24 align-middle">상태</td>
                    <td className="py-2.5 align-middle"><span className={`inline-block text-[12px] px-2.5 py-1 rounded-full font-bold ${meta.cls}`}>{meta.label}</span></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">코드</td>
                    <td className="py-2.5 font-mono text-[13px] text-[#1a1a1a] align-middle">{product.productCode}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">카테고리</td>
                    <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{product.category || "—"}</td>
                  </tr>
                  {product.productType && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">상품구분</td>
                      <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{product.productType}</td>
                    </tr>
                  )}
                  {product.newArrivalType && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">신상구분</td>
                      <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{product.newArrivalType}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">컬러</td>
                    <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{product.color || "—"}</td>
                  </tr>
                  {product.size && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">사이즈</td>
                      <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{product.size}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">공급가</td>
                    <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{product.supplyPrice && product.supplyPrice > 0 ? fmtPrice(product.supplyPrice) : "—"}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">판매가</td>
                    <td className="py-2.5 text-[13px] font-bold text-[#1a1a1a] align-middle">{product.price > 0 ? fmtPrice(product.price) : "—"}</td>
                  </tr>
                  {product.quantity != null && product.quantity > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">수량</td>
                      <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle font-semibold">{product.quantity.toLocaleString("ko-KR")}개</td>
                    </tr>
                  )}
                  <tr className="last:border-0">
                    <td className="py-2.5 pr-4 text-[11px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">입고일</td>
                    <td className="py-2.5 text-[13px] text-[#1a1a1a] align-middle">{full}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── 모바일 레이아웃 (sm: 미만) ── */}
            <div className="sm:hidden">
              <h2 className="text-[15px] font-bold text-[#1a1a1a] leading-snug mb-1.5">{product.productName}</h2>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap w-[72px] align-middle">브랜드/코드</td>
                    <td className="py-1 text-[11px] text-[#1a1a1a] align-middle">
                      <span className="font-semibold">{product.brand}</span>
                      {product.productCode && <span className="text-gray-300 mx-1">|</span>}
                      <span className="font-mono text-gray-500">{product.productCode}</span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">상태</td>
                    <td className="py-1 text-[11px] align-middle">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#1a1a1a]">{full}</span>
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-bold ${meta.cls}`}>{meta.label}</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">카테고리</td>
                    <td className="py-1 text-[11px] text-[#1a1a1a] align-middle">{product.category || "—"}</td>
                  </tr>
                  {(product.productType || product.newArrivalType) && (
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">구분</td>
                      <td className="py-1 text-[11px] text-[#1a1a1a] align-middle">{[product.productType, product.newArrivalType].filter(Boolean).join(" / ")}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">컬러</td>
                    <td className="py-1 text-[11px] text-[#1a1a1a] align-middle">{product.color || "—"}</td>
                  </tr>
                  {product.size && (
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">사이즈</td>
                      <td className="py-1 text-[11px] text-[#1a1a1a] align-middle">{product.size}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">공급/판매가</td>
                    <td className="py-1 text-[11px] text-[#1a1a1a] align-middle">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-gray-500">{product.supplyPrice && product.supplyPrice > 0 ? fmtPrice(product.supplyPrice) : "—"}</span>
                        <span className="text-gray-300">/</span>
                        <span className="font-bold">{product.price > 0 ? fmtPrice(product.price) : "—"}</span>
                      </div>
                    </td>
                  </tr>
                  {product.quantity != null && product.quantity > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-[10px] tracking-widest text-gray-400 uppercase font-semibold whitespace-nowrap align-middle">수량</td>
                      <td className="py-1 text-[11px] text-[#1a1a1a] align-middle font-semibold">{product.quantity.toLocaleString("ko-KR")}개</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {product.marketingUsage && (
              <div className="hidden sm:block border border-orange-300 bg-orange-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-widest text-orange-400 uppercase font-bold shrink-0">마케팅</span>
                  <span className="text-[13px] text-orange-700 font-semibold">{product.marketingUsage}</span>
                </div>
              </div>
            )}

            {product.description && (
              <div>
                <p className="text-[11px] tracking-widest text-gray-400 uppercase font-semibold mb-2">설명</p>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.description.replace(/\\n/g, "\n")}
                </p>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <p className="text-[11px] tracking-widest text-gray-400 uppercase font-semibold mb-2">변경 이력</p>
                <div className="space-y-2">
                  {history.slice().reverse().map((h, i) => (
                    <div key={i} className="text-[13px] bg-gray-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="line-through">{h.previousDate}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-[#1a1a1a]">{h.newDate}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{h.reason}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{new Date(h.changedAt).toLocaleString("ko-KR")}</p>
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
type ViewMode  = "grid" | "list" | "calendar" | "timeline" | "gantt";
type GroupMode = "date" | "month" | "category" | "brand";

// ─── 상품 카드 (그리드용) ─────────────────────────────────────────────────────
function ProductCard({ product, onSelect, showDate, showMarketing }: { product: ArrivalProduct; onSelect: () => void; showDate?: boolean; showMarketing?: boolean }) {
  const meta = STATUS_META[product.status] ?? STATUS_META["입고예정"];
  const { full } = fmtDate(product.arrivalDate);
  return (
    <button onClick={onSelect}
      className="text-left transition-opacity hover:opacity-80 flex flex-col">
      <div className={`relative w-full overflow-hidden rounded-sm border ${showMarketing && product.marketingUsage ? "border-orange-400 border-2" : "border-[#979797]"}`}>
        <ProductImage product={product} size="sm" />
        {product.newArrivalType === "재진행" && (
          <span
            className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[10px] font-bold flex items-center justify-center leading-none shadow"
            title="재진행 상품"
          >
            R
          </span>
        )}
      </div>
      <div className="pt-2 flex flex-col gap-1 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] tracking-wider text-gray-500 uppercase truncate font-medium">{product.brand}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${meta.cls}`}>{meta.label}</span>
        </div>
        <p className="text-[12px] font-semibold text-[#1a1a1a] leading-tight line-clamp-2 flex-1">{stripBrand(product.productName, product.brand)}</p>
        {showDate && product.arrivalDate ? (
          <div className="text-[11px] text-gray-600 flex items-center justify-between gap-1 mt-auto">
            <span className="truncate">{full}</span>
            {product.price > 0 && <span className="font-medium text-[#1a1a1a] whitespace-nowrap shrink-0">{fmtPrice(product.price)}</span>}
          </div>
        ) : (
          <p className="text-[11px] text-gray-600 font-medium text-right mt-auto">{fmtPrice(product.price)}</p>
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
      className="inline-flex items-center gap-1.5 text-[11px] text-[#1a1a1a] bg-gray-100 hover:bg-[#1a1a1a] hover:text-white border border-gray-300 hover:border-[#1a1a1a] rounded-md px-3 py-1 transition-all ml-2 font-semibold shrink-0"
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
function GroupHeader({ groupKey, groupMode, count }: { groupKey: string; groupMode: GroupMode; count: number }) {
  if (groupMode === "date") {
    const { mm, dd, day, month } = fmtDate(groupKey);
    return (
      <div className="flex items-baseline gap-3 mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[20px] font-black text-[#1a1a1a] tracking-tighter leading-none">{mm}.{dd}</span>
          <span className="text-[12px] tracking-[0.12em] text-gray-600 uppercase font-semibold">{day}</span>
          <span className="text-[12px] text-gray-500">{month}</span>
        </div>
        <span className="text-[12px] text-gray-500 font-medium">{count}개</span>
      </div>
    );
  }
  if (groupMode === "month") {
    const label = groupKey === "미정" ? "일정 미정" : monthKeyLabel(groupKey);
    return (
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-[18px] font-black text-[#1a1a1a] tracking-tight leading-none">{label}</span>
        <span className="text-[12px] text-gray-500 font-medium">{count}개</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[16px] font-black text-[#1a1a1a] tracking-tight leading-none uppercase">{groupKey || "미분류"}</span>
      {groupMode === "brand" && groupKey && groupKey !== "미분류" && <BrandCatalogLink brand={groupKey} />}
      <span className="text-[12px] text-gray-500 font-medium ml-auto">{count}개</span>
    </div>
  );
}

// ─── 그리드 뷰 ───────────────────────────────────────────────────────────────
function GridView({ grouped, groupMode, onSelect, showMarketing }: {
  grouped: [string, ArrivalProduct[]][]; groupMode: GroupMode; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
}) {
  const collapsible = groupMode === "category" || groupMode === "brand";
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
                  <span className="text-[16px] font-black text-[#1a1a1a] tracking-tight leading-none uppercase">{key || "미분류"}</span>
                  <span className="text-[12px] text-gray-500 font-medium">{items.length}개</span>
                  <span className="ml-auto text-[11px] text-gray-400 group-hover:text-gray-600">{isCollapsed ? "▼ 펼치기" : "▲ 접기"}</span>
                </button>
                {groupMode === "brand" && key && key !== "미분류" && <BrandCatalogLink brand={key} />}
              </div>
            ) : (
              <GroupHeader groupKey={key} groupMode={groupMode} count={items.length} />
            )}
            {!isCollapsed && (
              <div className={GRID_COLS}>
                {items.map((p, i) => <ProductCard key={`${p.productCode}_${p.arrivalDate || "none"}_${i}`} product={p} onSelect={() => onSelect(p)} showDate={groupMode !== "date"} showMarketing={showMarketing} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 리스트 뷰 ───────────────────────────────────────────────────────────────
function ListView({ grouped, groupMode, onSelect, showMarketing }: {
  grouped: [string, ArrivalProduct[]][]; groupMode: GroupMode; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
}) {
  const collapsible = groupMode === "category" || groupMode === "brand";
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div className="space-y-1">
      {grouped.map(([key, items]) => {
        const isCollapsed = collapsible && collapsed.has(key);
        return (
        <div key={key} id={`group-${key}`}>
          <div
            className={`flex items-center gap-3 px-4 py-2.5 bg-gray-100 rounded-lg mb-1 ${collapsible ? "cursor-pointer hover:bg-gray-200/60" : ""}`}
            onClick={collapsible ? () => toggle(key) : undefined}
          >
            {groupMode === "date" ? (
              <>
                <span className="text-[14px] font-black text-[#1a1a1a]">{fmtDate(key).mm}.{fmtDate(key).dd}</span>
                <span className="text-[12px] text-gray-600 uppercase font-semibold">{fmtDate(key).day}</span>
              </>
            ) : groupMode === "month" ? (
              <span className="text-[14px] font-black text-[#1a1a1a]">{key === "미정" ? "일정 미정" : monthKeyLabel(key)}</span>
            ) : (
              <span className="text-[14px] font-black text-[#1a1a1a] uppercase">{key || "미분류"}</span>
            )}
            {groupMode === "brand" && key && key !== "미분류" && <BrandCatalogLink brand={key} />}
            <span className="text-[12px] text-gray-600 font-medium ml-auto">{items.length}개</span>
            {collapsible && <span className="text-[11px] text-gray-400">{isCollapsed ? "▼" : "▲"}</span>}
          </div>
          {!isCollapsed && <div className="space-y-px mb-6">
            {items.map(p => {
              const meta = STATUS_META[p.status] ?? STATUS_META["입고예정"];
              const { full, day } = fmtDate(p.arrivalDate);
              const history = p.changeHistory ?? [];
              return (
                <div key={`${p.productCode}_${p.arrivalDate || "none"}`}
                  className={`bg-white rounded-lg overflow-hidden ${showMarketing && p.marketingUsage ? "border-2 border-orange-400" : "border border-gray-100"}`}>
                  {/* 상단 요약 행 */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 font-medium mb-0.5">
                        {p.brand}
                        {p.color && <span className="ml-2 text-gray-400">·</span>}
                        {p.color && <span className="ml-1 text-gray-400">{p.color}</span>}
                      </p>
                      <p className="text-[15px] font-bold text-[#1a1a1a] leading-tight">{stripBrand(p.productName, p.brand)}</p>
                    </div>
                    <button onClick={() => onSelect(p)}
                      className="shrink-0 text-[11px] text-gray-400 hover:text-[#1a1a1a] border border-gray-200 hover:border-gray-400 rounded-full px-3 py-1 transition-colors">
                      상세보기
                    </button>
                  </div>

                  {/* 스펙 그리드 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">코드</p>
                      <p className="text-[12px] text-gray-700 font-mono">{p.productCode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">입고일</p>
                      <p className="text-[13px] text-gray-800 font-semibold flex items-center justify-between">
                        <span>{full}</span>
                        {p.price > 0 && <span className="text-[#1a1a1a]">{fmtPrice(p.price)}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">카테고리</p>
                      <p className="text-[12px] text-gray-700">{p.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">공급가</p>
                      <p className="text-[13px] text-gray-700 font-semibold">{p.supplyPrice ? fmtPrice(p.supplyPrice) : "—"}</p>
                    </div>
                    {p.color && (
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">컬러</p>
                        <p className="text-[12px] text-gray-700">{p.color}</p>
                      </div>
                    )}
                  </div>

                  {/* 상세 설명 */}
                  {p.description && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">상세 설명</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">
                        {p.description.replace(/\\n/g, "\n")}
                      </p>
                    </div>
                  )}

                  {/* 변경 이력 */}
                  {history.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-amber-50/50">
                      <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider mb-2">입고일 변경 이력</p>
                      <div className="space-y-1.5">
                        {history.slice().reverse().map((h, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 text-[12px]">
                            <span className="text-gray-400 line-through">{h.previousDate}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-semibold text-[#1a1a1a]">{h.newDate}</span>
                            {h.reason && <span className="text-gray-600">· {h.reason}</span>}
                            <span className="text-[11px] text-gray-400 ml-auto">{new Date(h.changedAt).toLocaleDateString("ko-KR")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
        </div>
        );
      })}
    </div>
  );
}

// ─── 캘린더 셀 미니 썸네일 ──────────────────────────────────────────────────
function MiniThumb({ product }: { product: ArrivalProduct }) {
  const images = parseImages(product);
  const src = images[0] ?? (product.image ? product.image : null);
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    return (
      <div className="absolute inset-0 bg-[#edebe8] flex items-center justify-center">
        <span className="text-[5px] text-gray-400 font-mono uppercase">no</span>
      </div>
    );
  }
  return (
    <img src={src} alt={product.productName}
      className="absolute inset-0 w-full h-full object-cover"
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
            const supplyTxt   = p.supplyPrice && p.supplyPrice > 0 ? `공급 ${p.supplyPrice.toLocaleString("ko-KR")}` : "";
            const priceTxt    = p.price > 0 ? `판매 ${p.price.toLocaleString("ko-KR")}` : "";
            const priceLine   = [supplyTxt, priceTxt].filter(Boolean).join(" / ");
            const qtyTxt      = p.quantity && p.quantity > 0 ? `수량 ${p.quantity.toLocaleString("ko-KR")}` : "";
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
                ${qtyTxt ? `<p class="pqty">${qtyTxt}</p>` : ""}
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
function CalendarView({ products, onSelect, showMarketing }: {
  products: ArrivalProduct[]; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
}) {
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

  const allDates = Array.from(dateMap.keys()).sort();
  if (allDates.length === 0) return (
    <div className="py-20 text-center text-gray-400 text-[14px]">표시할 데이터가 없습니다.</div>
  );

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

  useEffect(() => {
    const target = months.find(({ year, month }) => !isPast(year, month)) ?? months[months.length - 1];
    if (!target) return;
    const id = `cal-month-${target.year}-${target.month}`;
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="space-y-8">
      {/* 모바일 미지원 안내 */}
      <div className="sm:hidden bg-gray-100 border border-gray-200 rounded-xl px-4 py-4 text-center">
        <p className="text-[13px] font-semibold text-gray-600 mb-1">캘린더 보기는 PC에서만 지원됩니다</p>
        <p className="text-[12px] text-gray-400">모바일에서는 이미지, 타임라인, 리스트 보기를 이용해주세요</p>
      </div>

      {/* 안내 + PDF 버튼 */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[12px] text-gray-600 flex flex-col sm:flex-row gap-1 sm:gap-3">
          <span><strong className="text-[#1a1a1a]">상품 클릭</strong> → 상세 보기</span>
          <span className="text-gray-400 hidden sm:inline">|</span>
          <span><strong className="text-[#1a1a1a]">월 헤더</strong> → 접기 / 펼치기</span>
          <span className="text-gray-400 hidden sm:inline">|</span>
          <span className="text-gray-500 sm:hidden">좌우로 스크롤해 이미지를 볼 수 있습니다</span>
        </div>
        {/* PDF 버튼: PC 전용 */}
        <button
          onClick={handlePDF}
          className="hidden sm:flex items-center gap-1.5 shrink-0 border border-gray-300 hover:border-[#1a1a1a] text-[12px] font-semibold text-gray-700 hover:text-[#1a1a1a] px-4 py-2.5 rounded-xl transition-colors bg-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          PDF 다운로드
        </button>
      </div>

      {months.map(({ year, month }) => {
        const monthKey = `${year}-${month}`;
        const isCollapsed = collapsed.has(monthKey);
        const past = isPast(year, month);

        const monthTotal = allDates.filter(d => {
          const dd = parseDate(d);
          return dd && dd.getFullYear() === year && dd.getMonth() === month;
        }).reduce((sum, d) => sum + (dateMap.get(d)?.length ?? 0), 0);

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month+1, 0).getDate();
        const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
        while (cells.length % 7 !== 0) cells.push(null);
        // 주 단위로 분리 후 입고 없는 주 제거
        const weeks: (number|null)[][] = [];
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

        return (
          <div key={monthKey} id={`cal-month-${year}-${month}`} className="hidden sm:block">
            {/* 월 헤더 */}
            <button onClick={() => toggleCollapse(monthKey)}
              className="w-full flex items-center gap-3 mb-3 group text-left">
              <span className={`text-[14px] tracking-[0.1em] uppercase font-bold transition-colors ${past ? "text-gray-400" : "text-gray-700"} group-hover:text-gray-900`}>
                {year}. {MONTH_KO[month]}
              </span>
              {monthTotal > 0 && (
                <span className={`text-[12px] px-2 py-0.5 rounded-full font-semibold ${past ? "bg-gray-100 text-gray-500" : "bg-[#1a1a1a]/10 text-gray-700"}`}>
                  {monthTotal}개
                </span>
              )}
              <span className={`ml-auto text-[12px] font-medium ${past ? "text-gray-400" : "text-gray-500"} group-hover:text-gray-700`}>
                {isCollapsed ? "▼ 펼치기" : "▲ 접기"}
              </span>
            </button>

            {isCollapsed ? (
              <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                {allDates
                  .filter(d => { const dd = parseDate(d); return dd && dd.getFullYear() === year && dd.getMonth() === month; })
                  .map(d => {
                    const { dd: dayNum } = fmtDate(d);
                    const count = dateMap.get(d)?.length ?? 0;
                    return (
                      <span key={d} className="text-[12px] text-gray-600 border border-gray-200 rounded px-2 py-0.5 font-medium">
                        {dayNum}일 {count}개
                      </span>
                    );
                  })}
                {monthTotal === 0 && <span className="text-[12px] text-gray-400">입고 스케쥴 없음</span>}
              </div>
            ) : (
              <>
                {/* ── 모바일: 텍스트 전용 ─────────────────────────────────── */}
                <div className="sm:hidden">
                  <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
                    {DAY_KO.map(d => (
                      <div key={d} className="bg-gray-100 text-center text-[10px] text-gray-500 py-1.5 font-bold">{d}</div>
                    ))}
                    {cells.map((day, idx) => {
                      if (!day) return <div key={idx} className="bg-[#fafaf8] min-h-[3.5rem]" />;
                      const isoKey = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                      const items  = dateMap.get(isoKey) ?? [];
                      const hasItems = items.length > 0;
                      const completedAll = hasItems && items.every(p => p.status === "입고완료");
                      return (
                        <div key={idx} className="bg-white p-1 min-h-[3.5rem]">
                          <span className={`block text-[11px] font-black mb-0.5 ${hasItems && !completedAll ? "text-[#1a1a1a]" : "text-gray-300"}`}>
                            {day}
                          </span>
                          <div className="space-y-0.5">
                            {items.map(p => (
                              <button key={`${p.productCode}_${p.arrivalDate || "none"}`} onClick={() => onSelect(p)}
                                className="w-full text-left transition-opacity hover:opacity-70">
                                <p className="text-[8px] text-gray-800 leading-snug font-semibold line-clamp-2">{p.productName}</p>
                                <p className="text-[7px] text-gray-400 leading-none mt-px">{p.brand}</p>
                                {p.price > 0 && <p className="text-[7px] text-gray-500 leading-none mt-px">₩{p.price.toLocaleString("ko-KR")}</p>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── PC: 이미지 + 텍스트 (좌우 스크롤) ──────────────────── */}
                <div className="hidden sm:block overflow-x-auto">
                  <div className="min-w-[840px] space-y-px">
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-xl overflow-hidden border border-b-0 border-gray-200">
                      {DAY_KO.map(d => (
                        <div key={d} className="bg-gray-100 text-center text-[12px] text-gray-500 py-2 font-bold">{d}</div>
                      ))}
                    </div>
                    {/* 모든 주 렌더 (데이터 없는 주도 가로라인 표시) */}
                    {weeks.map((week, wi) => (
                      <div key={wi} className={`grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 ${wi === weeks.length - 1 ? "rounded-b-xl overflow-hidden" : ""}`}>
                        {week.map((day, di) => {
                          if (!day) return <div key={di} className="bg-[#fafaf8]" />;
                          const isoKey     = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                          const items      = dateMap.get(isoKey) ?? [];
                          const hasItems   = items.length > 0;
                          const completedAll = hasItems && items.every(p => p.status === "입고완료");
                          return (
                            <div key={di} className="bg-white p-1.5">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-[13px] font-black leading-none ${hasItems && !completedAll ? "text-[#1a1a1a]" : "text-gray-300"}`}>
                                  {day}
                                </span>
                                {items.length > 0 && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none
                                    ${completedAll ? "bg-gray-100 text-gray-400" : "bg-[#1a1a1a] text-white"}`}>
                                    {items.length}
                                  </span>
                                )}
                              </div>
                              {hasItems && (
                                <div className="divide-y divide-gray-100">
                                  {items.map(p => {
                                    const meta = STATUS_META[p.status] ?? STATUS_META["입고예정"];
                                    return (
                                      <button key={`${p.productCode}_${p.arrivalDate || "none"}`} onClick={() => onSelect(p)}
                                        className="w-full text-left transition-opacity hover:opacity-75 py-2 first:pt-0 last:pb-0">
                                        <div className={`relative w-full aspect-[3/4] overflow-hidden rounded-sm bg-[#f0efed] ${showMarketing && p.marketingUsage ? "ring-2 ring-orange-400" : ""}`}>
                                          <MiniThumb product={p} />
                                          {p.newArrivalType === "재진행" && (
                                            <span className="absolute top-1 left-1 z-10 w-4 h-4 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[8px] font-bold flex items-center justify-center leading-none shadow" title="재진행 상품">R</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 mt-1">
                                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded-sm leading-none shrink-0 ${meta.cls}`}>{meta.label}</span>
                                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded-sm leading-none truncate ${brandTextCls(p.brand)} ${brandBg(p.brand)}`}>{p.brand}</span>
                                        </div>
                                        <p className="text-[11px] font-semibold text-[#1a1a1a] leading-tight mt-0.5 line-clamp-2">{stripBrand(p.productName, p.brand)}</p>
                                        <div className="mt-0.5 space-y-0">
                                          {p.quantity != null && p.quantity > 0 && (
                                            <p className="text-[9px] text-gray-500">입고 <span className="font-semibold text-[#1a1a1a]">{p.quantity.toLocaleString("ko-KR")}</span></p>
                                          )}
                                          {p.orderQuantity != null && p.orderQuantity > 0 && (
                                            <p className="text-[9px] text-gray-500">
                                              주문 <span className="font-semibold text-[#1a1a1a]">{p.orderQuantity.toLocaleString("ko-KR")}</span>
                                              {p.quantity != null && p.quantity > 0 && (
                                                <span className="ml-1 font-bold text-blue-600">{Math.round((p.orderQuantity / p.quantity) * 100)}%</span>
                                              )}
                                            </p>
                                          )}
                                          {(p.supplyPrice != null && p.supplyPrice > 0) || p.price > 0 ? (
                                            <p className="text-[9px] text-gray-500 flex gap-1.5">
                                              {p.supplyPrice != null && p.supplyPrice > 0 && <span>공급가 <span className="font-semibold text-[#1a1a1a]">{p.supplyPrice.toLocaleString("ko-KR")}</span></span>}
                                              {p.price > 0 && <span>판매가 <span className="font-semibold text-[#1a1a1a]">{p.price.toLocaleString("ko-KR")}</span></span>}
                                            </p>
                                          ) : null}
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
    <div className="py-20 text-center text-gray-400 text-[14px]">표시할 데이터가 없습니다.</div>
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
      <table className="border-collapse text-[11px]" style={{ minWidth: `${140 + dates.length * 56}px` }}>
        <thead>
          {/* 월 헤더 */}
          <tr>
            <th className="w-[140px] min-w-[140px] bg-gray-50 border border-gray-200 px-3 py-2 text-left text-[10px] text-gray-400 font-semibold">브랜드</th>
            {monthGroups.map(mg => (
              <th key={mg.label} colSpan={mg.dates.length}
                className="bg-gray-50 border border-gray-200 px-2 py-2 text-center text-[10px] font-bold text-gray-600 whitespace-nowrap">
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
                  <span className={`block text-[11px] font-black ${isToday ? "text-red-500" : "text-gray-700"}`}>{mm}.{dd}</span>
                  <span className={`block text-[9px] font-medium ${isToday ? "text-red-400" : "text-gray-400"}`}>{dayKo}</span>
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
                  <span className="block text-[11px] leading-tight">{brand}</span>
                  <span className="block text-[9px] text-gray-400 font-normal">{brandTotal}개</span>
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
                    ? "bg-orange-50 border-orange-200"
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
                        <span className={`inline-flex items-center justify-center text-[10px] font-black rounded-full w-5 h-5 leading-none ${badgeCls}`}>
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
          <p className="text-[11px] font-bold text-gray-400 mb-2">일정 미정 ({undated.length}개)</p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map(p => (
              <button key={`${p.productCode}_none`} onClick={() => onSelect(p)}
                className="text-[10px] text-gray-500 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400 hover:text-gray-700 transition-colors">
                {p.brand} · {p.productName.slice(0, 14)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-5 mt-5 pt-4 border-t border-gray-100 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5"><span className="inline-flex w-5 h-5 rounded-full bg-[#1a1a1a] items-center justify-center text-white text-[9px] font-black">N</span>입고예정</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex w-5 h-5 rounded-full bg-gray-300 items-center justify-center text-gray-600 text-[9px] font-black">N</span>입고완료</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex w-5 h-5 rounded-full bg-orange-400 items-center justify-center text-white text-[9px] font-black">N</span>마케팅 활용</span>
      </div>
    </div>
  );
}

// ─── 타임라인 뷰 ─────────────────────────────────────────────────────────────
function TimelineView({ products, onSelect, showMarketing }: {
  products: ArrivalProduct[]; onSelect: (p: ArrivalProduct) => void; showMarketing?: boolean;
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

  if (byMonth.length === 0) return (
    <div className="py-20 text-center text-gray-400 text-[14px]">표시할 데이터가 없습니다.</div>
  );

  return (
    <div className="space-y-6 overflow-x-hidden">
      {byMonth.map(({ mKey, label, dates, total }) => {
        const isCollapsed = collapsedMonths.has(mKey);
        return (
          <div key={mKey}>
            {/* 월 헤더 */}
            <button
              onClick={() => toggleMonth(mKey)}
              className="w-full flex items-center gap-2 mb-4 group text-left"
            >
              <span className="sm:hidden text-[11px] font-black text-gray-700 tracking-wide group-hover:text-[#1a1a1a]">{mKey === "미정" ? "일정 미정" : monthKeyLabelShort(mKey)}</span>
              <span className="hidden sm:inline text-[13px] font-black text-gray-700 tracking-wide group-hover:text-[#1a1a1a]">{label}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">{total}개</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${isCollapsed ? "bg-[#1a1a1a] text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"}`}>{isCollapsed ? "▼ 펼치기" : "▲ 접기"}</span>
            </button>

            {isCollapsed ? (
              <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                {dates.map(([dateKey, items]) => {
                  const { dd } = fmtDate(dateKey);
                  return (
                    <span key={dateKey} className="text-[12px] text-gray-600 border border-gray-200 rounded px-2 py-0.5 font-medium">
                      {dd}일 {items.length}개
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="relative">
                {/* 세로 연결선: 날짜열(3.5rem) + 도트열(1.5rem) 절반 */}
                <div className="absolute left-[3.25rem] sm:left-[5rem] top-2 bottom-2 w-px bg-gray-200 pointer-events-none" />

                <div className="space-y-5">
                  {dates.map(([dateKey, items]) => {
                    const { mm, dd, dayKo } = fmtDate(dateKey);
                    return (
                      <div key={dateKey} className="flex items-start gap-0">
                        {/* 날짜 레이블 열 */}
                        <div className="w-[2.5rem] sm:w-[4rem] shrink-0 flex flex-col items-end pr-1.5 pt-0.5">
                          <span className="text-[8px] sm:text-[15px] font-black text-[#1a1a1a] leading-none">{mm}.{dd}</span>
                          <span className="text-[8px] text-gray-500 font-semibold mt-0.5">{dayKo}요일</span>
                          <span className="text-[8px] text-gray-400">{items.length}개</span>
                        </div>

                        {/* 도트 열 */}
                        <div className="w-6 shrink-0 flex justify-center pt-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#303236] z-10 relative" />
                        </div>

                        {/* 상품 카드 가로 스크롤 */}
                        <div className="flex-1 min-w-0 overflow-x-auto pb-2 pl-1 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                          <div className="flex items-start gap-2.5" style={{ width: "max-content" }}>
                            {items.map(p => {
                              const meta = STATUS_META[p.status] ?? STATUS_META["입고예정"];
                              return (
                                <button
                                  key={`${p.productCode}_${p.arrivalDate || "none"}`}
                                  onClick={() => onSelect(p)}
                                  className="shrink-0 w-[96px] sm:w-[150px] text-left hover:opacity-75 transition-opacity"
                                >
                                  <div className={`w-[96px] sm:w-[108px] aspect-[3/4] border ${showMarketing && p.marketingUsage ? "border-orange-400 border-2" : "border-[#979797]"}`}>
                                    <div className="relative w-full h-full overflow-hidden bg-white">
                                      <MiniThumb product={p} />
                                      <span className={`absolute top-1 left-1 text-[7px] font-bold px-1 py-0.5 rounded leading-none ${meta.cls}`}>
                                        {meta.label}
                                      </span>
                                      {p.newArrivalType === "재진행" && (
                                        <span className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-[#ffd700] text-[#1a1a1a] text-[8px] font-bold flex items-center justify-center leading-none shadow" title="재진행 상품">R</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-1.5 space-y-0.5">
                                    <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${brandBg(p.brand)} ${brandTextCls(p.brand)}`}>
                                      {p.brand}
                                    </span>
                                    <p className="text-[10px] font-semibold text-[#1a1a1a] leading-tight line-clamp-2">
                                      {stripBrand(p.productName, p.brand)}
                                    </p>
                                    {p.quantity != null && p.quantity > 0 && (
                                      <p className="text-[9px] text-gray-500">입고 <span className="font-semibold text-[#1a1a1a]">{p.quantity.toLocaleString("ko-KR")}</span></p>
                                    )}
                                    {p.orderQuantity != null && p.orderQuantity > 0 && (
                                      <p className="text-[9px] text-gray-500">
                                        주문 <span className="font-semibold text-[#1a1a1a]">{p.orderQuantity.toLocaleString("ko-KR")}</span>
                                        {p.quantity != null && p.quantity > 0 && (
                                          <span className="ml-1 font-bold text-blue-600">{Math.round((p.orderQuantity / p.quantity) * 100)}%</span>
                                        )}
                                      </p>
                                    )}
                                    {((p.supplyPrice != null && p.supplyPrice > 0) || p.price > 0) && (
                                      <p className="text-[9px] text-gray-500 flex gap-1.5">
                                        {p.supplyPrice != null && p.supplyPrice > 0 && <span>공급가 <span className="font-semibold text-[#1a1a1a]">{p.supplyPrice.toLocaleString("ko-KR")}</span></span>}
                                        {p.price > 0 && <span>판매가 <span className="font-semibold text-[#1a1a1a]">{p.price.toLocaleString("ko-KR")}</span></span>}
                                      </p>
                                    )}
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

function OrderRankModal({ products, onClose, onSelect }: {
  products: ArrivalProduct[]; onClose: () => void; onSelect: (p: ArrivalProduct) => void;
}) {
  const [sortKey, setSortKey] = useState<RankSortKey>("orderRate");

  // 주문이 있는 상품만
  const ordered = useMemo(() => products.filter(p => (p.orderQuantity ?? 0) > 0), [products]);

  const rows = useMemo(() => {
    const val = (p: ArrivalProduct): number => {
      switch (sortKey) {
        case "orderRate": return pct(p.orderQuantity, p.quantity) ?? -1;
        case "salesRate": return pct(p.salesQuantity, p.quantity) ?? -1;
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
            <h2 className="text-[15px] font-black text-[#1a1a1a]">주문 순위</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              주문 {rows.length}개 · 입고 {totals.inQty.toLocaleString("ko-KR")} / 주문 {totals.orderQty.toLocaleString("ko-KR")}
              {totals.inQty > 0 && <span className="text-blue-600 font-bold"> ({Math.round(totals.orderQty / totals.inQty * 100)}%)</span>}
              {" "}/ 재고 {totals.stockQty.toLocaleString("ko-KR")} / 판매 {totals.salesQty.toLocaleString("ko-KR")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">×</button>
        </div>

        {/* 정렬 */}
        <div className="px-4 sm:px-6 py-2 border-b border-gray-100 flex items-center gap-1 text-[11px] font-semibold overflow-x-auto shrink-0">
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
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
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
                const oRate = pct(p.orderQuantity, p.quantity);
                const sRate = pct(p.salesQuantity, p.quantity);
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
                            <span className={`inline-block text-[8px] font-bold px-1 py-0.5 rounded-sm leading-none ${brandBg(p.brand)} ${brandTextCls(p.brand)}`}>{p.brand}</span>
                            {p.newArrivalType === "재진행" && (
                              <span className="inline-block text-[8px] font-bold px-1 py-0.5 rounded-sm leading-none bg-[#ffd700] text-[#1a1a1a]" title="재진행 상품">재진행</span>
                            )}
                          </span>
                          <p className="text-[12px] font-semibold text-[#1a1a1a] leading-tight truncate">{stripBrand(p.productName, p.brand)}</p>
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
          {rows.length === 0 && <div className="py-16 text-center text-gray-400 text-[13px]">표시할 상품이 없습니다.</div>}
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

  const [viewMode,  setViewMode]  = useState<ViewMode>("grid");
  const [groupMode, setGroupMode] = useState<GroupMode>("month");

  const [filterBrand,     setFilterBrand]     = useState("all");
  const [filterCategory,  setFilterCategory]  = useState("all");
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [filterNewArrival, setFilterNewArrival] = useState("all"); // all / 신규 / 재진행
  const [searchQuery,     setSearchQuery]     = useState("");
  const [filterMarketing, setFilterMarketing] = useState(false);
  const [filterOpen,      setFilterOpen]      = useState(false);

  useEffect(() => {
    fetch("/api/arrival")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProducts(data); })
      .finally(() => setLoadingData(false));
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
  const newArrivalTypes = useMemo(() => Array.from(new Set(products.map(p => p.newArrivalType).filter(Boolean))).sort() as string[], [products]);
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
        if (filterStatus   !== "all" && p.status   !== filterStatus)   return false;
        if (filterNewArrival !== "all" && (p.newArrivalType ?? "") !== filterNewArrival) return false;
        if (filterMarketing && !p.marketingUsage) return false;
        if (q && !p.productName.toLowerCase().includes(q) && !p.productCode.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = a.arrivalDate || "9999-99-99";
        const db = b.arrivalDate || "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        return (a.brand || "").localeCompare(b.brand || "");
      });
  }, [products, filterBrand, filterCategory, filterStatus, filterNewArrival, filterMarketing, searchQuery]);

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
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [filtered, groupMode]);

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
    setFilterBrand("all"); setFilterCategory("all");
    setFilterStatus("all"); setFilterNewArrival("all"); setSearchQuery(""); setFilterMarketing(false);
  }, []);
  const hasFilter = filterBrand !== "all" || filterCategory !== "all" || filterStatus !== "all" || filterNewArrival !== "all" || searchQuery !== "" || filterMarketing;

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[12px] tracking-[0.2em] text-gray-400 uppercase">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* ── 필터 + 뷰 전환 (sticky) ── */}
      <div className="sticky top-0 z-30 px-3 sm:px-8 lg:px-14 pt-3 pb-1.5 bg-[#fafaf8]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2">

          {/* ── Row 1: 타이틀 / 검색 / 필터토글(모바일) / 뷰버튼 / 개수 ── */}
          <div className="flex items-center gap-1.5">
            {/* 타이틀 (모바일에서 검색 왼쪽) */}
            <span className="text-[13px] font-black text-[#1a1a1a] tracking-tight shrink-0 mr-1 hidden sm:block">입고 스케쥴</span>

            {/* 검색 */}
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="상품명 / 코드"
              className="border border-gray-200 px-2.5 py-1 text-[12px] rounded-lg focus:outline-none focus:border-[#1a1a1a] w-full sm:w-40 text-gray-800 placeholder:text-gray-400 min-w-0" />

            {/* 모바일 필터 토글 버튼 */}
            <button
              onClick={() => setFilterOpen(v => !v)}
              className={`sm:hidden flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold rounded-lg border transition-all shrink-0 ${
                filterOpen || hasFilter ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-gray-200 text-gray-600"
              }`}>
              필터{hasFilter ? ` (${[filterBrand!=="all",filterCategory!=="all",filterStatus!=="all",filterNewArrival!=="all",filterMarketing].filter(Boolean).length})` : ""}
            </button>

            {/* 데스크탑 인라인 필터 */}
            <div className="hidden sm:flex items-center gap-1.5 flex-1">
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-200 px-2 py-1 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700">
                <option value="all">브랜드</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="border border-gray-200 px-2 py-1 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700">
                <option value="all">카테고리</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-200 px-2 py-1 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700">
                <option value="all">상태</option>
                <option value="입고예정">입고예정</option>
                <option value="입고완료">입고완료</option>
                <option value="입고지연">입고지연</option>
                <option value="일정미정">일정미정</option>
              </select>
              {newArrivalTypes.length > 0 && (
                <select value={filterNewArrival} onChange={e => setFilterNewArrival(e.target.value)}
                  className="border border-gray-200 px-2 py-1 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700">
                  <option value="all">신상구분</option>
                  {newArrivalTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <label className="flex items-center gap-1 cursor-pointer select-none bg-gray-50 rounded-lg px-2 py-1">
                <input type="checkbox" checked={filterMarketing} onChange={e => setFilterMarketing(e.target.checked)}
                  className="w-3 h-3 accent-orange-500 cursor-pointer" />
                <span className={`text-[11px] font-semibold whitespace-nowrap ${filterMarketing ? "text-orange-500" : "text-gray-500"}`}>마케팅</span>
              </label>
              {hasFilter && (
                <button onClick={resetFilters} className="text-[11px] text-gray-400 hover:text-[#1a1a1a] underline underline-offset-2 whitespace-nowrap">초기화</button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {/* 그룹 기준 (sm+, 캘린더·타임라인·간트 제외) */}
              {viewMode !== "calendar" && viewMode !== "timeline" && viewMode !== "gantt" && (
                <div className="hidden sm:flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
                  {([ ["month","월별"], ["date","날짜별"], ["category","카테고리별"], ["brand","브랜드별"] ] as [GroupMode, string][]).map(([mode, label]) => (
                    <button key={mode} onClick={() => setGroupMode(mode)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${
                        groupMode === mode ? "bg-gray-800 text-white" : "text-gray-500 hover:text-[#1a1a1a]"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {/* 업데이트 일자 + 주문 순위 */}
              {lastSync && (
                <span className="hidden sm:inline text-[10px] text-gray-400 whitespace-nowrap tabular-nums">
                  {new Date(lastSync).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} 기준
                </span>
              )}
              <button
                onClick={() => setShowRank(true)}
                title="주문 순위"
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:border-orange-400 transition-all whitespace-nowrap shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="9" width="3" height="8"/><rect x="13" y="5" width="3" height="12"/></svg>
                <span className="hidden sm:inline">주문순위</span>
              </button>
              {/* 뷰 전환 버튼 */}
              <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
                <button onClick={() => setViewMode("grid")}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "grid" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ▦<span className="hidden sm:inline"> 이미지</span>
                </button>
                <button onClick={() => setViewMode("timeline")}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "timeline" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ↓<span className="hidden sm:inline"> 타임라인</span>
                </button>
                {/* 간트 버튼: 개선 예정, 임시 비노출 */}
                {false && <button onClick={() => setViewMode("gantt")} className="hidden">▬ 간트</button>}
                <button onClick={() => setViewMode("calendar")}
                  className={`hidden sm:block px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "calendar" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ⊞<span className="hidden sm:inline"> 캘린더</span>
                </button>
                <button onClick={() => setViewMode("list")}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === "list" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:text-[#1a1a1a]"}`}>
                  ☰<span className="hidden sm:inline"> 리스트</span>
                </button>
              </div>
              <span className="text-[11px] text-gray-500 font-medium">{filtered.length}개</span>
            </div>
          </div>

          {/* ── Row 2: 모바일 펼침 필터 ── */}
          {filterOpen && (
            <div className="sm:hidden mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">브랜드 전체</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">카테고리 전체</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-200 px-2.5 py-1.5 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                <option value="all">상태 전체</option>
                <option value="입고예정">입고예정</option>
                <option value="입고완료">입고완료</option>
                <option value="입고지연">입고지연</option>
                <option value="일정미정">일정미정</option>
              </select>
              {newArrivalTypes.length > 0 && (
                <select value={filterNewArrival} onChange={e => setFilterNewArrival(e.target.value)}
                  className="border border-gray-200 px-2.5 py-1.5 text-[12px] rounded-lg bg-white focus:outline-none focus:border-[#1a1a1a] text-gray-700 flex-1 min-w-[100px]">
                  <option value="all">신상구분 전체</option>
                  {newArrivalTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <div className="flex items-center gap-2 w-full">
                <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <input type="checkbox" checked={filterMarketing} onChange={e => setFilterMarketing(e.target.checked)}
                    className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" />
                  <span className={`text-[12px] font-semibold ${filterMarketing ? "text-orange-500" : "text-gray-500"}`}>마케팅 활용</span>
                </label>
                {hasFilter && (
                  <button onClick={resetFilters} className="text-[12px] text-gray-400 hover:text-[#1a1a1a] underline underline-offset-2 font-medium">초기화</button>
                )}
              </div>
            </div>
          )}
        </div>
        {/* 범례 */}
        <p className="text-[9px] text-gray-400 mt-1 text-right pr-0.5">* R뱃지 = 재진행 제품 / 캘린더 = 모바일 미지원</p>
      </div>

      {/* ── 본문 ── */}
      <div className="px-3 sm:px-8 lg:px-14 py-4">
        {filtered.length === 0 ? (
          <div className="py-32 text-center">
            <p className="text-[13px] text-gray-400">조건에 맞는 상품이 없습니다.</p>
            <button onClick={resetFilters} className="mt-3 text-[12px] text-[#1a1a1a] underline underline-offset-2">필터 초기화</button>
          </div>
        ) : viewMode === "grid" ? (
          <GridView grouped={grouped} groupMode={groupMode} onSelect={setSelectedProduct} showMarketing={filterMarketing} />
        ) : viewMode === "list" ? (
          <ListView grouped={grouped} groupMode={groupMode} onSelect={setSelectedProduct} showMarketing={filterMarketing} />
        ) : viewMode === "timeline" ? (
          <TimelineView products={filtered} onSelect={setSelectedProduct} showMarketing={filterMarketing} />
        ) : viewMode === "gantt" ? (
          <GanttView products={filtered} onSelect={setSelectedProduct} showMarketing={filterMarketing} />
        ) : (
          <CalendarView products={filtered} onSelect={setSelectedProduct} showMarketing={filterMarketing} />
        )}
      </div>

      {showRank && (
        <OrderRankModal products={filtered} onClose={() => setShowRank(false)} onSelect={setSelectedProduct} />
      )}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
