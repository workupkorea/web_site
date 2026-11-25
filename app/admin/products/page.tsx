"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product, MainExpose } from "@/data/products";
import { mainCategories, subCategoriesByMain } from "@/data/products";
import CatalogManagerModal from "@/components/admin/CatalogManagerModal";
import FilterManagerModal from "@/components/admin/FilterManagerModal";

// 수정 페이지 왕복 시 목록 뷰(페이지/필터/스크롤)를 복원하기 위한 세션 키
const VIEW_KEY = "admin-products-view";

// ── 상수 ──────────────────────────────────────────────────────────────────────
type SearchType = "상품명" | "상품코드" | "브랜드" | "제조사";
type DatePreset = "전체" | "오늘" | "3일" | "7일" | "1개월" | "3개월" | "1년";
type SortBy = "최종수정순" | "최신순" | "진열순" | "이름순";

const DISPLAY_ON = ["판매중", "예약판매", "품절"];
const DISPLAY_OFF = ["판매중지", "진열대기"];

const STATUS_DOT: Record<string, string> = {
  판매중:   "bg-emerald-500",
  품절:     "bg-red-500",
  판매중지: "bg-gray-400",
  예약판매: "bg-blue-500",
  진열대기: "bg-amber-500",
};

function getDateCutoff(preset: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case "오늘":   return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "3일":   return new Date(now.getTime() - 3 * 86400000);
    case "7일":   return new Date(now.getTime() - 7 * 86400000);
    case "1개월": return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3개월": return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "1년":   return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    default: return null;
  }
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  const parts = iso.slice(0, 10).split("-"); // ["2026","06","15"]
  if (parts.length !== 3) return iso.slice(0, 10);
  return `${parts[0].slice(2)}.${parts[1]}.${parts[2]}`; // "26.06.15"
}

const DATE_PRESETS: DatePreset[] = ["오늘", "7일", "1개월"];
const EXPOSE_OPTIONS: MainExpose[] = ["신상품", "추천상품", "베스트", "기획전"];
// 제품목록 테이블에서 표시/숨김 토글 가능한 컬럼 (상품명은 항상 표시)
const TOGGLE_COLS = ["상태", "브랜드", "품번", "가격", "카테고리", "색상", "사이즈", "최종수정"];
const COL_KEY = "wu-admin-product-cols";
const SEARCH_TYPES: SearchType[] = ["상품명", "상품코드", "브랜드", "제조사"];

// ── 퀵수정(간단 수정) 팝업용 프리셋 — 상품등록 폼과 동일한 목록 ───────────────────
const QE_CLOTHING_SIZE_PRESETS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const QE_CLOTHING_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
function qeSortSizes(sizes: string[]): string[] {
  const rankOf = (s: string) => {
    const i = QE_CLOTHING_SIZE_ORDER.indexOf(s.trim().toUpperCase());
    return i === -1 ? null : i;
  };
  return [...sizes].sort((a, b) => {
    const ra = rankOf(a), rb = rankOf(b);
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return 0;
  });
}
const QE_COLOR_PRESETS = [
  { name: "블랙",   hex: "#1C1C1C" },
  { name: "화이트", hex: "#F0F0F0" },
  { name: "네이비", hex: "#303236" },
  { name: "그레이", hex: "#7A7A7A" },
  { name: "베이지", hex: "#C9B99A" },
  { name: "카키",   hex: "#4A5240" },
];

// ── 컴포넌트 ───────────────────────────────────────────────────────────────────
export default function AdminProductsPage() {
  // ─ 데이터 ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [apiErrMsg, setApiErrMsg] = useState("");
  const [msg, setMsg] = useState("");
  const [seeding, setSeeding] = useState(false);

  // ─ 목록 뷰 상태 복원 (수정 후 돌아왔을 때 같은 페이지/필터/스크롤 유지) ─
  const savedView = useRef<Record<string, unknown> | undefined>(undefined);
  if (savedView.current === undefined) {
    try { savedView.current = JSON.parse((typeof window !== "undefined" ? sessionStorage.getItem(VIEW_KEY) : null) || "{}"); }
    catch { savedView.current = {}; }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const V = savedView.current as Record<string, any>;
  const pendingScroll = useRef<number | null>(typeof V.scrollTop === "number" ? V.scrollTop : null);

  // ─ 검색 & 필터 ─────────────────────────────────────────────────────────
  // 검색어는 재진입(페이지 재방문) 시 항상 초기화한다 — V에서 복원하지 않음.
  // (필터·정렬·스크롤은 기존대로 복원해 "수정 후 복귀" 위치 유지)
  const [searchType, setSearchType]   = useState<SearchType>("상품명");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [applied, setApplied]         = useState<{ type: SearchType; query: string }>({ type: "상품명", query: "" });
  // 서버 렌더링(sessionStorage 접근 불가)과 클라이언트 첫 렌더링 결과가 어긋나 하이드레이션
  // 에러가 나지 않도록, 초기값은 항상 고정 기본값을 쓰고 sessionStorage 복원은 마운트 후
  // useEffect에서 처리한다(아래 참조).
  const [datePreset, setDatePreset]   = useState<DatePreset>("전체");
  const [dateStart, setDateStart]     = useState<string>("");
  const [dateEnd, setDateEnd]         = useState<string>("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false); // "기간 선택" 버튼으로 시작~종료일 입력을 펼침
  const [statusFilter, setStatusFilter]   = useState<string>("전체");
  const [brandFilter, setBrandFilter]     = useState<string>("전체");
  const [categoryFilter, setCategoryFilter]       = useState<string>("전체");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("전체");
  const [sizeFilter, setSizeFilter]       = useState<string>("전체");
  // 지점 출고 패스에서 빠르게 임시등록된(정식 정보 미입력) 상품만 따로 걸러보기 — 일반 상품과 혼동 방지용
  const [tempOnlyFilter, setTempOnlyFilter] = useState(false);
  // products.registration_status 컬럼은 옛 상품에도 잘못 남아있을 수 있어(과거 ALTER TABLE 기본값 이슈),
  // "진짜 임시등록 상품"은 반드시 출고 패스(notices)에 실제로 쓰인 적 있는 상품으로도 함께 확인한다.
  const [noticedIds, setNoticedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/admin/notices/product-ids")
      .then((r) => (r.ok ? r.json() : []))
      .then((ids) => setNoticedIds(new Set(Array.isArray(ids) ? ids : [])))
      .catch(() => {});
  }, []);
  const isTempRegistered = useCallback(
    (p: Product) => p.registrationStatus === "임시등록" && noticedIds.has(p.id),
    [noticedIds]
  );

  // ─ 선택 & 정렬 ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy]     = useState<SortBy>("최종수정순");
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);   // 브랜드/제조사 관리 팝업
  const [filterModalOpen, setFilterModalOpen]   = useState(false);   // 필터 관리 팝업
  const [perPage, setPerPage]   = useState<number>(20);
  const [page, setPage]         = useState<number>(1);

  // 마운트 후(클라이언트에서만) sessionStorage에 저장된 이전 뷰 상태를 복원
  useEffect(() => {
    if (V.datePreset != null) setDatePreset(V.datePreset);
    if (V.dateStart != null) setDateStart(V.dateStart);
    if (V.dateEnd != null) setDateEnd(V.dateEnd);
    if (V.statusFilter != null) setStatusFilter(V.statusFilter);
    if (V.brandFilter != null) setBrandFilter(V.brandFilter);
    if (V.categoryFilter != null) setCategoryFilter(V.categoryFilter);
    if (V.subCategoryFilter != null) setSubCategoryFilter(V.subCategoryFilter);
    if (V.sizeFilter != null) setSizeFilter(V.sizeFilter);
    if (V.sortBy != null) setSortBy(V.sortBy);
    if (V.perPage != null) setPerPage(V.perPage);
    if (V.page != null) setPage(Math.max(1, Math.floor(Number(V.page)) || 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [colMenuOpen, setColMenuOpen] = useState(false); // 컬럼 표시/숨김 드롭다운
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLE_COLS.map(c => [c, true]))
  );

  // ─ 메인진열 수정 모달 ──────────────────────────────────────────────────
  const [exposeModal, setExposeModal]     = useState(false);
  const [exposeMode, setExposeMode]       = useState<"추가" | "교체" | "제거">("추가");
  const [exposeTarget, setExposeTarget]   = useState<Set<MainExpose>>(new Set());
  const [exposeSaving, setExposeSaving]   = useState(false);

  // ─ 카테고리 일괄 변경 모달 ─────────────────────────────────────────
  type CatEntry = { main: string; sub: string };
  const [catModal, setCatModal]       = useState(false);
  const [catModalCats, setCatModalCats] = useState<CatEntry[]>([]);
  const [catAddMain, setCatAddMain]   = useState("");
  const [catAddSub, setCatAddSub]     = useState("");
  const [catSaving, setCatSaving]     = useState(false);
  const [catList, setCatList] = useState<{ name: string; subs: string[] }[]>(
    mainCategories.map(n => ({ name: n, subs: subCategoriesByMain[n as keyof typeof subCategoriesByMain] ?? [] }))
  );

  // ─ 브랜드 일괄 변경 모달 ───────────────────────────────────────────
  const [brandList, setBrandList] = useState<string[]>([]);
  const [brandModal, setBrandModal] = useState(false);
  const [brandModalValue, setBrandModalValue] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);

  // ─ 리스트 내 인라인 카테고리 추가 (행별 피커) ───────────────────────────
  const [catRowId, setCatRowId] = useState<string | null>(null);
  const [rowMain, setRowMain]   = useState("");
  const [rowSub, setRowSub]     = useState("");

  // ─ 상품명 옆 "퀵수정" 버튼 → 간단 수정 팝업 (전체 수정 페이지 대신 색상·사이즈·브랜드만 빠르게) ──
  const [quickEditTarget, setQuickEditTarget] = useState<Product | null>(null);
  const [quickEditBrand, setQuickEditBrand] = useState("");
  const [quickEditSizes, setQuickEditSizes] = useState<string[]>([]);
  const [quickEditSizeInput, setQuickEditSizeInput] = useState("");
  const [quickEditColors, setQuickEditColors] = useState<{ name: string; hex: string }[]>([]);
  const [quickEditColorName, setQuickEditColorName] = useState("");
  const [quickEditColorHex, setQuickEditColorHex] = useState("#303236");
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [qeColorDropdownOpen, setQeColorDropdownOpen] = useState(false);

  // 사이즈 필터 드롭다운 옵션 — 전체 상품에 실제로 쓰인 사이즈만 모아 표준 순서로 정렬
  const sizeList = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const s of p.sizes ?? []) if (s) set.add(s);
    return qeSortSizes([...set]);
  }, [products]);

  // 전체 상품에서 자주 쓴 색상 집계 (프리셋에 없는 이름 중 5회 이상 사용) — 상품등록 폼과 동일한 규칙
  const qeColorDropdownOptions = useMemo(() => {
    const usage: Record<string, { hex: string; count: number }> = {};
    for (const p of products) {
      for (const c of p.colors ?? []) {
        if (!c?.name) continue;
        if (usage[c.name]) usage[c.name].count += 1;
        else usage[c.name] = { hex: c.hex, count: 1 };
      }
    }
    return Object.entries(usage)
      .filter(([name, u]) => !QE_COLOR_PRESETS.some((p) => p.name === name) && u.count >= 5)
      .map(([name, u]) => ({ name, hex: u.hex, count: u.count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const openQuickEdit = (p: Product) => {
    setQuickEditTarget(p);
    setQuickEditBrand(p.brand ?? "");
    setQuickEditSizes(p.sizes ?? []);
    setQuickEditSizeInput("");
    setQuickEditColors(p.colors ?? []);
    setQuickEditColorName("");
    setQuickEditColorHex("#303236");
    setQeColorDropdownOpen(false);
  };
  const closeQuickEdit = () => setQuickEditTarget(null);

  const qeToggleSize = (size: string) =>
    setQuickEditSizes((prev) => qeSortSizes(prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  const qeAddCustomSize = () => {
    const v = quickEditSizeInput.trim();
    if (!v) return;
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    setQuickEditSizes((prev) => qeSortSizes([...new Set([...prev, ...parts])]));
    setQuickEditSizeInput("");
  };
  const qeToggleColor = (preset: { name: string; hex: string }) =>
    setQuickEditColors((prev) => {
      const existing = prev.find((c) => c.name === preset.name);
      if (!existing) return [...prev, preset];
      if (existing.hex.toLowerCase() === preset.hex.toLowerCase()) {
        return prev.filter((c) => c.name !== preset.name);
      }
      // 이름은 같지만 색상값이 다름(엑셀 등록 시 기본값으로 잘못 들어간 경우) — 해제 대신 값 교체
      return prev.map((c) => (c.name === preset.name ? { ...c, hex: preset.hex } : c));
    });
  const qeAddCustomColor = () => {
    const name = quickEditColorName.trim();
    if (!name) return;
    setQuickEditColors((prev) => [...prev.filter((c) => c.name !== name), { name, hex: quickEditColorHex }]);
    setQuickEditColorName("");
  };
  const qeRemoveColor = (name: string) =>
    setQuickEditColors((prev) => prev.filter((c) => c.name !== name));

  const saveQuickEdit = async () => {
    if (!quickEditTarget) return;
    setQuickEditSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${quickEditTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quickEditTarget, brand: quickEditBrand, sizes: quickEditSizes, colors: quickEditColors }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        showMsg(`저장 실패: ${e.error ?? res.status}`);
      } else {
        showMsg("저장됐습니다.");
        closeQuickEdit();
        load();
      }
    } catch {
      showMsg("저장 실패: 네트워크 오류");
    } finally {
      setQuickEditSaving(false);
    }
  };

  // ─ 로드 ────────────────────────────────────────────────────────────────
  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setTableError(false); setApiErrMsg("");
    try {
      const res = await fetch("/api/admin/products");
      if (!res.ok) {
        let e = `HTTP ${res.status}`;
        try { const j = await res.json(); e = j.error ?? JSON.stringify(j); } catch { /* noop */ }
        setTableError(true); setApiErrMsg(e); setProducts([]);
      } else {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (e) { setTableError(true); setApiErrMsg(String(e)); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/admin/brands")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setBrandList(d.map((b: { name: string }) => b.name)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/site-settings/categories")
      .then(r => r.ok ? r.json() : null)
      // 응답은 config 객체 = { categories: [{name, subs}] } 형태. (구버전 대비 배열도 허용)
      .then(d => {
        const cats = Array.isArray(d?.categories) ? d.categories : Array.isArray(d) ? d : null;
        if (cats && cats.length) setCatList(cats);
      })
      .catch(() => {});
  }, []);

  // 컬럼 표시/숨김 설정 로드 (localStorage) — 새로고침해도 유지
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(COL_KEY) || "null");
      if (s && typeof s === "object") setVisibleCols(prev => ({ ...prev, ...s }));
    } catch { /* noop */ }
  }, []);

  const toggleCol = (c: string) =>
    setVisibleCols(prev => {
      const next = { ...prev, [c]: !prev[c] };
      try { localStorage.setItem(COL_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });

  // 뷰 상태를 세션에 저장 (수정 페이지에서 돌아오면 같은 페이지/필터로 복원)
  useEffect(() => {
    try {
      const prev = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}");
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({
        ...prev, searchType, searchQuery, applied, datePreset, dateStart, dateEnd,
        statusFilter, brandFilter, categoryFilter, subCategoryFilter, sizeFilter, sortBy, perPage, page,
      }));
    } catch { /* noop */ }
  }, [searchType, searchQuery, applied, datePreset, dateStart, dateEnd, statusFilter, brandFilter, categoryFilter, subCategoryFilter, sizeFilter, sortBy, perPage, page]);

  // 로드 완료 후 저장된 스크롤 위치 복원 (1회)
  useEffect(() => {
    if (loading || pendingScroll.current == null) return;
    const sc = document.querySelector("main");
    if (sc) sc.scrollTop = pendingScroll.current;
    pendingScroll.current = null;
  }, [loading]);

  const getProductCats = (p: Product): CatEntry[] => {
    const raw = (p as Record<string, unknown>).categories as CatEntry[] | undefined;
    if (raw?.length) return raw;
    return p.category ? [{ main: p.category, sub: p.subCategory ?? "" }] : [];
  };

  // 리스트에서 카테고리 직접 저장 (낙관적 갱신 + 전체 PUT). 대표 카테고리는 첫 항목.
  const saveProductCats = async (p: Product, cats: CatEntry[]) => {
    const primary = cats[0];
    const updated = {
      ...p,
      category: primary?.main ?? "",
      subCategory: primary?.sub ?? "",
      categories: cats,
    };
    setProducts(prev => prev.map(x => x.id === p.id ? (updated as unknown as Product) : x));
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showMsg(`저장 실패: ${e.error ?? res.status}`); load(); }
      else showMsg("저장됐습니다.");
    } catch { showMsg("저장 실패: 네트워크 오류"); load(); }
  };

  const removeProductCat = (p: Product, idx: number) =>
    saveProductCats(p, getProductCats(p).filter((_, i) => i !== idx));

  const openRowCat = (p: Product) => {
    setCatRowId(p.id);
    setRowMain(catList[0]?.name ?? "");
    setRowSub("");
  };

  const addRowCat = (p: Product) => {
    if (rowMain) {
      const cats = getProductCats(p);
      if (!cats.some(c => c.main === rowMain && c.sub === rowSub)) {
        saveProductCats(p, [...cats, { main: rowMain, sub: rowSub }]);
      }
    }
    setCatRowId(null);
  };

  const openCatModal = () => {
    setCatModalCats([]);
    setCatAddMain(catList[0]?.name ?? "");
    setCatAddSub("");
    setCatModal(true);
  };

  const addModalCat = () => {
    if (!catAddMain) return;
    const already = catModalCats.some(c => c.main === catAddMain && c.sub === catAddSub);
    if (!already) setCatModalCats(prev => [...prev, { main: catAddMain, sub: catAddSub }]);
  };

  const removeModalCat = (idx: number) => setCatModalCats(prev => prev.filter((_, i) => i !== idx));

  const bulkApplyCat = async () => {
    if (!selected.size || catModalCats.length === 0) return;
    setCatSaving(true);
    const results = await Promise.all(
      products.filter(p => selected.has(p.id)).map(async p => {
        // 기존 카테고리에 추가(병합) — 중복 제외, 대표 카테고리는 기존 유지
        const merged = [...getProductCats(p)];
        for (const nc of catModalCats) {
          if (!merged.some(c => c.main === nc.main && c.sub === nc.sub)) merged.push(nc);
        }
        const primary = merged[0];
        const res = await fetch(`/api/admin/products/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...p,
            category: primary.main,
            subCategory: primary.sub,
            categories: merged,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, id: p.id, msg: err.error ?? `HTTP ${res.status}` };
        }
        return { ok: true, id: p.id };
      })
    );
    setCatSaving(false);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      showMsg(`오류: ${failed[0].msg}`);
    } else {
      setCatModal(false);
      setCatModalCats([]);
      showMsg(`${selected.size}개 상품 카테고리 추가 완료`);
      setSelected(new Set());
      load();
    }
  };

  const openBrandModal = () => {
    setBrandModalValue("");
    setBrandModal(true);
  };

  const bulkApplyBrand = async () => {
    if (!selected.size || !brandModalValue) return;
    setBrandSaving(true);
    const results = await Promise.all(
      products.filter(p => selected.has(p.id)).map(async p => {
        const res = await fetch(`/api/admin/products/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...p, brand: brandModalValue }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, id: p.id, msg: err.error ?? `HTTP ${res.status}` };
        }
        return { ok: true, id: p.id };
      })
    );
    setBrandSaving(false);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      showMsg(`오류: ${failed[0].msg}`);
    } else {
      setBrandModal(false);
      setBrandModalValue("");
      showMsg(`${selected.size}개 상품 브랜드 → "${brandModalValue}" 변경 완료`);
      setSelected(new Set());
      load();
    }
  };

  // ─ 필터링 & 정렬 ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...products];

    // 검색 — 띄어쓰기로 여러 단어를 입력하면, 순서·연속 여부와 무관하게 모든 단어가
    // 어딘가에 포함되어 있으면 찾는다(기존엔 입력한 문자열 전체가 한 번에 이어져 있어야만 매치됐음).
    if (applied.query) {
      const tokens = applied.query.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const field =
          applied.type === "상품명"   ? p.name :
          applied.type === "상품코드" ? (p.sku ?? "") :
          applied.type === "브랜드"   ? (p.brand ?? "") :
          applied.type === "제조사"   ? (p.manufacturer ?? "") : "";
        const hay = field.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }

    // 날짜
    if (datePreset !== "전체") {
      const cutoff = getDateCutoff(datePreset);
      if (cutoff) list = list.filter(p => !p.createdAt || new Date(p.createdAt) >= cutoff);
    } else if (dateStart || dateEnd) {
      list = list.filter(p => {
        if (!p.createdAt) return true;
        const d = new Date(p.createdAt);
        if (dateStart && d < new Date(dateStart)) return false;
        if (dateEnd && d > new Date(dateEnd + "T23:59:59")) return false;
        return true;
      });
    }

    // 판매 상태
    if (statusFilter !== "전체") list = list.filter(p => (p.status ?? "판매중") === statusFilter);

    // 브랜드
    if (brandFilter !== "전체") list = list.filter(p => (p.brand ?? "") === brandFilter);

    // 카테고리 (다중 카테고리(categories) 우선, 없으면 구버전 category/subCategory 사용)
    if (categoryFilter !== "전체") {
      list = list.filter(p => {
        const raw = (p as Record<string, unknown>).categories as { main: string; sub: string }[] | undefined;
        const entries = raw?.length ? raw : (p.category ? [{ main: p.category, sub: p.subCategory ?? "" }] : []);
        return entries.some(c => c.main === categoryFilter && (subCategoryFilter === "전체" || c.sub === subCategoryFilter));
      });
    }

    // 사이즈
    if (sizeFilter !== "전체") list = list.filter(p => (p.sizes ?? []).includes(sizeFilter));

    // 임시등록만 보기
    if (tempOnlyFilter) list = list.filter(isTempRegistered);

    // 정렬
    list.sort((a, b) => {
      if (sortBy === "이름순") return a.name.localeCompare(b.name);
      if (sortBy === "최신순") return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      if (sortBy === "최종수정순") return (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? "");
      return 0;
    });

    return list;
  }, [products, applied, datePreset, dateStart, dateEnd, statusFilter, brandFilter, categoryFilter, subCategoryFilter, sizeFilter, tempOnlyFilter, isTempRegistered, sortBy]);

  const stats = useMemo(() => ({
    total:    filtered.length,
    판매중:   filtered.filter(p => (p.status ?? "판매중") === "판매중").length,
    품절:     filtered.filter(p => p.status === "품절").length,
    판매중지: filtered.filter(p => p.status === "판매중지").length,
    진열대기: filtered.filter(p => p.status === "진열대기").length,
    예약판매: filtered.filter(p => p.status === "예약판매").length,
    임시등록: filtered.filter(isTempRegistered).length,
  }), [filtered, isTempRegistered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);

  // 복원된 page가 범위를 벗어나면 보정
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const handleSearch = () => {
    setApplied({ type: searchType, query: searchQuery });
    setPage(1); setSelected(new Set());
  };
  const handleReset = () => {
    setSearchQuery("");
    setSearchType("상품명");
    setApplied({ type: "상품명", query: "" });
    setStatusFilter("전체"); setBrandFilter("전체");
    setCategoryFilter("전체"); setSubCategoryFilter("전체"); setSizeFilter("전체");
    setDatePreset("전체"); setDateStart(""); setDateEnd(""); setDateRangeOpen(false);
    setTempOnlyFilter(false);
    setPage(1); setSelected(new Set());
  };

  // 현재 필터·정렬 적용된 목록을 엑셀로 다운로드 (Excel 업로드 템플릿과 동일한 열 구성)
  const handleDownloadExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = filtered.map((p) => ({
      "상품명": p.name,
      "상품코드": p.sku ?? "",
      "사이즈(;구분)": (p.sizes ?? []).join(";"),
      "색상(;구분)": (p.colors ?? []).map((c) => c.name).join(";"),
      "브랜드": p.brand ?? "",
      "대카테고리": p.category,
      "중카테고리": p.subCategory,
      "제조사": p.manufacturer ?? "",
      "원산지": p.origin ?? "",
      "판매가": p.price ?? "",
      "소비자가": p.consumerPrice ?? "",
      "공급가": p.supplyPrice ?? "",
      "판매상태": p.status ?? "판매중",
      "진열상태": DISPLAY_ON.includes(p.status ?? "판매중") ? "진열함" : "진열안함",
      "업로드일자": p.createdAt ? p.createdAt.slice(0, 10) : "",
      "수정일자": (p.updatedAt ?? p.createdAt) ? (p.updatedAt ?? p.createdAt)!.slice(0, 10) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품목록");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `상품목록_${today}.xlsx`);
  };

  // 전체 상품 데이터 + 참조된 모든 이미지를 ZIP으로 백업 (필터와 무관하게 전체)
  const [backingUp, setBackingUp] = useState(false);
  const handleBackupAll = async () => {
    if (!confirm("등록된 모든 상품 데이터와 이미지를 ZIP으로 백업합니다. 이미지 수가 많으면 시간이 걸릴 수 있습니다. 계속할까요?")) return;
    setBackingUp(true);
    try {
      const res = await fetch("/api/admin/products/backup");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "백업 생성에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `products-backup-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("백업 생성 중 네트워크 오류가 발생했습니다.");
    } finally {
      setBackingUp(false);
    }
  };

  // ─ 체크박스 ────────────────────────────────────────────────────────────
  const allSel = paginated.length > 0 && paginated.every(p => selected.has(p.id));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSel) paginated.forEach(p => next.delete(p.id));
      else paginated.forEach(p => next.add(p.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // 상단 툴바의 수정 버튼은 단일 선택일 때만 해당 상품의 수정 페이지로 이동
  const singleSelected = selected.size === 1 ? products.find(p => selected.has(p.id)) : undefined;
  const goEdit = () => {
    try {
      const prev = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}");
      const sc = document.querySelector("main");
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({ ...prev, scrollTop: sc ? sc.scrollTop : 0 }));
    } catch { /* noop */ }
  };

  // ─ 일괄 작업 ────────────────────────────────────────────────────────────
  const bulkStatus = async (status: string) => {
    if (!selected.size) return;
    await Promise.all(
      products.filter(p => selected.has(p.id)).map(p =>
        fetch(`/api/admin/products/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...p, status }),
        })
      )
    );
    showMsg(`${selected.size}개 상품 상태 → "${status}"`);
    setSelected(new Set()); load();
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`선택된 ${selected.size}개 제품을 삭제하시겠습니까?`)) return;
    await Promise.all([...selected].map(id => fetch(`/api/admin/products/${id}`, { method: "DELETE" })));
    showMsg(`${selected.size}개 삭제 완료`);
    setSelected(new Set()); load();
  };

  const duplicateOne = async (p: Product) => {
    const suffix = Date.now().toString(36).slice(-4);
    const payload = { ...p, id: `${p.id}-copy-${suffix}`, name: `${p.name} (복사본)`, isNew: false };
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, msg: err.error ?? "복제 실패" };
  };

  const bulkDuplicate = async () => {
    if (!selected.size) return;
    const targets = products.filter(p => selected.has(p.id));
    const results = await Promise.all(targets.map(duplicateOne));
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) showMsg(`오류: ${failed[0].msg}`);
    else showMsg(`${targets.length}개 복제 완료`);
    setSelected(new Set()); load();
  };

  const applyMainExpose = async () => {
    if (!selected.size || !exposeTarget.size) return;
    setExposeSaving(true);
    const targets = [...exposeTarget] as MainExpose[];
    await Promise.all(
      products.filter(p => selected.has(p.id)).map(p => {
        const curr = (p.mainExpose ?? []) as MainExpose[];
        const next: MainExpose[] =
          exposeMode === "교체" ? targets :
          exposeMode === "추가" ? [...new Set([...curr, ...targets])] :
          curr.filter(e => !targets.includes(e));
        return fetch(`/api/admin/products/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...p, mainExpose: next, isNew: next.includes("신상품") }),
        });
      })
    );
    setExposeSaving(false); setExposeModal(false); setExposeTarget(new Set());
    showMsg(`${selected.size}개 상품 메인 진열 업데이트 완료`);
    setSelected(new Set()); load();
  };

  const handleSeed = async () => {
    if (!confirm("샘플 10개를 Supabase에 추가합니다. 계속할까요?")) return;
    setSeeding(true);
    const res = await fetch("/api/admin/seed", { method: "POST" });
    const d = await res.json();
    setSeeding(false);
    if (d.ok) { showMsg(`${d.count}개 추가됐습니다.`); load(); }
    else showMsg(`오류: ${d.error}`);
  };

  const isFiltered = applied.query || statusFilter !== "전체" || brandFilter !== "전체" || categoryFilter !== "전체" || sizeFilter !== "전체" || datePreset !== "전체" || dateStart || dateEnd || tempOnlyFilter;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">제품 관리</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {products.length === 0 && !loading && !tableError && (
            <button onClick={handleSeed} disabled={seeding}
              className="px-5 py-2.5 text-base bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 rounded font-medium">
              {seeding ? "추가 중..." : "샘플 10개 추가"}
            </button>
          )}
          <button onClick={() => setCatalogModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-[#303236] hover:text-[#303236] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            브랜드
          </button>
          <button onClick={() => setFilterModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-[#303236] hover:text-[#303236] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-3.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            필터 관리
          </button>
          <Link href="/admin/products/import"
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-[#303236] hover:text-[#303236] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel 업로드
          </Link>
          <button onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-[#303236] hover:text-[#303236] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            Excel 다운로드
          </button>
          <button onClick={handleBackupAll} disabled={backingUp}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-[#303236] hover:text-[#303236] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {backingUp ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                백업 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V19a2 2 0 01-2 2H6a2 2 0 01-2-2v-6M12 3v12m0 0l-4-4m4 4l4-4" />
                </svg>
                전체 백업(이미지 포함)
              </>
            )}
          </button>
          <Link href="/admin/products/new"
            className="px-6 py-2.5 text-base bg-[#E5541B] text-white hover:bg-[#e04500] rounded font-bold">
            + 새 제품 추가
          </Link>
        </div>
      </div>

      {msg && <div className="px-5 py-3.5 bg-green-50 border border-green-200 text-green-700 text-base rounded-lg">{msg}</div>}

      {!loading && tableError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-base font-semibold text-amber-800 mb-1">⚠ Supabase 테이블 설정이 필요합니다.</p>
          {apiErrMsg && <p className="text-sm font-mono text-red-600 bg-red-50 px-3 py-2 border border-red-200 rounded mt-2">에러: {apiErrMsg}</p>}
        </div>
      )}

      {/* ── 검색 & 필터 ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* 검색 분류 */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 flex-wrap">
          <span className="text-[15px] font-semibold text-gray-600 w-24 shrink-0">검색 분류</span>
          <div className="flex gap-2 shrink-0">
            <select value={searchType} onChange={e => setSearchType(e.target.value as SearchType)}
              className="border border-gray-200 px-3 py-2 text-[15px] bg-white rounded w-32 focus:outline-none focus:border-[#303236]">
              {SEARCH_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={`${searchType}으로 검색...`}
              className="w-80 border border-gray-200 px-4 py-2 text-[15px] focus:outline-none focus:border-[#303236] rounded"
            />
            <button onClick={handleSearch}
              className="px-6 py-2 bg-[#303236] text-white text-[15px] font-semibold hover:bg-[#243d5e] rounded">검색</button>
            <button onClick={handleReset}
              className={`px-4 py-2 border text-[15px] rounded transition-colors ${
                isFiltered
                  ? "border-[#E5541B] text-[#E5541B] hover:bg-orange-50 font-semibold"
                  : "border-gray-200 text-gray-400 hover:border-gray-300"
              }`}>초기화</button>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <span className="text-[15px] font-semibold text-gray-600">카테고리</span>
            <select value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setSubCategoryFilter("전체"); setPage(1); }}
              className="w-40 border border-gray-200 px-3 py-2 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
              <option value="전체">전체</option>
              {catList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select value={subCategoryFilter}
              onChange={e => { setSubCategoryFilter(e.target.value); setPage(1); }}
              disabled={categoryFilter === "전체"}
              className="w-40 border border-gray-200 px-3 py-2 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236] disabled:bg-gray-50 disabled:text-gray-300">
              <option value="전체">전체</option>
              {(catList.find(c => c.name === categoryFilter)?.subs ?? []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 상품 등록일 + 브랜드 + 사이즈 */}
        <div className="flex items-center gap-3 px-6 py-3.5 flex-wrap">
          <span className="text-[15px] font-semibold text-gray-600 w-24 shrink-0">상품 등록일</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DATE_PRESETS.map(preset => (
              <button key={preset} type="button"
                onClick={() => { setDatePreset(preset); setDateStart(""); setDateEnd(""); setDateRangeOpen(false); setPage(1); }}
                className={`px-3.5 py-1.5 text-sm border rounded transition-colors ${
                  datePreset === preset
                    ? "bg-[#303236] text-white border-[#303236]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#303236]"
                }`}>{preset}</button>
            ))}
            <button type="button" onClick={() => setDateRangeOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm border rounded transition-colors ${
                dateRangeOpen || dateStart || dateEnd
                  ? "bg-[#303236] text-white border-[#303236]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#303236]"
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              기간 선택
            </button>
          </div>
          {dateRangeOpen && (
            <div className="flex items-center gap-2">
              <input type="date" value={dateStart}
                onChange={e => { setDateStart(e.target.value); setDatePreset("전체"); setPage(1); }}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded focus:outline-none focus:border-[#303236]" />
              <span className="text-gray-400 text-sm">~</span>
              <input type="date" value={dateEnd}
                onChange={e => { setDateEnd(e.target.value); setDatePreset("전체"); setPage(1); }}
                className="border border-gray-200 px-2.5 py-1.5 text-[14px] rounded focus:outline-none focus:border-[#303236]" />
            </div>
          )}
          <div className="flex items-center gap-3 ml-2">
            <span className="text-[15px] font-semibold text-gray-600">브랜드</span>
            <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 px-3 py-1.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
              <option value="전체">전체</option>
              {brandList.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-gray-600">사이즈</span>
            <select value={sizeFilter} onChange={e => { setSizeFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 px-3 py-1.5 text-[15px] bg-white rounded focus:outline-none focus:border-[#303236]">
              <option value="전체">전체</option>
              {sizeList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── 결과 요약 ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap text-[15px] text-gray-600">
        <span className="font-bold text-[#303236] text-lg">{stats.total}</span><span>건</span>
        {stats.판매중 > 0 && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setStatusFilter("판매중"); setPage(1); }}
            className={`cursor-pointer hover:text-emerald-700 transition-colors ${statusFilter === "판매중" ? "font-bold text-emerald-700" : "text-emerald-600"}`}>
            판매중 <b>{stats.판매중}</b>
          </button></>
        )}
        {stats.품절 > 0 && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setStatusFilter("품절"); setPage(1); }}
            className={`cursor-pointer hover:text-red-600 transition-colors ${statusFilter === "품절" ? "font-bold text-red-600" : "text-red-500"}`}>
            품절 <b>{stats.품절}</b>
          </button></>
        )}
        {stats.예약판매 > 0 && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setStatusFilter("예약판매"); setPage(1); }}
            className={`cursor-pointer hover:text-blue-600 transition-colors ${statusFilter === "예약판매" ? "font-bold text-blue-600" : "text-blue-500"}`}>
            예약판매 <b>{stats.예약판매}</b>
          </button></>
        )}
        {stats.판매중지 > 0 && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setStatusFilter("판매중지"); setPage(1); }}
            className={`cursor-pointer hover:text-gray-500 transition-colors ${statusFilter === "판매중지" ? "font-bold text-gray-500" : "text-gray-400"}`}>
            판매중지 <b>{stats.판매중지}</b>
          </button></>
        )}
        {stats.진열대기 > 0 && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setStatusFilter("진열대기"); setPage(1); }}
            className={`cursor-pointer hover:text-amber-600 transition-colors ${statusFilter === "진열대기" ? "font-bold text-amber-600" : "text-amber-500"}`}>
            진열대기 <b>{stats.진열대기}</b>
          </button></>
        )}
        {stats.임시등록 > 0 && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setTempOnlyFilter(v => !v); setPage(1); }}
            title="지점 출고 패스에서 빠르게 임시등록한 상품 (정식 정보 미입력)"
            className={`cursor-pointer hover:text-pink-600 transition-colors ${tempOnlyFilter ? "font-bold text-pink-600" : "text-pink-500"}`}>
            임시등록 <b>{stats.임시등록}</b>
          </button></>
        )}
        {(statusFilter !== "전체" || tempOnlyFilter) && (
          <><span className="mx-2 text-gray-300">|</span>
          <button onClick={() => { setStatusFilter("전체"); setTempOnlyFilter(false); setSortBy("최종수정순"); setPage(1); }}
            className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors text-[13px] underline">
            초기화
          </button></>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">

          {/* ── 일괄 작업 바 (액션 버튼 + 컬럼표시/정렬/페이지수 한 줄) ──────────── */}
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2 flex-wrap">
              {selected.size > 0 && (
                <span className="text-[15px] font-bold text-[#303236] mr-1">{selected.size}개 선택</span>
              )}
              {[
                { label: "진열함",   action: () => bulkStatus("판매중") },
                { label: "진열안함", action: () => bulkStatus("판매중지") },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={!selected.size}
                  className="px-3 py-1.5 text-[14px] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed rounded">
                  {btn.label}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-300 mx-1" />
              {singleSelected ? (
                <Link href={`/admin/products/${singleSelected.id}/edit`} onClick={goEdit}
                  className="px-3 py-1.5 text-[14px] border border-[#303236] bg-white text-[#303236] hover:bg-[#303236] hover:text-white rounded font-semibold">
                  수정
                </Link>
              ) : (
                <button disabled title="상품 1개만 선택하면 수정할 수 있습니다."
                  className="px-3 py-1.5 text-[14px] border border-gray-300 bg-white text-gray-700 opacity-40 cursor-not-allowed rounded font-semibold">
                  수정
                </button>
              )}
              <button onClick={bulkDuplicate} disabled={!selected.size}
                className="px-3 py-1.5 text-[14px] border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed rounded">
                복제
              </button>
              <button onClick={bulkDelete} disabled={!selected.size}
                className="px-3 py-1.5 text-[14px] border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded">
                삭제
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button onClick={() => selected.size && openCatModal()} disabled={!selected.size}
                className="px-3 py-1.5 text-[14px] border border-[#E5541B] bg-white text-[#E5541B] hover:bg-[#E5541B] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed rounded font-semibold">
                카테고리 추가
              </button>
              <button onClick={() => selected.size && openBrandModal()} disabled={!selected.size}
                className="px-3 py-1.5 text-[14px] border border-[#E5541B] bg-white text-[#E5541B] hover:bg-[#E5541B] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed rounded font-semibold">
                브랜드 변경
              </button>

              {/* 우측: 컬럼 표시/숨김 + 정렬 + 페이지수 */}
              <div className="flex items-center gap-2 ml-auto">
                {/* 컬럼 표시/숨김 드롭다운 */}
                <div className="relative">
                  <button onClick={() => setColMenuOpen(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[14px] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    컬럼
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${colMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {colMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setColMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 shadow-lg rounded min-w-[160px] py-2">
                        <p className="px-3 pb-1.5 mb-1 text-[12px] text-gray-400 border-b border-gray-100">표시할 컬럼</p>
                        {TOGGLE_COLS.map(c => (
                          <label key={c} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                            <input type="checkbox" checked={visibleCols[c] ?? true} onChange={() => toggleCol(c)}
                              className="w-3.5 h-3.5 accent-[#303236]" />
                            <span className="text-[13px] text-gray-700">{c}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <select value={sortBy} onChange={e => { setSortBy(e.target.value as SortBy); setPage(1); }}
                  className="border border-gray-200 px-3 py-1.5 text-[14px] bg-white rounded focus:outline-none">
                  <option>최종수정순</option><option>최신순</option><option>진열순</option><option>이름순</option>
                </select>
                <select value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}
                  className="border border-gray-200 px-3 py-1.5 text-[14px] bg-white rounded focus:outline-none">
                  <option value={20}>20개씩</option>
                  <option value={50}>50개씩</option>
                  <option value={100}>100개씩</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── 테이블 (자체 스크롤 영역 + 열 헤더 sticky 고정) ── */}
          <div className="overflow-auto max-h-[58vh]" style={{ scrollbarGutter: "stable" }}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input type="checkbox" checked={allSel} onChange={toggleAll}
                      className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                  </th>
                  {["상태", "브랜드", "상품명", "품번", "가격", "카테고리", "색상", "사이즈", "최종수정"]
                    .filter(h => !TOGGLE_COLS.includes(h) || visibleCols[h])
                    .map(h => {
                      const handleHeaderClick = () => {
                        if (h === "최종수정") setSortBy("최종수정순");
                        else if (h === "상품명") setSortBy("이름순");
                        setPage(1);
                      };
                      const isSortable = ["최종수정", "상품명"].includes(h);
                      return (
                        <th key={h}
                          onClick={handleHeaderClick}
                          className={`py-4 text-[13px] font-bold uppercase tracking-wide whitespace-nowrap text-left ${h === "상태" ? "px-3 w-[56px]" : "px-5"} ${isSortable ? "cursor-pointer text-gray-700 hover:bg-gray-100 transition-colors" : "text-gray-500"}`}>
                          {h}
                          {isSortable && (sortBy === "최종수정순" && h === "최종수정" || sortBy === "이름순" && h === "상품명") && <span className="ml-1">▼</span>}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={2 + TOGGLE_COLS.filter(c => visibleCols[c]).length} className="py-20 text-center text-[15px] text-gray-400">
                      {products.length === 0 ? "등록된 제품이 없습니다. 상단의 '샘플 10개 추가' 또는 '+ 새 제품 추가'로 시작하세요." : "검색 조건에 맞는 제품이 없습니다."}
                    </td>
                  </tr>
                ) : paginated.map(p => (
                  <tr key={p.id} className={`transition-colors ${
                    selected.has(p.id)
                      ? "bg-blue-50/60"
                      : isTempRegistered(p)
                      ? "bg-pink-50/70 hover:bg-pink-100/60"
                      : "hover:bg-gray-50"
                  }`}>
                    {/* 체크박스 */}
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                        className="w-[18px] h-[18px] accent-[#303236] cursor-pointer" />
                    </td>

                    {/* 상태 — 아이콘만 표시, 좁은 열 (수정은 상단 일괄작업 버튼 이용) */}
                    {visibleCols["상태"] && (
                    <td className="px-3 py-3 w-[56px]">
                      <span title={p.status ?? "판매중"}
                        className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[p.status ?? "판매중"] ?? "bg-gray-300"}`} />
                    </td>
                    )}

                    {/* 브랜드 — 컬럼 표시 토글 */}
                    {visibleCols["브랜드"] && (
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-gray-700 font-semibold">
                      {p.brand || <span className="text-gray-300 font-normal">-</span>}
                    </td>
                    )}

                    {/* 상품명 */}
                    <td data-align-start className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/products/${p.id}`} target="_blank" title="제품페이지 보기"
                          className="relative w-[44px] h-[44px] flex-shrink-0 rounded-lg overflow-hidden border border-gray-100 block">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="44px" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <span className="text-gray-300 text-[10px]">없음</span>
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <Link href={`/admin/products/${p.id}/edit`}
                            className="block truncate font-semibold text-[14px] text-gray-900 leading-tight hover:text-[#E5541B] hover:underline transition-colors">
                            {p.name}
                          </Link>
                          {isTempRegistered(p) && (
                            <span
                              title="지점 출고 패스에서 빠르게 임시등록한 상품 — 정식 정보(가격·카테고리 등) 미입력"
                              className="flex-shrink-0 px-2 py-0.5 text-[11px] font-bold bg-pink-100 text-pink-600 rounded-full whitespace-nowrap"
                            >
                              임시등록
                            </span>
                          )}
                          <button type="button" onClick={() => openQuickEdit(p)}
                            className="flex-shrink-0 px-2.5 py-1 text-xs font-semibold border border-[#303236] text-[#303236] hover:bg-[#303236] hover:text-white rounded transition-colors whitespace-nowrap">
                            퀵수정
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* 품번 — 컬럼 표시 토글 */}
                    {visibleCols["품번"] && (
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-gray-400 font-mono">
                      {p.sku || p.id}
                    </td>
                    )}

                    {/* 가격 — 컬럼 표시 토글 */}
                    {visibleCols["가격"] && (
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="block text-[14px] font-bold text-gray-800">{p.price || <span className="text-gray-300 font-normal">-</span>}</span>
                      {p.consumerPrice && (
                        <p className="text-[12px] text-gray-400 line-through">{p.consumerPrice}</p>
                      )}
                    </td>
                    )}

                    {/* 카테고리 (인라인 추가/삭제) — 컬럼 표시 토글 */}
                    {visibleCols["카테고리"] && (
                    <td className="px-5 py-4">
                      <div className="flex min-w-[150px] flex-wrap items-center justify-center gap-1">
                        {getProductCats(p).map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[12px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded whitespace-nowrap">
                            {c.main}{c.sub ? ` / ${c.sub}` : ""}
                            <button onClick={() => removeProductCat(p, i)} title="삭제"
                              className="text-gray-400 hover:text-red-500 leading-none text-[13px]">×</button>
                          </span>
                        ))}
                        {catRowId === p.id ? (
                          <span className="inline-flex items-center gap-1">
                            <select value={rowMain} onChange={e => { setRowMain(e.target.value); setRowSub(""); }}
                              className="border border-gray-200 rounded px-1.5 py-0.5 text-[12px] bg-white focus:outline-none focus:border-[#303236]">
                              {catList.map(c => <option key={c.name}>{c.name}</option>)}
                            </select>
                            <select value={rowSub} onChange={e => setRowSub(e.target.value)}
                              className="border border-gray-200 rounded px-1.5 py-0.5 text-[12px] bg-white focus:outline-none focus:border-[#303236]">
                              <option value="">서브 없음</option>
                              {(catList.find(c => c.name === rowMain)?.subs ?? []).map(s => <option key={s}>{s}</option>)}
                            </select>
                            <button onClick={() => addRowCat(p)} className="text-[12px] font-bold text-[#303236] px-1 hover:text-[#E5541B]">추가</button>
                            <button onClick={() => setCatRowId(null)} className="text-[12px] text-gray-400 px-0.5 hover:text-gray-600">취소</button>
                          </span>
                        ) : (
                          <button onClick={() => openRowCat(p)} title="카테고리 추가"
                            className="inline-flex items-center justify-center w-5 h-5 text-[14px] leading-none text-gray-400 border border-dashed border-gray-300 rounded hover:border-[#303236] hover:text-[#303236]">+</button>
                        )}
                      </div>
                    </td>
                    )}

                    {/* 색상 — 컬럼 표시 토글 */}
                    {visibleCols["색상"] && (
                    <td className="px-5 py-3">
                      {p.colors && p.colors.length > 0 ? (
                        <div className="mx-auto flex max-w-[140px] flex-wrap items-center justify-center gap-1">
                          {p.colors.slice(0, 6).map((c, i) => (
                            <span key={`${c.name}-${i}`} title={c.name}
                              className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0"
                              style={{ backgroundColor: c.hex }} />
                          ))}
                          {p.colors.length > 6 && (
                            <span className="text-[11px] text-gray-400">+{p.colors.length - 6}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-[13px]">-</span>
                      )}
                    </td>
                    )}

                    {/* 사이즈 — 컬럼 표시 토글 */}
                    {visibleCols["사이즈"] && (
                    <td className="px-5 py-3 max-w-[160px]">
                      {p.sizes && p.sizes.length > 0 ? (
                        <span className="text-[12px] text-gray-500">{p.sizes.join(", ")}</span>
                      ) : (
                        <span className="text-gray-300 text-[13px]">-</span>
                      )}
                    </td>
                    )}

                    {/* 최종수정 — 컬럼 표시 토글 */}
                    {visibleCols["최종수정"] && (
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] text-gray-400">
                      {fmtDate(p.updatedAt ?? p.createdAt)}
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── 페이지네이션 ────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2.5 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">‹</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const n = Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
                return n <= totalPages ? (
                  <button key={n} onClick={() => setPage(n)}
                    className={`px-3 py-1.5 text-[14px] border rounded ${page === n ? "bg-[#303236] text-white border-[#303236]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                    {n}
                  </button>
                ) : null;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2.5 py-1.5 text-[14px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded">»</button>
              <span className="ml-3 text-[14px] text-gray-400">{page} / {totalPages} 페이지</span>
            </div>
          )}
        </div>
      )}

      {/* ── 카테고리 추가 모달 ────────────────────────────────────────────── */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-7 py-5 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">카테고리 추가</h2>
              <p className="text-[15px] text-gray-400 mt-0.5">선택된 <span className="font-bold text-[#E5541B]">{selected.size}개</span> 상품의 기존 카테고리에 추가됩니다.</p>
            </div>
            <div className="px-7 py-6 space-y-5">
              {/* 현재 설정된 카테고리 태그 */}
              <div>
                <p className="text-[15px] font-semibold text-gray-600 mb-2.5">추가할 카테고리</p>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-3 border border-gray-200 rounded bg-gray-50">
                  {catModalCats.length === 0 && (
                    <span className="text-[13px] text-gray-300 self-center">카테고리를 추가해 주세요</span>
                  )}
                  {catModalCats.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[13px] bg-[#303236] text-white px-2.5 py-1 rounded">
                      {c.main}{c.sub ? ` / ${c.sub}` : ""}
                      <button onClick={() => removeModalCat(i)} className="text-white/60 hover:text-white ml-0.5 leading-none text-base">×</button>
                    </span>
                  ))}
                </div>
              </div>
              {/* 추가 피커 */}
              <div>
                <p className="text-[15px] font-semibold text-gray-600 mb-2.5">카테고리 추가</p>
                <div className="flex gap-2">
                  <select value={catAddMain}
                    onChange={e => { setCatAddMain(e.target.value); setCatAddSub(""); }}
                    className="flex-1 border border-gray-200 px-3 py-2 text-[14px] bg-white rounded focus:outline-none focus:border-[#303236]">
                    {catList.map(c => <option key={c.name}>{c.name}</option>)}
                  </select>
                  <select value={catAddSub} onChange={e => setCatAddSub(e.target.value)}
                    className="flex-1 border border-gray-200 px-3 py-2 text-[14px] bg-white rounded focus:outline-none focus:border-[#303236]">
                    <option value="">서브 없음</option>
                    {(catList.find(c => c.name === catAddMain)?.subs ?? []).map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <button onClick={addModalCat}
                    className="px-4 py-2 text-[14px] border border-[#303236] text-[#303236] rounded hover:bg-[#303236] hover:text-white font-bold transition-colors">
                    + 추가
                  </button>
                </div>
              </div>
              <p className="text-[13px] text-gray-400">* 각 상품의 기존 카테고리에 추가되며, 중복은 자동 제외됩니다.</p>
            </div>
            <div className="px-7 py-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => { setCatModal(false); setCatModalCats([]); }}
                className="px-6 py-2.5 border border-gray-200 text-[15px] text-gray-600 hover:border-gray-400 rounded">취소</button>
              <button onClick={bulkApplyCat} disabled={catModalCats.length === 0 || catSaving}
                className="px-6 py-2.5 bg-[#E5541B] text-white text-[15px] font-bold hover:bg-[#e04500] disabled:opacity-50 rounded">
                {catSaving ? "추가 중..." : `${selected.size}개에 추가`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 브랜드 일괄 변경 모달 ────────────────────────────────────────── */}
      {brandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-7 py-5 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">브랜드 일괄 변경</h2>
              <p className="text-[15px] text-gray-400 mt-0.5">선택된 <span className="font-bold text-[#E5541B]">{selected.size}개</span> 상품의 브랜드가 아래 값으로 교체됩니다.</p>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div>
                <p className="text-[15px] font-semibold text-gray-600 mb-2.5">변경할 브랜드</p>
                <select value={brandModalValue} onChange={e => setBrandModalValue(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2 text-[14px] bg-white rounded focus:outline-none focus:border-[#303236]">
                  <option value="">브랜드 선택</option>
                  {brandList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <p className="text-[13px] text-gray-400">* 선택된 상품의 기존 브랜드는 여기서 고른 값으로 대체됩니다.</p>
            </div>
            <div className="px-7 py-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => { setBrandModal(false); setBrandModalValue(""); }}
                className="px-6 py-2.5 border border-gray-200 text-[15px] text-gray-600 hover:border-gray-400 rounded">취소</button>
              <button onClick={bulkApplyBrand} disabled={!brandModalValue || brandSaving}
                className="px-6 py-2.5 bg-[#E5541B] text-white text-[15px] font-bold hover:bg-[#e04500] disabled:opacity-50 rounded">
                {brandSaving ? "변경 중..." : `${selected.size}개에 적용`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 메인진열 수정 모달 ────────────────────────────────────────────── */}
      {exposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-7 py-5 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">메인 진열 수정</h2>
              <p className="text-[15px] text-gray-400 mt-0.5">선택된 <span className="font-bold text-[#303236]">{selected.size}개</span> 상품에 일괄 적용됩니다.</p>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div>
                <p className="text-[15px] font-semibold text-gray-600 mb-2.5">적용 방식</p>
                <div className="flex gap-4">
                  {(["추가", "교체", "제거"] as const).map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="em" checked={exposeMode === m} onChange={() => setExposeMode(m)}
                        className="accent-[#303236] w-4 h-4" />
                      <span className="text-[16px] text-gray-700">{m}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[13px] text-gray-400 mt-1.5">
                  {exposeMode === "추가" ? "기존 설정을 유지하면서 선택한 영역을 추가합니다." :
                   exposeMode === "교체" ? "기존 설정을 모두 지우고 선택한 영역으로 교체합니다." :
                   "기존 설정에서 선택한 영역만 제거합니다."}
                </p>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-gray-600 mb-2.5">노출 영역</p>
                <div className="flex flex-wrap gap-2">
                  {EXPOSE_OPTIONS.map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setExposeTarget(prev => { const n = new Set(prev); n.has(opt) ? n.delete(opt) : n.add(opt); return n; })}
                      className={`px-4 py-2 text-[15px] border rounded font-medium transition-colors ${
                        exposeTarget.has(opt) ? "bg-[#E5541B] text-white border-[#E5541B]" : "bg-white text-gray-600 border-gray-200 hover:border-[#E5541B]"
                      }`}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-7 py-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => { setExposeModal(false); setExposeTarget(new Set()); }}
                className="px-6 py-2.5 border border-gray-200 text-[15px] text-gray-600 hover:border-gray-400 rounded">취소</button>
              <button onClick={applyMainExpose} disabled={!exposeTarget.size || exposeSaving}
                className="px-6 py-2.5 bg-[#E5541B] text-white text-[15px] font-bold hover:bg-[#e04500] disabled:opacity-50 rounded">
                {exposeSaving ? "적용 중..." : `${selected.size}개에 적용`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 퀵수정 팝업 (상품명 옆 "퀵수정" 버튼) — 색상·사이즈·브랜드만 빠르게 ──────── */}
      {quickEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeQuickEdit}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-7 py-5 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">퀵수정</h2>
              <p className="text-[13px] text-gray-400 mt-0.5 truncate">{quickEditTarget.name} — 색상·사이즈·브랜드만 빠르게 변경합니다.</p>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-gray-600 mb-1.5">브랜드</label>
                <select value={quickEditBrand} onChange={(e) => setQuickEditBrand(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2 text-sm bg-white rounded focus:outline-none focus:border-[#303236]">
                  <option value="">선택 안 함</option>
                  {brandList.map((b) => <option key={b} value={b}>{b}</option>)}
                  {quickEditBrand && !brandList.includes(quickEditBrand) && <option value={quickEditBrand}>{quickEditBrand}</option>}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 mb-1.5">사이즈</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QE_CLOTHING_SIZE_PRESETS.map((size) => {
                    const active = quickEditSizes.includes(size);
                    return (
                      <button key={size} type="button" onClick={() => qeToggleSize(size)}
                        className={`min-w-[40px] px-2.5 py-1 text-xs border font-semibold rounded transition-colors ${
                          active ? "bg-[#303236] text-white border-[#303236]" : "bg-white text-gray-300 border-gray-200 line-through"
                        }`}>
                        {size}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input value={quickEditSizeInput} onChange={(e) => setQuickEditSizeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); qeAddCustomSize(); } }}
                    placeholder="직접 입력 후 Enter (예: 230,240)"
                    className="flex-1 border border-gray-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-[#303236]" />
                  <button type="button" onClick={qeAddCustomSize}
                    className="px-3 py-2 bg-[#303236] text-white text-xs rounded hover:bg-[#243d5e] transition-colors">추가</button>
                </div>
                {quickEditSizes.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">선택된 사이즈: {quickEditSizes.join(", ")}</p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 mb-1.5">색상</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QE_COLOR_PRESETS.map((preset) => {
                    const selected = quickEditColors.some((c) => c.name === preset.name);
                    return (
                      <button key={preset.name} type="button" onClick={() => qeToggleColor(preset)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs rounded transition-colors ${
                          selected ? "border-[#E5541B] bg-orange-50 font-semibold text-gray-800" : "border-gray-200 text-gray-600 hover:border-gray-400"
                        }`}>
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.hex }} />
                        {preset.name}
                        {selected && <span className="text-[#E5541B] font-bold">✓</span>}
                      </button>
                    );
                  })}
                  {qeColorDropdownOptions.length > 0 && (
                    <div className="relative">
                      <button type="button" onClick={() => setQeColorDropdownOpen((v) => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#303236] text-[#303236] text-xs rounded hover:border-[#E5541B] hover:text-[#E5541B] transition-colors">
                        자주 쓴 색상
                        <span className="text-gray-400">{qeColorDropdownOpen ? "▲" : "▼"}</span>
                      </button>
                      {qeColorDropdownOpen && (
                        <div className="absolute z-20 mt-1 left-0 w-52 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
                          {qeColorDropdownOptions.map((opt) => {
                            const selected = quickEditColors.some((c) => c.name === opt.name);
                            return (
                              <button key={opt.name} type="button" onClick={() => { qeToggleColor(opt); setQeColorDropdownOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b border-gray-50 last:border-0 ${
                                  selected ? "bg-orange-50 font-semibold text-gray-800" : "text-gray-600 hover:bg-gray-50"
                                }`}>
                                <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: opt.hex }} />
                                <span className="flex-1">{opt.name}</span>
                                {selected && <span className="text-[#E5541B] font-bold">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input value={quickEditColorName} onChange={(e) => setQuickEditColorName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); qeAddCustomColor(); } }}
                    placeholder="커스텀 색상명 (예: 형광그린)"
                    className="flex-1 border border-gray-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-[#303236]" />
                  <input type="color" value={quickEditColorHex} onChange={(e) => setQuickEditColorHex(e.target.value)}
                    className="w-10 h-9 border border-gray-200 cursor-pointer rounded p-0.5" />
                  <button type="button" onClick={qeAddCustomColor}
                    className="px-3 py-2 bg-[#303236] text-white text-xs rounded hover:bg-[#243d5e] transition-colors">추가</button>
                </div>
                {quickEditColors.filter((c) => !QE_COLOR_PRESETS.some((p) => p.name === c.name)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {quickEditColors.filter((c) => !QE_COLOR_PRESETS.some((p) => p.name === c.name)).map((c) => (
                      <div key={c.name} className="flex items-center gap-1.5 border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs rounded">
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                        {c.name}
                        <button type="button" onClick={() => qeRemoveColor(c.name)} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link href={`/admin/products/${quickEditTarget.id}/edit`} onClick={closeQuickEdit}
                className="text-xs text-[#303236] underline underline-offset-2 hover:text-[#E5541B] inline-block">
                전체 수정 페이지 열기 ↗
              </Link>
            </div>
            <div className="px-7 py-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={closeQuickEdit}
                className="px-6 py-2.5 border border-gray-200 text-[15px] text-gray-600 hover:border-gray-400 rounded">취소</button>
              <button onClick={saveQuickEdit} disabled={quickEditSaving}
                className="px-6 py-2.5 bg-[#E5541B] text-white text-[15px] font-bold hover:bg-[#e04500] disabled:opacity-50 rounded">
                {quickEditSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 브랜드/제조사 관리 · 필터 관리 팝업 */}
      <CatalogManagerModal open={catalogModalOpen} onClose={() => setCatalogModalOpen(false)} />
      <FilterManagerModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} />
    </div>
  );
}
