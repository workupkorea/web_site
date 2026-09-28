"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { CatalogPage } from "@/data/catalog";
import type { PDFDocumentProxy } from "pdfjs-dist";
import CatalogPageView from "./CatalogPageView";
import PdfPageCanvas, { renderPdfThumb, type PdfHalf } from "./PdfPageCanvas";
import { ikSrc } from "@/lib/imageSrc";
import { PDF_OPTIONS, PDF_WORKER_SRC } from "@/lib/pdf-options";

export type BrandEntry = { id: string; name: string; cover: string; pages: string[]; pdf_url: string };
// PDF 원본을 브라우저에서 직접 그려 플립북 UI로 보여주는 모드.
// url: pdf.js가 읽을 주소(CORS 우회 프록시 경유), downloadUrl: 다운로드 버튼용 원본 주소
export type PdfSource = { url: string; pageCount: number; downloadUrl: string };
type PdfTocItem = { title: string; pageIndex: number };
// 뷰어에서 "한 쪽"으로 취급하는 단위. page는 PDF 페이지 번호(1부터), half는 그 페이지에서 그릴 영역.
type PdfSlot = { page: number; half: PdfHalf };

// 인쇄용 펼침면 PDF(A4 세로 2쪽을 가로로 붙인 1.3~1.55 비율)는 한 페이지에 2쪽이 들어 있다.
// 이를 좌/우 반쪽으로 쪼개 뷰어가 한 칸에 한 쪽만 보이게 한다. 세로 페이지(단면 PDF)는 그대로 둔다.
// 첫 페이지가 펼침면이면 인쇄 관례대로 [뒷표지 | 표지]로 보고, 표지(오른쪽)를 맨 앞·뒷표지(왼쪽)를 맨 뒤에 둔다.
// ※ 가로형 단면 PDF(A4 가로 슬라이드형 등)도 같은 비율이라 쪼개질 수 있다 — 필요 시 브랜드별 옵션으로 분리할 것.
const SPREAD_RATIO_MIN = 1.3;
const SPREAD_RATIO_MAX = 1.55;
function buildPdfSlots(pageRatios: number[]): PdfSlot[] {
  const isSpread = (r: number) => r >= SPREAD_RATIO_MIN && r <= SPREAD_RATIO_MAX;
  const coverSpread = pageRatios.length > 1 && isSpread(pageRatios[0]);
  const slots: PdfSlot[] = [];
  pageRatios.forEach((r, i) => {
    const page = i + 1;
    if (!isSpread(r)) slots.push({ page, half: "full" });
    else if (i === 0 && coverSpread) slots.push({ page, half: "right" });
    else slots.push({ page, half: "left" }, { page, half: "right" });
  });
  if (coverSpread) slots.push({ page: 1, half: "left" });
  return slots;
}

// PDF 북마크(아웃라인) 최상위 항목 → 목차. 북마크가 없는 PDF는 빈 배열(번호 그리드로 대체됨).
async function loadPdfOutline(doc: PDFDocumentProxy): Promise<PdfTocItem[]> {
  try {
    const outline = await doc.getOutline();
    if (!outline) return [];
    const items: PdfTocItem[] = [];
    for (const it of outline) {
      const dest = typeof it.dest === "string" ? await doc.getDestination(it.dest) : it.dest;
      const target = Array.isArray(dest) ? dest[0] : null;
      if (target == null) continue;
      const pageIndex = typeof target === "object" ? await doc.getPageIndex(target) : Number(target);
      if (Number.isFinite(pageIndex) && it.title?.trim()) items.push({ title: it.title.trim(), pageIndex });
    }
    return items;
  } catch {
    return [];
  }
}
// 조립형 카탈로그(이미지+정보 입력형) — 플립북에 넣지 않고 전용 페이지로 링크만 노출
export type AssembledCatalogLink = { name: string; href: string };

const A4_RATIO = 297 / 210;
const THUMB_PER_GROUP = 30;
// "PDF 저장" 버튼 프린터 아이콘 — 조립형(인쇄 저장)과 PDF 원본(파일 저장)이 같은 모양을 쓴다
const PRINT_ICON_PATH = "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z";
const PDF_THUMB_RENDER_W = 140; // 사이드바 썸네일 표시 폭(약 65px)의 2배 — 고해상도 화면용

function buildTocItems(pages: CatalogPage[]) {
  return pages.map((p, i) => {
    let title = "";
    if (p.page_type === "cover")     title = [(p.data?.brand ?? "WORKUP"), p.data?.badge].filter(Boolean).join(" ");
    else if (p.page_type === "divider")   title = p.data?.title ?? p.admin_title;
    else if (p.page_type === "contents")  title = "목차";
    else                                  title = p.title || p.admin_title;
    return { title: title.trim(), pageIndex: i, type: p.page_type };
  }).filter(it => it.title);
}

// ── PDF 저장(브라우저 인쇄) ──
// 조립형 카탈로그는 원본 PDF 파일이 없어(표지·목차·구분 페이지는 코드 렌더),
// 전체 페이지를 A4 한 장씩 화면 밖에 렌더한 뒤 window.print()로 "PDF로 저장"하게 한다.
// 새 라이브러리·서버 함수 없이 브라우저 기본 기능만 사용한다.
// 인쇄용 컨테이너는 <body> 바로 아래에 포탈로 붙인다 — 뷰어의 overflow:hidden·고정높이
// 조상 안에 두면 인쇄 시 내용이 잘려 빈 페이지가 나온다.
const PRINT_CSS = `
#wu-catalog-print-portal { position: fixed; left: -10000px; top: 0; width: 210mm; z-index: -1; pointer-events: none; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; }
  body > *:not(#wu-catalog-print-portal) { display: none !important; }
  #wu-catalog-print-portal { position: static !important; left: auto !important; top: auto !important; width: auto !important; z-index: auto !important; }
  .wu-print-page { break-after: page; page-break-after: always; break-inside: avoid; }
  .wu-print-page:last-child { break-after: auto; page-break-after: auto; }
  .wu-print-page button { display: none !important; }
}
`;

function CatalogPrintDoc({ pages, onReady }: { pages: React.ReactNode[]; onReady: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const el = rootRef.current;
    if (!el) { onReady(); return; }
    const imgs = Array.from(el.querySelectorAll("img"));
    const waitAll = Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
            })
      )
    );
    // 이미지 로딩이 오래 걸려도 8초 후엔 그대로 인쇄
    const timeout = new Promise<void>((res) => setTimeout(res, 8000));
    Promise.race([waitAll, timeout]).then(() => {
      if (cancelled) return;
      onReady();
      // 레이아웃 안정화를 위해 짧게 지연 후 인쇄
      setTimeout(() => { if (!cancelled) window.print(); }, 120);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={rootRef} aria-hidden="true" id="wu-catalog-print-portal">
      {pages.map((node, i) => (
        <div key={i} className="wu-print-page"
          style={{ width: "210mm", height: "297mm", position: "relative", overflow: "hidden", background: "#fff" }}>
          {node}
        </div>
      ))}
    </div>,
    document.body
  );
}

// 스프레드 계산: 0=표지(오른쪽만), k>=1: left=2k-1, right=2k
function spreadOf(pageIdx: number) { return Math.ceil(pageIdx / 2); }
function pagesOfSpread(s: number, total: number) {
  if (s === 0) return { left: -1, right: Math.min(0, total - 1) };
  const l = s * 2 - 1, r = s * 2;
  return { left: l < total ? l : -1, right: r < total ? r : -1 };
}

export default function UnifiedCatalogViewer({ workupPages, brands, assembledLinks = [], sourceLabel, pdf }: { workupPages: CatalogPage[]; brands: BrandEntry[]; assembledLinks?: AssembledCatalogLink[]; sourceLabel?: string; pdf?: PdfSource }) {
  const [selectedId, setSelectedId]   = useState(workupPages.length > 0 || pdf ? "workup" : (brands[0]?.id ?? "workup"));
  // PDF 모드: 문서는 한 번만 로드해 모든 페이지 캔버스가 공유한다
  const [pdfDoc, setPdfDoc]         = useState<PDFDocumentProxy | null>(null);
  const [pdfToc, setPdfToc]         = useState<PdfTocItem[]>([]);
  const [pdfSlots, setPdfSlots]     = useState<PdfSlot[]>([]);
  const [pdfThumbs, setPdfThumbs]   = useState<Record<number, string>>({});
  const [pdfFailed, setPdfFailed]   = useState(false);
  // 페이지 세로/가로 비율(h/w). 조립형·이미지형은 A4 세로 고정, PDF는 첫 페이지 실제 비율을 따른다.
  const [pageRatio, setPageRatio]   = useState(A4_RATIO);
  const ratioRef = useRef(A4_RATIO);
  const areaRef      = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const [spread, setSpread]         = useState(0);
  const [dims, setDims]             = useState({ w: 0, h: 0, portrait: false });
  const [showToc, setShowToc]       = useState(false);
  const tocInitRef = useRef(false);
  const [showThumbs, setShowThumbs] = useState(false);
  const [thumbGroup, setThumbGroup] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied]         = useState(false);
  // PDF 저장(인쇄): "idle" → "preparing"(오프스크린 렌더+이미지 로딩) → 인쇄 대화상자
  const [printState, setPrintState] = useState<"idle" | "preparing">("idle");

  // PDF 로드 — react-pdf(pdf.js)는 SSR에서 평가되면 깨지므로 마운트 후 동적 import한다.
  // 페이지 수는 실제 문서의 numPages를 우선한다(관리자가 잘못 입력해도 정확히 표시).
  const pdfSrcUrl = pdf?.url;
  useEffect(() => {
    if (!pdfSrcUrl) return;
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const { pdfjs } = await import("react-pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        loaded = await pdfjs.getDocument({ url: pdfSrcUrl, ...PDF_OPTIONS }).promise;
        if (cancelled) { loaded.destroy(); return; }
        const doc = loaded;
        // 페이지별 가로/세로 비율(w/h)로 펼침면 여부를 판단
        const wh = await Promise.all(
          Array.from({ length: doc.numPages }, async (_, i) => {
            const v = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
            return v.width / v.height;
          }),
        );
        if (cancelled) { doc.destroy(); return; }
        const slots = buildPdfSlots(wh);
        // 뷰어 한 칸의 세로/가로 비율(h/w): 반쪽이면 가로가 절반이라 h/w가 2배
        const first = slots[0];
        const ratio = first.half === "full" ? 1 / wh[0] : 2 / wh[first.page - 1];
        // A4와 1% 이내면 A4로 맞춰 조립형 플립북과 책 크기가 픽셀 단위로 같게 한다
        setPageRatio(Math.abs(ratio - A4_RATIO) / A4_RATIO < 0.01 ? A4_RATIO : ratio);
        setPdfSlots(slots);
        setPdfDoc(doc);
        setPdfToc(await loadPdfOutline(loaded));
      } catch (e) {
        console.error("[UnifiedCatalogViewer] PDF 로드 실패", e);
        if (!cancelled) setPdfFailed(true);
      }
    })();
    return () => { cancelled = true; loaded?.destroy(); };
  }, [pdfSrcUrl]);

  const isWorkup = selectedId === "workup";
  const brand    = brands.find(b => b.id === selectedId);
  // 로드 전에는 DB에 기록된 페이지 수만큼 자리표시, 로드 후에는 실제 쪽 수(펼침면은 2배)
  const pdfTotal = pdf ? (pdfDoc ? pdfSlots.length : pdf.pageCount) : 0;
  const pageNodes: React.ReactNode[] = pdf
    ? Array.from({ length: pdfTotal }, (_, i) => pdfDoc && pdfSlots[i]
        ? <PdfPageCanvas key={i} doc={pdfDoc} pageNumber={pdfSlots[i].page} half={pdfSlots[i].half} width={dims.w} />
        : <div key={i} className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f5f0eb" }}>
            <span className="w-6 h-6 border-2 border-black/15 border-t-black/40 rounded-full animate-spin" />
          </div>)
    : isWorkup
    ? workupPages.map(p => <CatalogPageView key={p.id} page={p} />)
    : (brand?.pages ?? []).map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={ikSrc(url, 1200)} alt="" className="w-full h-full object-contain"
          style={{ backgroundColor: "#f5f0eb" }} loading="lazy" decoding="async" />
      ));

  // 썸네일 URL 배열 (실제 이미지) — PDF는 썸네일 스트립을 열었을 때 현재 그룹만 순서대로 그려 채운다
  const thumbUrls: (string | null)[] = pdf
    ? Array.from({ length: pdfTotal }, (_, i) => pdfThumbs[i] ?? null)
    : isWorkup
    ? workupPages.map(p => p.image_url ? ikSrc(p.image_url, 240) : null)
    : (brand?.pages ?? []).map(url => ikSrc(url, 240));

  const total        = pageNodes.length;
  const pdfUrl       = pdf ? pdf.downloadUrl : isWorkup ? "" : (brand?.pdf_url ?? "");
  const catalogTitle = isWorkup ? (sourceLabel || "2026 FW CATALOG") : (brand?.name ?? "CATALOG");
  const catalogSub   = isWorkup ? (sourceLabel ? "" : "K-WORKER STORE") : "";
  const tocItems     = pdf
    ? pdfToc.map(t => ({ ...t, pageIndex: Math.max(0, pdfSlots.findIndex(sl => sl.page === t.pageIndex + 1)), type: "image" as const }))
    : isWorkup ? buildTocItems(workupPages) : [];
  const hasBrandTabs = brands.length > 0 || assembledLinks.length > 0;
  const totalSpreads = total === 0 ? 0 : Math.ceil((total + 1) / 2);

  const { left: leftIdx, right: rightIdx } = pagesOfSpread(spread, total);
  const isSpread = !dims.portrait && spread > 0 && leftIdx >= 0;

  // 썸네일 그룹
  const thumbGroups = Math.ceil(total / THUMB_PER_GROUP);
  const thumbStart  = thumbGroup * THUMB_PER_GROUP;
  const thumbEnd    = Math.min(thumbStart + THUMB_PER_GROUP, total);

  // 목차(Contents) 사이드바에 목차 항목이 없으면 페이지 썸네일 그리드를 보여준다
  const showSidebarGrid = !dims.portrait && showToc && !isFullscreen && tocItems.length === 0;

  // PDF 썸네일 — 사이드바 그리드(전체) 또는 스트립(현재 그룹)이 보일 때만,
  // 순서대로 하나씩 그린다(동시 렌더링으로 버벅이지 않게).
  const pdfThumbFrom = showSidebarGrid ? 0 : thumbStart;
  const pdfThumbTo   = showSidebarGrid ? total : thumbEnd;
  useEffect(() => {
    if (!pdfDoc || !(showThumbs || showSidebarGrid)) return;
    let cancelled = false;
    (async () => {
      for (let i = pdfThumbFrom; i < pdfThumbTo; i++) {
        if (cancelled) return;
        const slot = pdfSlots[i];
        if (!slot || pdfThumbs[i]) continue;
        try {
          const url = await renderPdfThumb(pdfDoc, slot.page, slot.half, PDF_THUMB_RENDER_W);
          if (cancelled) return;
          setPdfThumbs(prev => ({ ...prev, [i]: url }));
        } catch { /* 썸네일 실패는 번호 표시로 대체 */ }
      }
    })();
    return () => { cancelled = true; };
    // pdfThumbs는 진행 중 갱신되므로 의존성에서 제외(이미 그린 것은 위에서 건너뜀)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pdfSlots, showThumbs, showSidebarGrid, pdfThumbFrom, pdfThumbTo]);

  // ── 크기 계산 ──
  const calcDims = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    const portrait = window.innerWidth < 768;
    const aw = el.clientWidth;
    const ah = el.clientHeight;
    const ratio = ratioRef.current;
    let h = ah - 16;
    let w = Math.round(h / ratio);
    if (portrait) {
      w = aw - 8;
      h = Math.round(w * ratio);
      if (h > ah - 8) { h = ah - 8; w = Math.round(h / ratio); }
    } else {
      const maxW = Math.floor((aw - 32) / 2);
      if (w > maxW) { w = maxW; h = Math.round(w * ratio); }
    }
    setDims({ w: Math.max(80, w), h: Math.max(80, h), portrait });
  }, []);

  useEffect(() => {
    calcDims();
    const ro = new ResizeObserver(calcDims);
    if (areaRef.current) ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, [calcDims, showToc]);

  // PDF 첫 페이지 비율이 확정되면 책 크기를 다시 계산
  useEffect(() => { ratioRef.current = pageRatio; calcDims(); }, [pageRatio, calcDims]);

  useEffect(() => { calcDims(); }, [spread, calcDims]);
  useEffect(() => { setSpread(0); setThumbGroup(0); }, [selectedId]);

  // 최초 dims 확정 시 PC에서만 TOC 자동 열기 (모바일은 닫힌 상태 유지)
  useEffect(() => {
    if (tocInitRef.current || dims.w === 0) return;
    tocInitRef.current = true;
    if (!dims.portrait) setShowToc(true);
  }, [dims.w, dims.portrait]);

  // 현재 페이지가 속한 썸네일 그룹으로 자동 전환
  useEffect(() => {
    const activeIdx = dims.portrait ? spread : (rightIdx >= 0 ? rightIdx : leftIdx >= 0 ? leftIdx : 0);
    setThumbGroup(Math.floor(activeIdx / THUMB_PER_GROUP));
  }, [spread, dims.portrait, leftIdx, rightIdx]);

  // 현재 활성 썸네일 스크롤
  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip || total === 0 || !showThumbs) return;
    const activeIdx = dims.portrait ? spread : (rightIdx >= 0 ? rightIdx : leftIdx >= 0 ? leftIdx : 0);
    const localIdx  = activeIdx - thumbStart;
    if (localIdx < 0 || localIdx >= thumbEnd - thumbStart) return;
    const el = strip.children[localIdx] as HTMLElement;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [spread, dims.portrait, leftIdx, rightIdx, showThumbs, thumbStart, thumbEnd, total]);

  // 전체화면
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  useEffect(() => {
    const h = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) setShowToc(false);
      else setShowToc(true);
    };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // PDF 저장 — 인쇄 종료(또는 취소) 시 오프스크린 렌더 정리
  useEffect(() => {
    const done = () => setPrintState("idle");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);
  // afterprint를 못 받는 브라우저 대비 안전장치 (로딩 오버레이가 남지 않도록)
  useEffect(() => {
    if (printState !== "preparing") return;
    const t = setTimeout(() => setPrintState("idle"), 90000);
    return () => clearTimeout(t);
  }, [printState]);

  // 공유
  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) await navigator.share({ title: catalogTitle, url: location.href });
      else { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* 취소 */ }
  }, [catalogTitle]);

  // 네비게이션
  const maxSpread = dims.portrait ? total - 1 : totalSpreads - 1;
  const canPrev   = spread > 0;
  const canNext   = spread < maxSpread;
  const goNext    = () => canNext && setSpread(s => s + 1);
  const goPrev    = () => canPrev && setSpread(s => s - 1);
  const goToPage  = (pageIdx: number) => setSpread(dims.portrait ? pageIdx : spreadOf(pageIdx));

  const pageDisplay = isSpread && leftIdx >= 0 && rightIdx >= 0
    ? `${leftIdx + 1} — ${rightIdx + 1}`
    : `${(dims.portrait ? spread : rightIdx >= 0 ? rightIdx : leftIdx >= 0 ? leftIdx : 0) + 1}`;

  return (
    <div ref={containerRef} className="relative flex flex-col overflow-hidden select-none"
      style={{ height: "calc(100vh - var(--wu-topbar-h,0px) - var(--wu-header-h,97px) - var(--wu-bottom-nav-h,0px))", backgroundColor: "#12161c" }}>

      {/* ── 상단 바 ── */}
      <div className="flex items-center justify-between flex-shrink-0 px-4 md:px-5 border-b border-white/10" style={{ minHeight: 64, backgroundColor: "#0d0f12" }}>
        {/* 왼쪽 — 타이틀 / 브랜드 탭 */}
        <div className="flex items-center gap-3">
          {hasBrandTabs ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedId("workup")}
                className={`px-2.5 py-1 text-[11px] tracking-widest font-semibold rounded transition-colors ${isWorkup ? "bg-[#E5541B] text-white" : "text-white/40 hover:text-white/70"}`}>
                WORKUP
              </button>
              {brands.map(b => (
                <button key={b.id} onClick={() => setSelectedId(b.id)}
                  className={`px-2.5 py-1 text-[11px] tracking-widest font-semibold rounded transition-colors ${b.id === selectedId ? "bg-[#E5541B] text-white" : "text-white/40 hover:text-white/70"}`}>
                  {b.name}
                </button>
              ))}
              {assembledLinks.map(a => (
                <Link key={a.href} href={a.href} target="_blank" rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] tracking-widest font-semibold rounded transition-colors text-white/40 hover:text-white/70 inline-flex items-center gap-1"
                  title={`${a.name} 카탈로그 (전용 페이지로 이동)`}>
                  {a.name}
                  <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H9M17 7v8" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-3">
              <p className="text-white font-black tracking-[0.06em] text-[14px] leading-none">{catalogTitle}</p>
              {catalogSub && <p className="text-white/30 text-[9px] tracking-[0.1em] mt-1.5 uppercase">{catalogSub}</p>}
            </div>
          )}
        </div>

        {/* 오른쪽 컨트롤 */}
        <div className="flex items-center divide-x divide-white/10">
          {/* 썸네일 토글 */}
          {total > 0 && (
            <button onClick={() => setShowThumbs(v => !v)}
              className={`hidden md:flex items-center gap-2 px-4 py-3 text-[11px] tracking-widest transition-colors ${showThumbs ? "text-[#E5541B]" : "text-white/50 hover:text-white/90"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1" strokeLinejoin="round" />
                <rect x="14" y="3" width="7" height="7" rx="1" strokeLinejoin="round" />
                <rect x="3" y="14" width="7" height="7" rx="1" strokeLinejoin="round" />
                <rect x="14" y="14" width="7" height="7" rx="1" strokeLinejoin="round" />
              </svg>
              <span>페이지</span>
            </button>
          )}
          {/* 공유 */}
          <button onClick={handleShare}
            className="flex items-center gap-2 px-3 md:px-4 py-3 text-white/50 hover:text-white/90 transition-colors text-[11px] tracking-widest">
            {copied
              ? <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
            }
            <span className="hidden md:inline">{copied ? "복사됨" : "공유"}</span>
          </button>
          {/* 다운로드 — 원본 PDF가 있으면 파일 링크, 없으면(조립형) 브라우저 인쇄로 PDF 저장 */}
          {pdfUrl ? (
            <a href={pdfUrl} download target="_blank" rel="noopener noreferrer" className="hidden md:flex items-center gap-2 px-4 py-3 text-white/50 hover:text-white/90 transition-colors text-[11px] tracking-widest">
              {pdf
                // PDF 카탈로그: 조립형 플립북과 동일한 「PDF 저장」 모양(동작은 원본 PDF 내려받기)
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PRINT_ICON_PATH} /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
              <span>{pdf ? "PDF 저장" : "다운로드"}</span>
            </a>
          ) : total > 0 ? (
            <button onClick={() => setPrintState("preparing")} disabled={printState === "preparing"}
              className="hidden md:flex items-center gap-2 px-4 py-3 text-white/50 hover:text-white/90 disabled:opacity-50 transition-colors text-[11px] tracking-widest"
              title="브라우저 인쇄 대화상자에서 'PDF로 저장'을 선택하세요">
              {printState === "preparing"
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2a10 10 0 00-10 10h2z" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PRINT_ICON_PATH} /></svg>
              }
              <span>{printState === "preparing" ? "준비 중" : "PDF 저장"}</span>
            </button>
          ) : null}
          {/* TOC 토글 — 오른쪽 배치 */}
          {!isFullscreen && (
            <button onClick={() => setShowToc(v => !v)}
              className={`hidden md:flex items-center gap-2 px-4 py-3 text-[11px] tracking-widest transition-colors ${showToc ? "text-[#E5541B]" : "text-white/50 hover:text-white/90"}`}
              aria-label="목차 보기">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              <span>목차</span>
            </button>
          )}
          {/* 전체화면 */}
          <button onClick={toggleFullscreen}
            className="hidden md:flex items-center gap-2 px-4 py-3 text-white/50 hover:text-white/90 transition-colors text-[11px] tracking-widest">
            {isFullscreen
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            }
            <span>{isFullscreen ? "화면 복귀" : "전체화면"}</span>
          </button>
          {/* 전체화면 — 모바일 전용 */}
          <button onClick={toggleFullscreen} className="md:hidden px-3 py-3 text-white/50 hover:text-white/90 transition-colors">
            {isFullscreen
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            }
          </button>
          {/* 첫 페이지로 — 모바일 */}
          <button onClick={() => setSpread(0)} className="md:hidden px-3 py-3 text-white/50 hover:text-white/90 transition-colors" aria-label="첫 페이지로">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── 본문: TOC 사이드바 + 뷰어 ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* TOC 사이드바 (PC, 전체화면 아닐 때) */}
        {!dims.portrait && showToc && !isFullscreen && (
          <aside className="flex-shrink-0 flex flex-col border-r border-white/10 overflow-hidden"
            style={{ width: 320, backgroundColor: "#090b0d" }}>
            <div className="px-5 pt-4 pb-3 border-b border-white/8 flex-shrink-0">
              <p className="text-[9px] tracking-[0.3em] text-[#E5541B] uppercase">Contents</p>
            </div>
            <style>{`.wu-toc-scroll::-webkit-scrollbar{width:3px}.wu-toc-scroll::-webkit-scrollbar-track{background:transparent}.wu-toc-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:999px}.wu-toc-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.28)}`}</style>
            <div className="wu-toc-scroll flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.12) transparent" }}>
              {tocItems.length > 0 ? (
                <ul className="px-2.5">
                  {tocItems.map((item, i) => {
                    const isSection = item.type === "divider" || item.type === "cover";
                    const isActive  = item.pageIndex === leftIdx || item.pageIndex === rightIdx;
                    return (
                      <li key={i}>
                        <button onClick={() => goToPage(item.pageIndex)}
                          className={`w-full flex items-start gap-2.5 py-2.5 px-2 text-left rounded-lg transition-colors group ${isActive ? "bg-white/5 text-white" : "text-white/38 hover:text-white/72 hover:bg-white/4"}`}>
                          <span className={`flex-shrink-0 text-[10px] tabular-nums mt-0.5 transition-colors ${isActive ? "text-[#E5541B]" : "text-white/18 group-hover:text-white/38"}`}
                            style={{ width: 20, textAlign: "right" }}>
                            {item.pageIndex + 1}
                          </span>
                          <span className={`flex-1 leading-snug ${isSection ? "text-[12px] font-semibold tracking-wide" : "text-[11px] tracking-wide"}`}>
                            {item.title}
                          </span>
                          {isActive && <span className="flex-shrink-0 w-1 h-1 rounded-full bg-[#E5541B] mt-1.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 pt-3 grid grid-cols-4 gap-1.5">
                  {Array.from({ length: total }, (_, i) => {
                    const isActive = i === leftIdx || i === rightIdx;
                    const imgUrl   = thumbUrls[i];
                    return (
                      <button key={i} onClick={() => goToPage(i)} aria-label={`${i + 1}페이지로 이동`}
                        className={`relative overflow-hidden flex items-center justify-center text-[9px] font-semibold rounded transition-all ${isActive ? "ring-2 ring-[#E5541B]" : "opacity-70 hover:opacity-100"} ${imgUrl ? "bg-[#f5f0eb]" : isActive ? "bg-[#E5541B] text-white" : "bg-white/8 text-white/40 hover:bg-white/16"}`}
                        style={{ aspectRatio: `1 / ${pageRatio}` }}>
                        {imgUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imgUrl} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                            <span className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[9px] tabular-nums ${isActive ? "bg-[#E5541B] text-white" : "bg-black/55 text-white/80"}`}>
                              {i + 1}
                            </span>
                          </>
                        ) : i + 1}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/8 flex-shrink-0">
              <p className="text-white/15 text-[10px] tracking-widest">{total} pages</p>
            </div>
          </aside>
        )}

        {/* 뷰어 + 썸네일 + 하단바 */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* ── 메인 뷰어 ── */}
          <div ref={areaRef} className="group relative flex-1 min-h-0 flex items-center justify-center"
            style={{ background: "radial-gradient(ellipse at center, #222226 0%, #0e1013 100%)", cursor: total > 0 ? "pointer" : "default" }}
            onClick={(e) => {
              if (total === 0 || dims.w === 0) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width / 2) goPrev();
              else goNext();
            }}>
            {/* 왼쪽 여백 화살표 — hover 시 표시 */}
            {canPrev && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none
                opacity-0 group-hover:opacity-100 transition-opacity
                w-9 h-9 flex items-center justify-center rounded-full bg-white/8 text-white/50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            )}
            {canNext && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none
                opacity-0 group-hover:opacity-100 transition-opacity
                w-9 h-9 flex items-center justify-center rounded-full bg-white/8 text-white/50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
            {pdfFailed ? (
              <div className="text-center px-6">
                <p className="text-white/50 text-xs tracking-wide leading-relaxed">카탈로그를 불러오지 못했습니다.<br />잠시 후 다시 시도하거나 PDF를 내려받아 확인해 주세요.</p>
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    className="inline-block mt-4 px-4 py-2 min-h-[44px] leading-[28px] rounded-lg border border-white/20 text-white/70 text-xs tracking-widest hover:text-white">
                    PDF 다운로드
                  </a>
                )}
              </div>
            ) : total > 0 && dims.w > 0 ? (
              <>
                {/* 책 */}
                <div style={{
                  width: dims.portrait ? dims.w : dims.w * 2,
                  height: dims.h,
                  display: "flex",
                  position: "relative",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                }}>
                  {/* 왼쪽 페이지 */}
                  {!dims.portrait && (
                    <div style={{ width: dims.w, height: dims.h, flexShrink: 0, overflow: "hidden", position: "relative" }}>
                      {leftIdx >= 0 && spread > 0
                        ? pageNodes[leftIdx]
                        : <div style={{ width: "100%", height: "100%", backgroundColor: "#ede8e0" }} />}
                      {isSpread && (
                        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none",
                          background: "linear-gradient(to right, transparent 72%, rgba(0,0,0,0.14) 100%)" }} />
                      )}
                    </div>
                  )}
                  {/* 오른쪽 페이지 (모바일 단독) */}
                  <div style={{ width: dims.w, height: dims.h, flexShrink: 0, overflow: "hidden", position: "relative" }}>
                    {dims.portrait
                      ? (spread < total ? pageNodes[spread] : <div style={{ width: "100%", height: "100%", backgroundColor: "#ede8e0" }} />)
                      : (rightIdx >= 0 ? pageNodes[rightIdx] : <div style={{ width: "100%", height: "100%", backgroundColor: "#ede8e0" }} />)
                    }
                    {isSpread && (
                      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none",
                        background: "linear-gradient(to left, transparent 72%, rgba(0,0,0,0.14) 100%)" }} />
                    )}
                  </div>
                  {/* 척추선 */}
                  {isSpread && (
                    <div aria-hidden="true" style={{
                      position: "absolute", top: 0, left: dims.w - 1, width: 2, height: "100%",
                      background: "linear-gradient(to right, rgba(0,0,0,0.28), rgba(0,0,0,0.07) 45%, rgba(0,0,0,0.07) 55%, rgba(0,0,0,0.28))",
                      pointerEvents: "none", zIndex: 4,
                    }} />
                  )}
                </div>

              </>
            ) : !isWorkup && total === 0 && pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full bg-white rounded" title={brand?.name} />
            ) : (
              <p className="text-white/20 text-xs tracking-widest">준비 중입니다</p>
            )}
          </div>

          {/* ── 썸네일 스트립 (기본 숨김, 토글) ── */}
          {showThumbs && total > 0 && (
            <div className="flex-shrink-0 border-t border-white/8 flex items-center gap-2 px-3 py-2"
              style={{ backgroundColor: "#090b0d", minHeight: 72 }}>
              {/* 이전 그룹 */}
              <button onClick={() => setThumbGroup(g => Math.max(0, g - 1))} disabled={thumbGroup === 0}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white/35 hover:text-white/70 disabled:opacity-20 disabled:pointer-events-none transition-colors rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* 썸네일 */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: "none" }}>
                <style>{`.wu-thumb-inner::-webkit-scrollbar{display:none}`}</style>
                <div ref={thumbStripRef} className="wu-thumb-inner flex items-center justify-center gap-1.5" style={{ minWidth: "max-content", margin: "0 auto" }}>
                  {Array.from({ length: thumbEnd - thumbStart }, (_, i) => {
                    const pageIdx = thumbStart + i;
                    const active  = dims.portrait ? pageIdx === spread : pageIdx === leftIdx || pageIdx === rightIdx;
                    const imgUrl  = thumbUrls[pageIdx];
                    return (
                      <button key={pageIdx} onClick={() => goToPage(pageIdx)} aria-label={`${pageIdx + 1}페이지`}
                        className="flex-shrink-0 rounded overflow-hidden transition-all"
                        style={{
                          height: 52,
                          aspectRatio: "210/297",
                          border: `2px solid ${active ? "#E5541B" : "transparent"}`,
                          opacity: active ? 1 : 0.55,
                          backgroundColor: "#2a2a2e",
                        }}>
                        {imgUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={imgUrl} alt={`페이지 ${pageIdx + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          : <span className="w-full h-full flex items-center justify-center text-[9px] font-semibold" style={{ color: active ? "#E5541B" : "rgba(255,255,255,0.35)" }}>{pageIdx + 1}</span>
                        }
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 다음 그룹 */}
              <button onClick={() => setThumbGroup(g => Math.min(thumbGroups - 1, g + 1))} disabled={thumbGroup >= thumbGroups - 1}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white/35 hover:text-white/70 disabled:opacity-20 disabled:pointer-events-none transition-colors rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* ── 하단 바: 이전/다음 + 페이지 번호 중앙 ── */}
          {total > 1 && (
            <div className="flex-shrink-0 flex items-center px-2 border-t border-white/8"
              style={{ minHeight: 40, backgroundColor: "#090b0d" }}>
              {/* 첫 페이지로 — PC 전용 */}
              <button onClick={() => setSpread(0)} disabled={spread === 0}
                className="hidden md:flex w-8 h-8 items-center justify-center text-white/30 hover:text-white/70 disabled:opacity-15 disabled:pointer-events-none transition-colors rounded mr-1"
                aria-label="첫 페이지로">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
              {/* 이전 페이지 */}
              <button onClick={goPrev} disabled={!canPrev}
                className="w-8 h-8 flex items-center justify-center text-white/35 hover:text-white/70 disabled:opacity-20 disabled:pointer-events-none transition-colors rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* 페이지 번호 — 중앙 */}
              <div className="flex-1 flex justify-center">
                <span className="text-white/40 text-[9px] tracking-wide tabular-nums">
                  {pageDisplay} / {total}
                </span>
              </div>

              {/* 다음 페이지 */}
              <button onClick={goNext} disabled={!canNext}
                className="w-8 h-8 flex items-center justify-center text-white/35 hover:text-white/70 disabled:opacity-20 disabled:pointer-events-none transition-colors rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* 모바일 전용 — 페이지·목차 아이콘 */}
              <div className="md:hidden flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
                {/* 썸네일(페이지) */}
                <button onClick={() => setShowThumbs(v => !v)}
                  className={`w-11 h-9 flex flex-col items-center justify-center gap-0.5 rounded transition-colors ${showThumbs ? "text-[#E5541B]" : "text-white/40 hover:text-white/75"}`}
                  aria-label="페이지 목록">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1" strokeLinejoin="round" />
                    <rect x="14" y="3" width="7" height="7" rx="1" strokeLinejoin="round" />
                    <rect x="3" y="14" width="7" height="7" rx="1" strokeLinejoin="round" />
                    <rect x="14" y="14" width="7" height="7" rx="1" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[8px] leading-none tracking-wide">페이지</span>
                </button>
                {/* 목차 */}
                <button onClick={() => setShowToc(v => !v)}
                  className={`w-11 h-9 flex flex-col items-center justify-center gap-0.5 rounded transition-colors ${showToc && dims.portrait ? "text-[#E5541B]" : "text-white/40 hover:text-white/75"}`}
                  aria-label="목차">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                  <span className="text-[8px] leading-none tracking-wide">목차</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 모바일 목차 바텀시트 ── */}
      {dims.portrait && showToc && !isFullscreen && (
        <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col"
          style={{ maxHeight: "60vh", backgroundColor: "#090b0d", borderTop: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px 16px 0 0" }}>
          {/* 핸들 + 헤더 */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
            <div>
              <p className="text-[9px] tracking-[0.28em] text-[#E5541B] uppercase">Contents</p>
            </div>
            <button onClick={() => setShowToc(false)}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* 목차 리스트 */}
          <div className="flex-1 overflow-y-auto py-2 px-3">
            {tocItems.length > 0 ? (
              <ul>
                {tocItems.map((item, i) => {
                  const isSection = item.type === "divider" || item.type === "cover";
                  const isActive  = item.pageIndex === spread;
                  return (
                    <li key={i}>
                      <button onClick={() => { goToPage(item.pageIndex); setShowToc(false); }}
                        className={`w-full flex items-start gap-3 py-2.5 px-2 text-left rounded-lg transition-colors group ${isActive ? "bg-white/5 text-white" : "text-white/40 hover:text-white/75 hover:bg-white/4"}`}>
                        <span className={`flex-shrink-0 text-[10px] tabular-nums mt-0.5 ${isActive ? "text-[#E5541B]" : "text-white/20"}`}
                          style={{ width: 22, textAlign: "right" }}>
                          {item.pageIndex + 1}
                        </span>
                        <span className={`flex-1 leading-snug ${isSection ? "text-[13px] font-semibold tracking-wide" : "text-[12px] tracking-wide"}`}>
                          {item.title}
                        </span>
                        {isActive && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#E5541B] mt-1" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid grid-cols-5 gap-2 py-2">
                {Array.from({ length: total }, (_, i) => (
                  <button key={i} onClick={() => { goToPage(i); setShowToc(false); }}
                    className={`aspect-[210/297] flex items-center justify-center text-[10px] font-semibold rounded transition-colors ${i === spread ? "bg-[#E5541B] text-white" : "bg-white/8 text-white/40 hover:bg-white/16"}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* 하단 여백 (safe area) */}
          <div className="flex-shrink-0 h-4" />
        </div>
      )}

      {/* 바텀시트 딤 배경 */}
      {dims.portrait && showToc && !isFullscreen && (
        <div className="absolute inset-0 z-40 bg-black/50" onClick={() => setShowToc(false)} />
      )}

      {/* PDF 저장 — 인쇄용 오프스크린 렌더 (준비 중일 때만 마운트) */}
      {printState === "preparing" && total > 0 && (
        <>
          <style>{PRINT_CSS}</style>
          <CatalogPrintDoc pages={pageNodes} onReady={() => { /* afterprint 이벤트가 정리 */ }} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 print:hidden">
            <div className="max-w-xs rounded-lg bg-[#0d0f12] px-5 py-5 text-center">
              <div className="flex items-center justify-center gap-2 text-white/80 text-[13px] font-semibold">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2a10 10 0 00-10 10h2z" /></svg>
                인쇄 창을 준비 중입니다…
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-white/45">
                잠시 후 뜨는 창에서 <span className="text-[#E5541B] font-semibold">대상</span>을
                <br /><span className="text-white/70 font-semibold">&quot;PDF로 저장&quot;</span>으로 선택한 뒤 저장하세요.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
