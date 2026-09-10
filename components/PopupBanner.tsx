"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ikSrc } from "@/lib/imageSrc";

// ── 타입 ──────────────────────────────────────────────────────────────────────

type BgType = "solid" | "gradient" | "image";
type LinkType = "url" | "product";

type PopupItem = {
  id: string;
  is_active: boolean;
  admin_title?: string;
  subtitle: string;
  title: string;
  link_type?: LinkType;
  link: string;
  link_text: string;
  bg_type?: BgType;
  bg_solid?: string;
  bg_gradient_from?: string;
  bg_gradient_to?: string;
  bg_gradient_angle?: number;
  bg_image_url?: string;
  bg_image_url_mobile?: string;
  bg_image_position?: string;         // "50% 50%" 형식, object-position 에 그대로 사용
  bg_image_position_mobile?: string;
  bg_image_scale?: number;            // 1 = 원본, >1 = 확대
  bg_image_scale_mobile?: number;
  text_color?: string;
  text_align?: "left" | "center" | "right";
  text_position?: "split" | "top" | "center" | "bottom";
  text_scale?: number;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  sort_order?: number;
};

// ── 상수 / 헬퍼 ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "popup_hidden_until";

// 텍스트 배치 매핑 (flex)
const TEXT_V_JUSTIFY: Record<string, string> = { split: "space-between", top: "flex-start", center: "center", bottom: "flex-end" };
const TEXT_H_ALIGN:   Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

const DEFAULT_POPUP: PopupItem = {
  id: "__default__",
  is_active: false,
  subtitle: "안는 순간, 시원해지는",
  title: "여름을 위한\n냉감 멀티쿠션",
  link: "/products",
  link_text: "상품 보러가기",
  bg_type: "gradient",
  bg_solid: "#303236",
  bg_gradient_from: "#7eb8d4",
  bg_gradient_to: "#a8d8b8",
  bg_gradient_angle: 135,
  bg_image_url: "",
};

function computeBg(item: PopupItem, device: "pc" | "mobile" = "pc"): string {
  const type = item.bg_type ?? (item.bg_image_url ? "image" : "gradient");
  if (type === "solid") return item.bg_solid || "#303236";
  if (type === "gradient") {
    const from  = item.bg_gradient_from  || "#7eb8d4";
    const to    = item.bg_gradient_to    || "#a8d8b8";
    const angle = item.bg_gradient_angle ?? 135;
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  if (type === "image") {
    const url = (device === "mobile" && item.bg_image_url_mobile)
      ? item.bg_image_url_mobile
      : item.bg_image_url;
    if (url) return `url('${url}') center/cover no-repeat`;
  }
  return item.bg_solid || "#303236";
}

function isVisible(item: PopupItem): boolean {
  if (!item.is_active) return false;
  const now = new Date().toISOString();
  if (item.scheduled_start && item.scheduled_start > now) return false;
  if (item.scheduled_end   && item.scheduled_end   < now) return false;
  return true;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function PopupBanner() {
  const [popups, setPopups]   = useState<PopupItem[]>([]);
  const [idx, setIdx]         = useState(0);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown]     = useState(false);
  const [hideToday, setHideToday] = useState(false);

  useEffect(() => {
    const hiddenUntil = localStorage.getItem(STORAGE_KEY);
    if (hiddenUntil && new Date().getTime() < Number(hiddenUntil)) return;

    fetch("/api/admin/site-settings/popup_banner")
      .then(r => r.json())
      .then((data: { popups?: PopupItem[] } | Record<string, unknown> | null) => {
        let list: PopupItem[] = [];

        if (data && "popups" in data && Array.isArray(data.popups)) {
          // 새 포맷: { popups: [] }
          list = (data.popups as PopupItem[]).filter(isVisible);
        } else if (data && typeof data === "object" && ("title" in data || "subtitle" in data)) {
          // 구형 단일 포맷 — 호환 처리
          const d = data as Record<string, unknown>;
          const legacy: PopupItem = {
            ...DEFAULT_POPUP,
            is_active: (d.is_active as boolean) ?? true,
            subtitle:  (d.subtitle as string)   || DEFAULT_POPUP.subtitle,
            title:     (d.title as string)       || DEFAULT_POPUP.title,
            link:      (d.link as string)        || DEFAULT_POPUP.link,
            link_text: (d.link_text as string)   || DEFAULT_POPUP.link_text,
            bg_type:   "gradient",
          };
          if (d.bg && typeof d.bg === "string") {
            // 구형 bg 문자열 → 그대로 bg_image_url 혹은 gradient로 재활용
            legacy.bg_solid = (d.bg as string);
          }
          list = isVisible(legacy) ? [legacy] : [];
        }

        if (list.length === 0) return;

        // sort_order 기준 정렬
        list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setPopups(list);
        setMounted(true);
        setTimeout(() => setShown(true), 50);
      })
      .catch(() => {
        if (!isVisible(DEFAULT_POPUP)) return;
        setPopups([DEFAULT_POPUP]);
        setMounted(true);
        setTimeout(() => setShown(true), 50);
      });
  }, []);

  // 모바일 body scroll lock
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    document.body.style.overflow = (isMobile && shown) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [shown]);

  const handleClose = useCallback(() => {
    if (hideToday) {
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      localStorage.setItem(STORAGE_KEY, String(midnight.getTime()));
    }
    setShown(false);
    setTimeout(() => setMounted(false), 350);
  }, [hideToday]);

  const prev = () => setIdx(i => (i - 1 + popups.length) % popups.length);
  const next = () => setIdx(i => (i + 1) % popups.length);

  if (!mounted || popups.length === 0) return null;

  const current = popups[idx];
  const multi   = popups.length > 1;

  // ── 공통 콘텐츠 렌더러 ──────────────────────────────────────────────────────

  function BannerContent({ height, titleRem, device }: { height: number; titleRem: number; device: "pc" | "mobile" }) {
    const isImageBg = (current.bg_type ?? (current.bg_image_url ? "image" : "gradient")) === "image";
    const useMobileImg = device === "mobile" && !!current.bg_image_url_mobile;
    const bgImageUrl = isImageBg
      ? (useMobileImg ? current.bg_image_url_mobile : current.bg_image_url)
      : undefined;
    const bgImagePos = device === "mobile"
      ? (current.bg_image_position_mobile || current.bg_image_position || "50% 50%")
      : (current.bg_image_position || "50% 50%");
    const bgScale = useMobileImg
      ? (current.bg_image_scale_mobile ?? 1)
      : (current.bg_image_scale ?? 1);

    // 텍스트 스타일
    const textScale = current.text_scale ?? 1;
    const textColor = current.text_color || "#ffffff";

    return (
      <div className="relative flex flex-col p-5 overflow-hidden"
        style={{
          height,
          background: isImageBg ? (bgImageUrl ? undefined : (current.bg_solid || "#303236")) : computeBg(current, device),
          justifyContent: TEXT_V_JUSTIFY[current.text_position ?? "split"],
          alignItems: TEXT_H_ALIGN[current.text_align ?? "left"],
          textAlign: current.text_align ?? "left",
          color: textColor,
        }}>
        {/* 이미지 배경 — object-position으로 위치 반영, scale로 확대 */}
        {isImageBg && bgImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ikSrc(bgImageUrl, 800)} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: bgImagePos, transform: bgScale !== 1 ? `scale(${bgScale})` : undefined, transformOrigin: bgImagePos }} />
        )}
        {/* 텍스트 */}
        <div className="relative z-10">
          <p className="leading-snug opacity-80" style={{ fontSize: `${0.75 * textScale}rem` }}>{current.subtitle}</p>
          <p className="mt-1 font-bold leading-tight whitespace-pre-line" style={{ fontSize: `${titleRem * textScale}rem` }}>
            {current.title}
          </p>
        </div>
        <Link href={current.link} onClick={handleClose}
          className="relative z-10 inline-flex items-center gap-1 font-medium opacity-90 hover:opacity-100 mt-2"
          style={{ fontSize: `${0.875 * textScale}rem` }}>
          {current.link_text} &gt;
        </Link>

        {/* 다중 팝업 화살표 */}
        {multi && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="이전 팝업"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="다음 팝업"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    );
  }

  function Footer() {
    return (
      <div className="bg-white px-5 py-3 border-t border-gray-100">
        {/* 점 인디케이터 */}
        {multi && (
          <div className="flex justify-center gap-1.5 pb-2">
            {popups.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-gray-700" : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"}`}
                aria-label={`${i + 1}번째 팝업`} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500 select-none">
            <input type="checkbox" checked={hideToday}
              onChange={e => setHideToday(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-gray-600" />
            오늘 하루 보지않기
          </label>
          <button onClick={handleClose} className="text-sm font-medium text-gray-700 hover:text-gray-900">
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── PC 팝업 (md+) ──────────────────────────────────────────────────── */}
      <div
        className={`hidden md:block fixed bottom-6 right-6 z-50 shadow-2xl transition-all duration-300 overflow-hidden ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
        style={{ width: 380 }}
        role="dialog"
        aria-modal="true"
        aria-label="팝업 배너"
      >
        <BannerContent height={280} titleRem={1.5} device="pc" />
        <Footer />
      </div>

      {/* ── 모바일 백드롭 ──────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-[64] bg-black/50 transition-opacity duration-300 ${
          shown ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* ── 모바일 바텀시트 ────────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[65] bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out overflow-hidden"
        style={{ transform: shown ? "translateY(0)" : "translateY(110%)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3.5 pb-1">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="px-4 pt-2 pb-0">
          <div className="rounded-2xl overflow-hidden">
            <BannerContent height={220} titleRem={1.25} device="mobile" />
          </div>
        </div>
        <div className="mt-1">
          <Footer />
        </div>
        <div className="h-5" />
      </div>
    </>
  );
}
