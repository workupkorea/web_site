"use client";
import { useState, useEffect } from "react";
import { DEFAULT_PEOPLE, normalizePeople, MATE_INTERVIEW_QUESTIONS, type Person, type PersonQnA } from "@/data/people";
import AdminImageField from "@/components/admin/AdminImageField";
import AdminVideoField from "@/components/admin/AdminVideoField";
import MateZoneAdmin from "@/components/admin/MateZoneAdmin";

type PageData = { items?: Person[] };
// 카탈로그 상품(검색·선택용) — /api/admin/products 응답에서 필요한 필드만
type CatalogProduct = { id: string; name: string; category: string; imageUrl?: string };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 인터뷰 질문 6문항을 기본으로 채운 목록 (답변은 빈칸)
function defaultQna(): PersonQnA[] {
  return MATE_INTERVIEW_QUESTIONS.map((q) => ({ q, a: "" }));
}

function emptyPerson(): Person {
  return {
    id: uid(), job: "", years: "", quote: "", image_url: "",
    workMoments: { photos: [], video: "" },
    qna: defaultQna(),
    products: [],
    instagram: { handle: "", description: "", link: "", reels: [], photos: [] },
  };
}

export default function AdminMainPeoplePage() {
  const [view, setView]         = useState<"people" | "reels">("people");
  const [items, setItems]       = useState<Person[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState("");
  const [editing, setEditing]   = useState<Person | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver]   = useState<number | null>(null);
  // WEAR THIS 제품 검색·선택
  const [allProducts, setAllProducts] = useState<CatalogProduct[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCat, setProductCat] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings/people_page")
      .then(r => r.json())
      .then((data: PageData | null) => {
        const normalized = normalizePeople(data?.items);
        setItems(normalized.length ? normalized : DEFAULT_PEOPLE);
      })
      .catch(() => setItems(DEFAULT_PEOPLE))
      .finally(() => setLoading(false));
  }, []);

  // 전체 상품 목록(검색·선택용)
  useEffect(() => {
    fetch("/api/admin/products")
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setAllProducts((data as CatalogProduct[]).map(p => ({ id: p.id, name: p.name, category: p.category, imageUrl: p.imageUrl })));
        }
      })
      .catch(() => {});
  }, []);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  const saveAll = async (list: Person[]) => {
    const rollback = items;   // 호출 시점의 이전 목록 — 낙관적 갱신 실패 시 복원
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-settings/people_page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: list }),
      });
      if (!r.ok) setItems(rollback);
      flash(r.ok ? "저장됐습니다." : "저장에 실패했습니다.");
    } catch {
      setItems(rollback);
      flash("저장에 실패했습니다.");
    } finally { setSaving(false); }
  };

  const openNew = () => { setEditing(emptyPerson()); setIsNew(true); };
  const openEdit = (p: Person) => {
    const clone: Person = JSON.parse(JSON.stringify(p));
    // 질문이 비어 있으면 표준 6문항을 자동으로 채워 답변만 입력하도록 한다.
    if (!clone.qna?.some((qa) => qa.q.trim())) clone.qna = defaultQna();
    setEditing(clone);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    const cleaned: Person = {
      ...editing,
      qna: editing.qna.filter(qa => qa.q.trim()),
      products: editing.products.filter(pr => pr.name.trim()),
      workMoments: { photos: editing.workMoments.photos.filter(Boolean), video: editing.workMoments.video },
      instagram: editing.instagram,
    };
    const updated = isNew ? [...items, cleaned] : items.map(p => p.id === cleaned.id ? cleaned : p);
    setItems(updated);
    setEditing(null);
    await saveAll(updated);
  };

  const handleDuplicate = async (p: Person) => {
    const copy: Person = { ...JSON.parse(JSON.stringify(p)), id: uid(), job: `${p.job} (복사본)` };
    const idx = items.findIndex(x => x.id === p.id);
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    setItems(next);
    await saveAll(next);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 인물을 삭제할까요?")) return;
    const updated = items.filter(p => p.id !== id);
    setItems(updated);
    if (editing?.id === id) setEditing(null);
    await saveAll(updated);
  };

  const handleDrop = async (target: number) => {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); setDragOver(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    setItems(next);
    setDragIndex(null); setDragOver(null);
    await saveAll(next);
  };

  const set = <K extends keyof Person>(k: K, v: Person[K]) =>
    setEditing(prev => prev ? { ...prev, [k]: v } : prev);

  // WORK MOMENTS 헬퍼
  const setWorkPhoto = (i: number, url: string) =>
    setEditing(prev => prev ? { ...prev, workMoments: { ...prev.workMoments, photos: prev.workMoments.photos.map((p, idx) => idx === i ? url : p) } } : prev);
  const addWorkPhoto = () =>
    setEditing(prev => prev ? { ...prev, workMoments: { ...prev.workMoments, photos: [...prev.workMoments.photos, ""] } } : prev);
  const removeWorkPhoto = (i: number) =>
    setEditing(prev => prev ? { ...prev, workMoments: { ...prev.workMoments, photos: prev.workMoments.photos.filter((_, idx) => idx !== i) } } : prev);
  const setWorkVideo = (url: string) =>
    setEditing(prev => prev ? { ...prev, workMoments: { ...prev.workMoments, video: url } } : prev);

  // qna 헬퍼
  const setQna = (i: number, patch: Partial<PersonQnA>) =>
    setEditing(prev => prev ? { ...prev, qna: prev.qna.map((qa, idx) => idx === i ? { ...qa, ...patch } : qa) } : prev);
  const addQna = () => setEditing(prev => prev ? { ...prev, qna: [...prev.qna, { q: "", a: "" }] } : prev);
  const removeQna = (i: number) =>
    setEditing(prev => prev ? { ...prev, qna: prev.qna.filter((_, idx) => idx !== i) } : prev);

  // products 헬퍼 — 카탈로그에서 검색·선택 (최대 3개)
  const removeProductAt = (i: number) =>
    setEditing(prev => prev ? { ...prev, products: prev.products.filter((_, idx) => idx !== i) } : prev);
  const isProductSelected = (id: string) =>
    !!editing?.products.some(pr => pr.href === `/products/${id}`);
  const toggleProduct = (p: CatalogProduct) =>
    setEditing(prev => {
      if (!prev) return prev;
      const href = `/products/${p.id}`;
      if (prev.products.some(pr => pr.href === href))
        return { ...prev, products: prev.products.filter(pr => pr.href !== href) };
      if (prev.products.length >= 3) return prev; // 최대 3개
      return { ...prev, products: [...prev.products, { name: p.name, href, image_url: p.imageUrl }] };
    });

  // 상품 검색 결과(카테고리 + 이름)
  const productCategories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
  const filteredProducts = allProducts
    .filter(p => !productCat || p.category === productCat)
    .filter(p => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.trim().toLowerCase()));

  // instagram 헬퍼
  const setIg = <K extends keyof NonNullable<Person["instagram"]>>(k: K, v: NonNullable<Person["instagram"]>[K]) =>
    setEditing(prev => prev ? { ...prev, instagram: { ...(prev.instagram ?? { handle: "", description: "", link: "", reels: [], photos: [] }), [k]: v } } : prev);

  if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div>
      {/* 탭 — 인물 인터뷰 / 릴스(MATE ZONE)를 한 화면에서 관리 */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {([["people", "인물 인터뷰"], ["reels", "릴스 (MATE ZONE)"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-5 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${
              view === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {view === "reels" ? (
        <MateZoneAdmin />
      ) : (
      <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">MATE 관리</h1>
          <p className="mt-1 text-sm text-gray-500">/people 페이지에 노출되는 인물 인터뷰를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-green-600">{toast}</span>}
          <button onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            인물 추가
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* 목록 */}
        <div className="w-[300px] flex-shrink-0 sticky top-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">인물 목록 ({items.length})</h2>
              <span className="text-xs text-slate-400">드래그로 순서 변경</span>
            </div>
            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">등록된 인물이 없습니다.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((p, i) => (
                  <li key={p.id} draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { setDragIndex(null); setDragOver(null); }}
                    className={`flex items-start gap-2.5 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors ${editing?.id === p.id ? "bg-blue-50" : "hover:bg-slate-50"} ${dragOver === i && dragIndex !== i ? "bg-orange-50 border-l-2 border-orange-400" : ""}`}>
                    <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-slate-200 mt-0.5">
                      {p.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{p.job || "(직종 없음)"}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.quote.split("\n")[0] || p.years}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <button onClick={() => openEdit(p)} className="text-[11px] font-medium text-slate-600 border border-slate-200 px-2 py-0.5 hover:bg-slate-100 rounded">수정</button>
                        <button onClick={() => handleDuplicate(p)} className="text-[11px] font-medium text-blue-500 border border-blue-200 px-2 py-0.5 hover:bg-blue-50 rounded">복제</button>
                        <button onClick={() => handleDelete(p.id)} className="text-[11px] font-medium text-red-400 border border-red-200 px-2 py-0.5 hover:bg-red-50 rounded">삭제</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 편집 폼 */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">{isNew ? "새 인물 추가" : "인물 수정"}</h2>
                <div className="flex items-center gap-3">
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-8">
                {/* 기본 정보 */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold tracking-wider text-slate-400">기본 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">직종</label>
                      <input type="text" value={editing.job} onChange={e => set("job", e.target.value)} placeholder="예: 내장목수"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">경력</label>
                      <input type="text" value={editing.years} onChange={e => set("years", e.target.value)} placeholder="예: 경력 1년"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">히어로 헤드라인 <span className="font-normal text-gray-400">(\n으로 줄 나눔)</span></label>
                    <textarea rows={2} value={editing.quote} onChange={e => set("quote", e.target.value)} placeholder="처음엔 누구나 서툽니다.\n한 달만 버텨보세요."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                  </div>
                  <AdminImageField
                    value={editing.image_url}
                    onChange={url => set("image_url", url)}
                    promptType="person"
                    promptSeed={`${editing.job}${editing.years ? `, ${editing.years}` : ""}`}
                    label="히어로 배경 사진"
                  />
                </div>

                {/* WORK MOMENTS — 실제 노출과 동일한 3:4 세로 카드로 미리보기 */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-slate-400">WORK MOMENTS — 현장 사진</h3>
                    <span className="text-[10px] text-slate-400">실제 노출 비율 3:4 (세로) · 잘리는 영역까지 그대로 표시</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {editing.workMoments.photos.map((url, i) => (
                      <div key={i} className="relative">
                        <AdminImageField variant="card" aspectClass="aspect-[3/4]" value={url}
                          onChange={v => setWorkPhoto(i, v)} promptType="product" promptSeed={editing.job} label="" showPrompt={false} />
                        <button type="button" onClick={() => removeWorkPhoto(i)} title="사진 삭제"
                          className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red-500">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={addWorkPhoto}
                      className="aspect-[3/4] rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500 flex flex-col items-center justify-center gap-1 text-xs transition-colors">
                      <span className="text-xl leading-none">＋</span>
                      사진 추가
                    </button>
                  </div>

                  {/* 현장 영상 — 파일 업로드 또는 URL 입력, 노출과 동일한 3:4 미리보기 */}
                  <div className="pt-2">
                    <AdminVideoField
                      value={editing.workMoments.video}
                      onChange={setWorkVideo}
                      label="현장 영상 (선택)"
                      aspectClass="aspect-[3/4]"
                      hint={`9:16 세로 · MP4 권장 · 10MB 이하. 업로드 후 '저장'을 눌러야 반영됩니다.`}
                    />
                  </div>
                </div>

                {/* INTERVIEW */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-slate-400">INTERVIEW — 질문·답변</h3>
                    <button type="button" onClick={addQna} className="text-xs text-blue-600 hover:text-blue-800">+ 질문 추가</button>
                  </div>
                  <div className="space-y-3">
                    {editing.qna.map((qa, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex gap-2">
                          <input type="text" value={qa.q} onChange={e => setQna(i, { q: e.target.value })} placeholder={`Q${i + 1}. 질문`}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                          <button type="button" onClick={() => removeQna(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                        </div>
                        <textarea rows={2} value={qa.a} onChange={e => setQna(i, { a: e.target.value })} placeholder="답변"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* WEAR THIS — 카탈로그에서 제품 검색·선택 */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-slate-400">WEAR THIS — 착용 제품 (최대 3개)</h3>
                    <button type="button" onClick={() => { setProductSearch(""); setProductCat(""); setProductModalOpen(true); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800">＋ 제품 검색·추가</button>
                  </div>
                  {editing.products.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                      선택된 제품이 없습니다. “제품 검색·추가”로 카탈로그에서 골라주세요.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {editing.products.map((pr, i) => (
                        <div key={i} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <div className="aspect-square bg-gray-100">
                            {pr.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={pr.image_url} alt={pr.name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-slate-700 px-2 py-1.5 truncate">{pr.name || "(이름 없음)"}</p>
                          <button type="button" onClick={() => removeProductAt(i)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red-500">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* INSTAGRAM */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <h3 className="text-xs font-bold tracking-wider text-slate-400">INSTAGRAM</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">계정 (@포함)</label>
                      <input type="text" value={editing.instagram?.handle ?? ""} onChange={e => setIg("handle", e.target.value)} placeholder="@ko_car_in"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">프로필 링크</label>
                      <input type="url" value={editing.instagram?.link ?? ""} onChange={e => setIg("link", e.target.value)} placeholder="https://www.instagram.com/..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">소개 문구 <span className="font-normal text-gray-400">(\n으로 줄 나눔)</span></label>
                    <textarea rows={2} value={editing.instagram?.description ?? ""} onChange={e => setIg("description", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                  </div>

                  {/* 게시물 임베드 — 넣으면 인스타그램 바 대신 임베드된 게시물이 표시됨 */}
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                    <label className="block text-xs font-semibold text-indigo-700 mb-1">
                      게시물 임베드 코드 <span className="font-normal text-indigo-400">(선택 · 비워두면 인스타그램 바 표시)</span>
                    </label>
                    <p className="text-[11px] text-indigo-600 mb-2 leading-relaxed">
                      인스타 <b>공개 게시물</b> → 우측 상단 <b>···</b> → <b>임베드</b> → 코드 복사 후 붙여넣기 (무료·가입 불필요).
                      여러 게시물을 넣으려면 코드를 이어서 붙이세요.
                    </p>
                    <textarea rows={3} value={editing.instagram?.embed ?? ""} onChange={e => setIg("embed", e.target.value)}
                      placeholder={'<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/XXXX/">...</blockquote>\n<script async src="//www.instagram.com/embed.js"></script>'}
                      className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-400 resize-none bg-white" />
                    <p className="text-[10px] text-indigo-400 mt-1">
                      입력하면 <b>인스타그램 바 대신</b> 이 게시물들이 표시됩니다. 유료 위젯(SnapWidget·Behold 등)의 iframe/script 코드도 동일하게 작동합니다.
                    </p>
                  </div>

                  <AdminImageField
                    value={editing.instagram?.image}
                    onChange={v => setIg("image", v)}
                    promptType="person"
                    promptSeed={editing.job}
                    label="대표 이미지 (인스타그램 바에 표시)"
                    showPrompt={false}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => setEditing(null)} className="px-6 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">취소</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm gap-3">
              <p>목록에서 인물을 선택하거나 새 인물을 추가하세요.</p>
            </div>
          )}
        </div>
      </div>
      </div>
      )}

      {/* 제품 검색·선택 모달 */}
      {productModalOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setProductModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">제품 선택 <span className="text-slate-400 font-normal">({editing.products.length}/3)</span></h3>
              <button onClick={() => setProductModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
            </div>
            <div className="p-4 border-b border-slate-100 space-y-3">
              {/* 선택된 제품 — 여기서 바로 해제 가능(구버전 데이터도 정리됨) */}
              {editing.products.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editing.products.map((pr, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full pl-2.5 pr-1 py-1 text-xs text-blue-800">
                      {pr.name || "(이름 없음)"}
                      <button type="button" onClick={() => removeProductAt(i)}
                        className="w-4 h-4 rounded-full bg-blue-300 hover:bg-red-500 text-white text-[10px] leading-none flex items-center justify-center">✕</button>
                    </span>
                  ))}
                </div>
              )}
              {editing.products.length >= 3 && (
                <p className="text-[11px] text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">
                  최대 3개까지 선택할 수 있습니다. 다른 제품을 고르려면 위에서 하나를 ✕로 해제하세요.
                </p>
              )}
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="상품명 검색..." autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              {productCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setProductCat("")}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${!productCat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>전체</button>
                  {productCategories.map(c => (
                    <button key={c} onClick={() => setProductCat(c)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${productCat === c ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{c}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {allProducts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">상품을 불러오는 중이거나 등록된 상품이 없습니다.</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">검색 결과가 없습니다.</p>
              ) : filteredProducts.map(p => {
                const selected = isProductSelected(p.id);
                const full = editing.products.length >= 3;
                return (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p)} disabled={!selected && full}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected ? "bg-blue-50" : "hover:bg-slate-50"} ${!selected && full ? "opacity-40 cursor-not-allowed" : ""}`}>
                    <span className={`w-5 h-5 rounded border flex items-center justify-center text-[11px] flex-shrink-0 ${selected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"}`}>{selected ? "✓" : ""}</span>
                    <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.category}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-right">
              <button onClick={() => setProductModalOpen(false)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
