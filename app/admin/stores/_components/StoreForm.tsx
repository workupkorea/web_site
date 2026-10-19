"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export type StoreFormData = {
  name: string;
  store_code: string;
  ship_name: string;
  region: string;
  address: string;
  hoursWeekday: string;
  hoursWeekend: string;
  phone: string;
  store_type: string;
  description: string;
  brands: string;
  parking: boolean;
  kakao_channel_url: string;
  store_url: string;
  is_active: boolean;
  page_active: boolean;
  open_date: string;
  sort_order: string;
  image_urls: string[];
  product_ids: string[];
};

type ProductOption = { id: string; name: string };

function parseHours(hours: string): { weekday: string; weekend: string; same: boolean } {
  if (!hours) return { weekday: "", weekend: "", same: true };
  if (hours.includes("(평일)") && hours.includes("(주말)")) {
    const [wdPart, wePart] = hours.split(" / ");
    const weekday = wdPart.replace(" (평일)", "").trim();
    const weekend = wePart.replace(" (주말)", "").trim();
    return { weekday, weekend, same: weekday === weekend };
  }
  const clean = hours.replace(/\s*\(.*?\)\s*/g, "").trim();
  return { weekday: clean, weekend: clean, same: true };
}

function buildHours(weekday: string, weekend: string, same: boolean): string {
  const wd = weekday.trim();
  const we = same ? wd : weekend.trim();
  if (!wd && !we) return "";
  if (same || wd === we) return wd ? `${wd} (매일)` : "";
  return `${wd} (평일) / ${we} (주말)`;
}

const STORE_TYPES = ["직영점", "대리점", "아울렛", "복합쇼핑몰", "기타"];

// 상품명 검색으로 제품을 선택하는 입력 — 선택되면 칩 형태로 표시, 드롭다운 없이 타이핑한 만큼만 후보 노출
function ProductSearchSlot({
  label,
  value,
  products,
  onChange,
}: {
  label: string;
  value: string;
  products: ProductOption[];
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  const suggestions = query.trim()
    ? products.filter((p) => p.name.includes(query.trim())).slice(0, 8)
    : [];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5 font-medium">{label}</p>
      {selected ? (
        <div className="flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
          <span className="text-sm text-gray-900 truncate">{selected.name}</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-gray-400 hover:text-red-500 text-xs ml-2 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="상품명 검색"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
          />
          {open && query.trim() && (
            <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {suggestions.length > 0 ? (
                suggestions.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onChange(p.id); setQuery(""); setOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-2 text-sm text-gray-400">검색 결과가 없습니다.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type InitialData = Partial<{
  name: string; store_code: string; ship_name: string | null; region: string; address: string; hours: string; phone: string;
  store_type: string; description: string; brands: string[] | string;
  parking: boolean; kakao_channel_url: string; store_url: string;
  is_active: boolean; page_active: boolean; open_date: string | null; sort_order: number | string; image_urls: string[];
  product_ids: string[]; lat: unknown; lng: unknown;
}>;

export default function StoreForm({
  storeId,
  initialData,
}: {
  storeId?: number;
  initialData?: InitialData;
}) {
  const router = useRouter();
  const isEdit = !!storeId;

  const normalize = (d: InitialData | undefined): { form: StoreFormData; same: boolean } => {
    const parsed = parseHours(d?.hours ?? "");
    return {
      form: {
        name: d?.name ?? "",
        store_code: d?.store_code ?? "",
        ship_name: d?.ship_name ?? "",
        region: d?.region ?? "",
        address: d?.address ?? "",
        hoursWeekday: parsed.weekday,
        hoursWeekend: parsed.weekend,
        phone: d?.phone ?? "",
        store_type: d?.store_type ?? "직영점",
        description: d?.description ?? "",
        brands: Array.isArray(d?.brands) ? d.brands.join(";") : (d?.brands ?? ""),
        parking: d?.parking ?? false,
        kakao_channel_url: d?.kakao_channel_url ?? "",
        store_url: d?.store_url ?? "",
        is_active: d?.is_active ?? true,
        page_active: d?.page_active ?? (storeId ? true : false), // 신규 등록은 비노출이 기본
        open_date: d?.open_date ?? "",
        sort_order: String(d?.sort_order ?? "0"),
        image_urls: Array.isArray(d?.image_urls) ? d.image_urls : [],
        product_ids: Array.isArray(d?.product_ids) ? d.product_ids : [],
      },
      same: parsed.same,
    };
  };

  const { form: initForm, same: initSame } = normalize(initialData);
  const [form, setForm] = useState<StoreFormData>(initForm);
  const [hoursSame, setHoursSame] = useState(initSame);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extraOpen, setExtraOpen] = useState(true); // 추가 정보는 펼친 상태가 기본
  const [productsOpen, setProductsOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/products")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ProductOption[]) => setProducts(data.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, []);

  const setProductSlot = (slot: number, productId: string) => {
    setForm((prev) => {
      const ids = [...prev.product_ids];
      ids[slot] = productId;
      return { ...prev, product_ids: ids.filter(Boolean).slice(0, 3) };
    });
  };

  const set = (k: keyof StoreFormData, v: string | boolean | string[]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSameChange = (checked: boolean) => {
    setHoursSame(checked);
    if (checked) setForm((prev) => ({ ...prev, hoursWeekend: prev.hoursWeekday }));
  };

  const handleWeekdayChange = (v: string) => {
    setForm((prev) => ({
      ...prev,
      hoursWeekday: v,
      hoursWeekend: hoursSame ? v : prev.hoursWeekend,
    }));
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setForm((prev) => ({ ...prev, image_urls: [...prev.image_urls, url] }));
      } else {
        alert("이미지 업로드 실패");
      }
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) =>
    setForm((prev) => ({ ...prev, image_urls: prev.image_urls.filter((_, i) => i !== idx) }));

  // 삭제 확인 팝업 → 관리자 비밀번호 검증 후 삭제
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const closeDelete = () => { setDeleteOpen(false); setDeletePw(""); setDeleteError(""); };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePw) return setDeleteError("비밀번호를 입력하세요.");
    setSaving(true);
    setDeleteError("");
    const res = await fetch(`/api/admin/stores/${storeId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePw }),
    });
    if (res.ok) {
      router.push("/admin/stores");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error ?? "삭제 실패");
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("매장명을 입력하세요.");
    if (!form.address.trim()) return setError("주소를 입력하세요.");
    setSaving(true);
    setError("");
    const { hoursWeekday, hoursWeekend, ...rest } = form;
    const payload = {
      ...rest,
      hours: buildHours(hoursWeekday, hoursWeekend, hoursSame),
      sort_order: Number(form.sort_order) || 0,
      open_date: form.open_date || null,
      brands: form.brands.split(";").map((b) => b.trim()).filter(Boolean),
    };
    const url = isEdit ? `/api/admin/stores/${storeId}` : "/api/admin/stores";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push("/admin/stores");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "저장 실패");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-7xl">
      {error && (
        <div className="px-5 py-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* 저장 · 취소 (우측 상단) */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-[#E5541B] text-white text-base font-semibold hover:bg-[#e04500] transition-colors disabled:opacity-50 rounded"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </span>
          ) : isEdit ? "수정 완료" : "매장 등록"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/stores")}
          className="px-6 py-3 border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-colors rounded"
        >
          취소
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* 기본 정보 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">기본 정보</h2>
        <div className="grid grid-cols-2 gap-5">
          {/* 매장명 · W지점명 */}
          <div className="col-span-2 grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                매장명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="워크업 포천직영점"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">W지점명</label>
              <input
                type="text"
                value={form.ship_name}
                onChange={(e) => set("ship_name", e.target.value)}
                placeholder="포천직영점 (택배 발송 기준 가맹점명)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
              />
              <p className="mt-1 text-[12px] text-gray-400">wjumun 가맹점명과 같게 입력. 출고패스에 활용됨.</p>
            </div>
          </div>
          {/* 지점코드 · 지역 · 매장유형 */}
          <div className="col-span-2 grid grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">지점코드</label>
              <input
                type="text"
                value={form.store_code}
                onChange={(e) => set("store_code", e.target.value)}
                placeholder="WUP001"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#303236]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">지역</label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                placeholder="경기 / 서울 / 부산 등"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">매장 유형</label>
              <select
                value={form.store_type}
                onChange={(e) => set("store_type", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
              >
                {STORE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-[1fr_200px] gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="경기도 포천시 호국로 90 워크업 포천 본점"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">전화번호</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="031-000-0000"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          </div>
        </div>

        {/* 영업시간 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">영업시간</label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hoursSame}
                onChange={(e) => handleSameChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
              />
              <span className="text-sm text-gray-600">평일 · 주말 동일</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">평일</p>
              <input
                type="text"
                value={form.hoursWeekday}
                onChange={(e) => handleWeekdayChange(e.target.value)}
                placeholder="10:00 - 20:00"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">주말 · 공휴일</p>
              <input
                type="text"
                value={hoursSame ? form.hoursWeekday : form.hoursWeekend}
                onChange={(e) => set("hoursWeekend", e.target.value)}
                placeholder="10:00 - 19:00"
                disabled={hoursSame}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236] disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
          {(form.hoursWeekday || (!hoursSame && form.hoursWeekend)) && (
            <p className="text-xs text-gray-400">
              저장값: {buildHours(form.hoursWeekday, form.hoursWeekend, hoursSame)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">매장 소개</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="매장 소개 및 특징을 입력하세요."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
          />
        </div>
      </section>

      {/* 추가 정보 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <button
          type="button"
          onClick={() => setExtraOpen((v) => !v)}
          aria-expanded={extraOpen}
          className="w-full flex items-center justify-between text-left text-base font-bold text-gray-900 border-b border-gray-100 pb-3"
        >
          추가 정보
          <span className="text-xs font-normal text-gray-400">{extraOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
        <div className={`grid grid-cols-2 gap-5 ${extraOpen ? "" : "hidden"}`}>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              취급 브랜드 <span className="text-xs font-normal text-gray-400">(세미콜론으로 구분: 나이키;아디다스;워크업)</span>
            </label>
            <input
              type="text"
              value={form.brands}
              onChange={(e) => set("brands", e.target.value)}
              placeholder="WORKUP;나이키;아디다스"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">카카오 채널 URL</label>
            <input
              type="url"
              value={form.kakao_channel_url}
              onChange={(e) => set("kakao_channel_url", e.target.value)}
              placeholder="https://pf.kakao.com/..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">스토어 URL</label>
            <input
              type="url"
              value={form.store_url}
              onChange={(e) => set("store_url", e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">정렬 순서</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">오픈 예정일 (선택)</label>
            <input
              type="date"
              value={form.open_date}
              onChange={(e) => set("open_date", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
          </div>
          <div className="col-span-2 flex flex-nowrap items-center gap-6 whitespace-nowrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.parking}
                onChange={(e) => set("parking", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
              />
              <span className="text-sm font-medium text-gray-700">주차 가능</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
              />
              <span className="text-sm font-medium text-gray-700">활성 (공개)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.page_active}
                onChange={(e) => set("page_active", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-[#303236]"
              />
              <span className="text-sm font-medium text-gray-700">스토어 페이지 노출</span>
            </label>
          </div>
          {/* 매장 사진 */}
          <div className="col-span-2 space-y-2">
            <label className="block text-sm font-semibold text-gray-700">매장 사진</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
            />
            <div className="flex flex-wrap gap-3">
              {form.image_urls.map((url, i) => (
                <div key={i} className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#303236] hover:text-[#303236] transition-colors"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-[#303236] rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs">이미지 추가</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* 삭제 (수정 화면에서만) — 좌측 하단, 모바일에서는 맨 아래 */}
      <div className="order-last xl:order-none -mt-5">
        {isEdit && (
          <div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="px-6 py-3 border-2 border-red-300 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors rounded"
            >
              매장 삭제
            </button>
          </div>
        )}
      </div>

      {/* 오른쪽 하단: 세부 설명 · 판매제품 */}
      <div className="space-y-8">

      {/* 추가 정보 세부 설명 (박스 바깥) */}
      <div className="-mt-5 px-1 space-y-1 text-xs text-gray-400">
        <p>· 오픈 예정일: 미리 등록하면 비공개로 저장되고, 오픈일 당일에 자동으로 공개(활성)됩니다.</p>
        <p>· 활성 (공개): 켜면 매장 찾기 목록과 지도에 이 매장이 보입니다. 끄면 고객에게 아예 안 보입니다.</p>
        <p>· 스토어 페이지 노출: 켜면 이 매장의 상세 페이지를 고객이 열어볼 수 있습니다. 활성(공개)도 같이 켜져 있어야 합니다.</p>
      </div>

      {/* 판매제품 (공개 매장에서만 노출) */}
      {form.is_active && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <button
            type="button"
            onClick={() => setProductsOpen((v) => !v)}
            aria-expanded={productsOpen}
            className="w-full flex items-center justify-between text-left text-base font-bold text-gray-900 border-b border-gray-100 pb-3"
          >
            <span>
              판매제품{" "}
              <span className="text-xs font-normal text-gray-400">
                (최대 3개, 매장 상세 공개 페이지에 노출 · {form.product_ids.filter(Boolean).length}개 지정)
              </span>
            </span>
            <span className="text-xs font-normal text-gray-400">{productsOpen ? "접기 ▲" : "펼치기 ▼"}</span>
          </button>
          <div className={`grid grid-cols-3 gap-4 ${productsOpen ? "" : "hidden"}`}>
            {[0, 1, 2].map((slot) => (
              <ProductSearchSlot
                key={slot}
                label={`판매제품 ${slot + 1}`}
                value={form.product_ids[slot] ?? ""}
                products={products}
                onChange={(id) => setProductSlot(slot, id)}
              />
            ))}
          </div>
        </section>
      )}
        </div>
      </div>


      {/* 삭제 확인(비밀번호) 팝업 */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeDelete} role="dialog" aria-modal="true" aria-label="매장 삭제 확인">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">&quot;{form.name}&quot; 삭제</h3>
            <p className="mt-2 text-sm text-gray-500">채용공고도 함께 삭제되며 되돌릴 수 없습니다. 내 비밀번호를 입력하면 삭제됩니다.</p>
            <input
              type="password"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(e); }}
              placeholder="비밀번호"
              autoFocus
              autoComplete="current-password"
              className="mt-4 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#303236]"
            />
            {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeDelete} className="px-5 py-2.5 border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-400 rounded">취소</button>
              <button type="button" onClick={handleDelete} disabled={saving} className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 rounded disabled:opacity-50">삭제</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
