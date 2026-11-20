"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { saveInlineMateActivity, saveMateActivity, searchMateInventory } from "@/app/admin/mate/activities/actions";
import MateActionForm from "./MateActionForm";
import { mateSizeLabels, validMateProductUrl, type MateActivity, type MateAdminActivityProduct, type MateInventoryProduct } from "@/lib/mate-activities";

const input = "min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal";
const button = "inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-bold disabled:opacity-50";
type ProductDraft = { id: string; name: string; sizes: string; colors: string; url: string; showUrl: boolean; cost: string; code: string };

function ProductField({ children }: { children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-bold">{children}</label>;
}
function fromProduct(product: MateAdminActivityProduct): ProductDraft {
  return { id: product.id, name: product.name, sizes: mateSizeLabels(product.size_options.join(", ")).join(", "), colors: product.color_options.join(", "),
    url: product.product_url ?? "", showUrl: Boolean(product.product_url), cost: product.unit_cost?.toString() ?? "", code: product.source_code ?? "" };
}

function InventoryPicker({ select, options }: { select: (item: MateInventoryProduct) => void; options: ReactNode }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MateInventoryProduct[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      try {
        const outcome = await searchMateInventory(query);
        setResults(outcome.items);
        setMessage(outcome.error ?? (outcome.items.length ? "" : "일치하는 제품이 없습니다."));
      } catch {
        setMessage("입출고 리스트 검색을 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <div className="grid min-w-0 grow basis-[34rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <label htmlFor={searchId} className="col-span-full whitespace-nowrap text-sm font-bold sm:col-span-1">입출고 리스트에서 검색</label>
          <input id={searchId} type="search" aria-label="입출고 제품 검색어" className={input} value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="제품명 또는 품번" maxLength={60}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} />
          <button type="button" onClick={search} disabled={pending} className={button + " whitespace-nowrap"}>{pending ? "검색 중…" : "제품 검색"}</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4">{options}</div>
      </div>
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      {results.length > 0 && <ul className="mt-2 divide-y divide-slate-200">
        {results.map((item) => <li key={item.id}>
          <button type="button" onClick={() => { select(item); setResults([]); setMessage(""); }} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 py-2 text-left text-sm hover:bg-slate-50">
            <span>{item.brand && item.brand + " "}<strong>{item.product_name}</strong> · {item.product_code}</span>
            <span>{item.cost_price ? item.cost_price.toLocaleString("ko-KR") + "원" : "원가 미등록"}</span>
          </button>
        </li>)}
      </ul>}
    </div>
  );
}

export default function MateActivityProductsField({ current, nextNumber, round, inline, children }: {
  current: MateActivity | null; nextNumber: number; round: number; inline: boolean; children: ReactNode;
}) {
  const [products, setProducts] = useState<ProductDraft[]>(() => [
    { ...fromProduct({ id: "main", name: current?.product_name ?? "", size_options: current?.size_options ?? [],
      color_options: current?.color_options ?? [], product_url: current?.product_url ?? null,
      source_code: current?.source_code ?? null, unit_cost: current?.unit_cost ?? null }), showUrl: false },
    ...(current?.additional_products ?? []).map(fromProduct),
  ]);

  const [showInfo, setShowInfo] = useState(false);
  const [infoTouched, setInfoTouched] = useState(false);
  const [linkTouched, setLinkTouched] = useState(false);

  function change(id: string, patch: Partial<ProductDraft>) {
    setProducts((previous) => previous.map((product) => product.id === id ? { ...product, ...patch } : product));
  }


  return (
    <MateActionForm action={inline ? saveInlineMateActivity : saveMateActivity} className="space-y-4"
      buttonClassName="inline-flex min-h-10 items-center rounded-md bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-50"
      submitLabel={current ? "회차 설정 저장" : "활동 회차 등록"}
      successContent={inline && !current ? <p>회차 목록에서 등록한 회차를 열 수 있습니다.</p> : undefined}
      submitTitle={<h2 className="text-lg font-black">{current ? `${current.activity_no}회차 설정` : "새 활동 회차"}</h2>}
      submitLeading={<>
        <label className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap text-sm font-bold">
          <input type="checkbox" name="published" value="yes" defaultChecked={current?.published} />선정 메이트 전체에게 공개
        </label>
        <button type="button" className={button} disabled={products.length >= 20} onClick={() => {
          setProducts([...products, { id: crypto.randomUUID(), name: "", sizes: "", colors: "", url: "", showUrl: false, cost: "", code: "" }]);
        }}>제품 추가</button>
      </>}>
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="mode" value={current ? "edit" : "create"} />
      {current && <input type="hidden" name="activity_no" value={current.activity_no} />}
      {!current && <label className="grid max-w-40 gap-1 text-sm font-bold">회차 번호
        <input type="number" name="activity_no" min={1} max={999} defaultValue={nextNumber} className={input} required />
      </label>}
      <input name="additional_products" type="hidden" value={JSON.stringify(products.slice(1).map(({ id, name, sizes, colors, url, showUrl, cost, code }) => ({
        id, name, sizes, colors, url: showUrl ? url : "", cost, code,
      })))} />
      {products.map((product, index) => {
        const main = index === 0;
        return (
          <div key={product.id} className="space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              <p className="text-sm font-bold">{main ? "기본 제품" : `추가 제품 ${index}`}{product.code && <span className="ml-2 font-normal text-slate-600">{product.code}</span>}</p>
              {!main && <button type="button" className="min-h-9 text-sm font-semibold text-red-700 underline"
                onClick={() => setProducts(products.filter((item) => item.id !== product.id))}>제품 제거</button>}
            </div>
            <InventoryPicker options={<>
                <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-bold">
                  <input type="checkbox" checked={product.showUrl} onChange={(event) => {
                    if (main) setLinkTouched(true);
                    change(product.id, { showUrl: event.target.checked });
                  }} />제품 링크 추가
                </label>
                {main && <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-bold">
                  <input type="checkbox" checked={showInfo} onChange={(event) => {
                    setInfoTouched(true);
                    setShowInfo(event.target.checked);
                  }} />제품 정보 및 활동 안내 등록
                </label>}
            </>} select={(item) => {
              const url = item.detail_url && validMateProductUrl(item.detail_url) ? item.detail_url : "";
              if (main) setLinkTouched(true);
              change(product.id, { name: item.product_name, code: item.product_code, sizes: item.size ? mateSizeLabels(item.size).join(", ") : product.sizes,
                colors: item.color || product.colors, cost: item.cost_price?.toString() || product.cost,
                url, showUrl: main ? product.showUrl : Boolean(url || product.showUrl) });
            }} />
            {main && <>
              <input type="hidden" name="source_code" value={product.code} />
              <input type="hidden" name="product_link_edit" value={linkTouched ? "yes" : "no"} />
              <input type="hidden" name="product_info_edit" value={infoTouched ? "yes" : "no"} />
            </>}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
              <ProductField>{main ? "제품명" : "추가 제품명"}
                <input className={input} name={main ? "product_name" : undefined} value={product.name} maxLength={120} required
                  onChange={(event) => change(product.id, { name: event.target.value })} />
              </ProductField>
              <ProductField>선택 가능한 사이즈
                <input className={input} name={main ? "size_options" : undefined} value={product.sizes} placeholder="예: S, M, L" maxLength={1200}
                  onChange={(event) => change(product.id, { sizes: event.target.value })} />
              </ProductField>
              <ProductField>선택 가능한 컬러
                <input className={input} name={main ? "color_options" : undefined} value={product.colors} placeholder="예: 블랙, 카키" maxLength={1200}
                  onChange={(event) => change(product.id, { colors: event.target.value })} />
              </ProductField>
              <ProductField>원가 (원)
                {main && <input type="hidden" name="unit_cost" value={product.cost} />}
                <input className={input} value={product.cost ? Number(product.cost).toLocaleString("ko-KR") : ""} type="text" inputMode="numeric"
                  onChange={(event) => change(product.id, { cost: event.target.value.replace(/\D/g, "").slice(0, 9) })} />
              </ProductField>
            </div>
            {main && <p className="text-xs text-slate-600">옵션은 쉼표로 나눠 주세요. 사이즈가 비어 있으면 직접 입력받습니다.</p>}
            {product.showUrl && <label className="grid gap-1 text-sm font-bold">제품 링크
              <input className={input} name={main ? "product_url" : undefined} type="url" maxLength={500} value={product.url}
                onChange={(event) => change(product.id, { url: event.target.value })} />
            </label>}
            {main && <label hidden={!showInfo} className={showInfo ? "grid gap-1 text-sm font-bold" : undefined}>
              제품 정보 및 활동 안내
              <textarea className={input} name="product_info" disabled={!showInfo} maxLength={2000} rows={3} defaultValue={current?.product_info} />
            </label>}
          </div>
        );
      })}
      {children}
    </MateActionForm>
  );
}
