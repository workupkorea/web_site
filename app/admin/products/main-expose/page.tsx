"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product, MainExpose } from "@/data/products";

const EXPOSE_SECTIONS: { key: MainExpose; label: string; color: string }[] = [
  { key: "신상품",   label: "신상품",   color: "bg-[#E5541B] text-white" },
  { key: "추천상품", label: "추천상품", color: "bg-purple-100 text-purple-700" },
  { key: "베스트",   label: "베스트",   color: "bg-amber-100 text-amber-700" },
  { key: "기획전",   label: "기획전",   color: "bg-blue-100 text-blue-700" },
];

export default function MainExposePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("전체");
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    fetch("/api/admin/products")
      .then(r => r.json())
      .then(d => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = ["전체", ...new Set(products.map(p => p.category).filter(Boolean))];
    return cats;
  }, [products]);

  const filtered = useMemo(() => {
    if (catFilter === "전체") return products;
    return products.filter(p => p.category === catFilter);
  }, [products, catFilter]);

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };

  const toggle = async (product: Product, section: MainExpose) => {
    const key = `${product.id}-${section}`;
    setSaving(key);
    const curr = (product.mainExpose ?? []) as MainExpose[];
    const next: MainExpose[] = curr.includes(section)
      ? curr.filter(e => e !== section)
      : [...curr, section];

    const updated: Product = {
      ...product,
      mainExpose: next,
      isNew: next.includes("신상품"),
    };

    setProducts(prev => prev.map(p => p.id === product.id ? updated : p));

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error();   // HTTP 에러도 catch로 보내 롤백 (거짓 "설정됨" 방지)
      showMsg(`"${product.name}" ${section} ${curr.includes(section) ? "해제" : "설정"}됨`);
    } catch {
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      showMsg("저장 실패. 다시 시도해주세요.");
    }
    setSaving(null);
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/products"
              className="text-[15px] text-gray-400 hover:text-[#303236]">← 제품 목록</Link>
            <span className="text-gray-200">/</span>
            <h1 className="text-3xl font-bold text-gray-900">메인 진열 관리</h1>
          </div>
          <p className="text-base text-gray-400 mt-1">
            각 제품의 메인 노출 영역을 토글로 빠르게 설정합니다. 변경 즉시 저장됩니다.
          </p>
        </div>
      </div>

      {msg && (
        <div className="px-5 py-3 bg-green-50 border border-green-200 text-green-700 text-base rounded-lg">{msg}</div>
      )}

      {/* 노출 영역 범례 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[15px] font-semibold text-gray-500">노출 영역:</span>
        {EXPOSE_SECTIONS.map(s => (
          <span key={s.key} className={`px-3 py-1.5 text-[14px] font-bold rounded ${s.color}`}>{s.label}</span>
        ))}
        <span className="text-[14px] text-gray-400 ml-2">버튼 클릭 시 즉시 저장</span>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            className={`px-4 py-2 text-[15px] border rounded font-medium transition-colors ${
              catFilter === cat
                ? "bg-[#303236] text-white border-[#303236]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#303236]"
            }`}>{cat}</button>
        ))}
        <span className="text-[14px] text-gray-400 ml-2">{filtered.length}개</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-base text-gray-400">
          <span className="w-6 h-6 border-2 border-[#E5541B] border-t-transparent rounded-full animate-spin" />
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 text-left text-[13px] font-bold text-gray-500 uppercase tracking-wide w-64">상품명</th>
                  <th className="px-5 py-4 text-left text-[13px] font-bold text-gray-500 uppercase tracking-wide">카테고리</th>
                  <th className="px-5 py-4 text-left text-[13px] font-bold text-gray-500 uppercase tracking-wide">가격</th>
                  {EXPOSE_SECTIONS.map(s => (
                    <th key={s.key} className="px-5 py-4 text-center text-[13px] font-bold text-gray-500 uppercase tracking-wide min-w-[100px]">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-[15px] text-gray-400">
                      해당 카테고리의 제품이 없습니다.
                    </td>
                  </tr>
                ) : filtered.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    {/* 상품명 */}
                    <td data-align-start className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-[44px] h-[44px] flex-shrink-0 rounded-lg overflow-hidden border border-gray-100">
                          {product.imageUrl ? (
                            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="44px" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <span className="text-gray-300 text-[10px]">없음</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[15px] text-gray-900 leading-tight">{product.name}</p>
                          {product.brand && <p className="text-[13px] text-[#303236]">{product.brand}</p>}
                        </div>
                      </div>
                    </td>

                    {/* 카테고리 */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="text-[15px] text-gray-700 font-medium">{product.category}</p>
                      <p className="text-[13px] text-gray-400">{product.subCategory}</p>
                    </td>

                    {/* 가격 */}
                    <td className="px-5 py-4 whitespace-nowrap text-[15px] font-bold text-gray-700">
                      {product.price}
                    </td>

                    {/* 진열 토글 */}
                    {EXPOSE_SECTIONS.map(section => {
                      const isOn = (product.mainExpose ?? []).includes(section.key);
                      const isSaving = saving === `${product.id}-${section.key}`;
                      return (
                        <td key={section.key} className="px-5 py-4 text-center">
                          <button
                            onClick={() => toggle(product, section.key)}
                            disabled={!!saving}
                            className={`relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-wait ${
                              isOn ? "bg-[#E5541B]" : "bg-gray-200"
                            }`}
                          >
                            <span className={`absolute w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                              isOn ? "translate-x-8" : "translate-x-1"
                            }`} />
                            {isSaving && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              </span>
                            )}
                          </button>
                          <p className={`text-[12px] font-semibold mt-1 ${isOn ? "text-[#E5541B]" : "text-gray-300"}`}>
                            {isOn ? "ON" : "OFF"}
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 요약 */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-6 text-[14px] text-gray-500">
            {EXPOSE_SECTIONS.map(s => {
              const count = products.filter(p => (p.mainExpose ?? []).includes(s.key)).length;
              return (
                <span key={s.key}>
                  <span className="font-semibold text-gray-700">{s.label}</span>{" "}
                  <span className="font-bold text-[#303236]">{count}</span>개 노출 중
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
