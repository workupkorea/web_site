"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// 이벤트 소요 비용 계산 — 당첨 제품별 단가를 입력하면 제품비 합계를 내고, 택배비는 건당 고정 금액으로 따로 계산한다.
/** 택배비(건당). 송장양식 기본 운임(GiveawayClaimPanel INVOICE_DEFAULTS.fee)과 같은 값 */
const SHIPPING_FEE = 2600;

interface Extra { name: string; qty: number; price: number }
interface Cost { prices: Record<string, number>; extras: Extra[] }

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const toNum = (s: string) => Math.max(0, Math.round(Number(s.replace(/[^\d]/g, "")) || 0));
const cell = "border border-gray-300 rounded-lg px-2 py-1 text-[13px] text-right focus:outline-none focus:border-[#303236]";

export default function GiveawayCostBox({ eventId, winners }: { eventId: string; winners: { prize?: string }[] }) {
  const [cost, setCost] = useState<Cost>({ prices: {}, extras: [] });
  const [loaded, setLoaded] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 당첨 제품별 수량 (제품명이 같으면 한 줄로 합산)
  const lines = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of winners) {
      const name = (w.prize || "").trim() || "제품 미지정";
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, qty]) => ({ name, qty }));
  }, [winners]);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/giveaway/costs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { costs?: Record<string, Cost> } | null) => {
        const c = j?.costs?.[eventId];
        if (alive && c) setCost({ prices: c.prices ?? {}, extras: c.extras ?? [] });
      })
      .catch(() => null)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [eventId]);

  // 입력이 멈춘 뒤 한 번만 서버에 저장 (타이핑마다 저장하지 않음)
  const update = (next: Cost) => {
    setCost(next);
    setSaveMsg("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/admin/giveaway/costs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eventId, cost: next }) });
        setSaveMsg(r.ok ? "저장됨" : "저장 실패");
      } catch {
        setSaveMsg("저장 실패");
      }
    }, 800);
  };

  const productTotal = lines.reduce((s, l) => s + (cost.prices[l.name] ?? 0) * l.qty, 0) + cost.extras.reduce((s, x) => s + x.qty * x.price, 0);
  const parcels = winners.length;
  const shippingTotal = parcels * SHIPPING_FEE;

  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
      {/* 접힌 상태: 한 줄 요약 */}
      <button type="button" className="w-full flex items-center gap-2 flex-wrap text-left min-h-[32px]" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="text-gray-400 text-[12px] w-3">{open ? "▼" : "▶"}</span>
        <span className="text-[13px] font-bold text-gray-800">소요 비용</span>
        <span className="text-[13px] font-bold text-[#E5541B]">{won(productTotal + shippingTotal)}</span>
        <span className="text-[12px] text-gray-500">제품 {won(productTotal)} · 택배 {won(shippingTotal)}</span>
        {saveMsg && <span className={`text-[12px] ${saveMsg === "저장됨" ? "text-emerald-600" : "text-red-600"}`}>{saveMsg}</span>}
      </button>

      {open && (!loaded ? (
        <p className="mt-2 text-[12px] text-gray-400">불러오는 중…</p>
      ) : (
        <div className="mt-1">
          <ul className="text-[13px]">
            {lines.map((l) => (
              <li key={l.name} className="py-1 flex items-center gap-2 border-t border-gray-100">
                <span className="flex-1 min-w-0 truncate">{l.name} <span className="text-gray-400">× {l.qty}</span></span>
                <input className={`${cell} w-24`} inputMode="numeric" aria-label={`${l.name} 단가`} value={cost.prices[l.name] ? cost.prices[l.name].toLocaleString("ko-KR") : ""} placeholder="단가" onChange={(e) => update({ ...cost, prices: { ...cost.prices, [l.name]: toNum(e.target.value) } })} />
                <span className="w-24 text-right font-semibold">{won((cost.prices[l.name] ?? 0) * l.qty)}</span>
                <span className="w-8" />
              </li>
            ))}
            {cost.extras.map((x, i) => (
              <li key={`x${i}`} className="py-1 flex items-center gap-2 border-t border-gray-100">
                <input className={`${cell} !text-left flex-1 min-w-0`} value={x.name} placeholder="추가 제품명" onChange={(e) => update({ ...cost, extras: cost.extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
                <input className={`${cell} w-12`} inputMode="numeric" aria-label="수량" value={x.qty || ""} placeholder="수량" onChange={(e) => update({ ...cost, extras: cost.extras.map((y, j) => (j === i ? { ...y, qty: toNum(e.target.value) } : y)) })} />
                <input className={`${cell} w-24`} inputMode="numeric" aria-label="단가" value={x.price ? x.price.toLocaleString("ko-KR") : ""} placeholder="단가" onChange={(e) => update({ ...cost, extras: cost.extras.map((y, j) => (j === i ? { ...y, price: toNum(e.target.value) } : y)) })} />
                <span className="w-24 text-right font-semibold">{won(x.qty * x.price)}</span>
                <button className="w-8 min-h-[32px] text-[12px] text-gray-400 hover:text-red-600" title="이 줄 삭제" onClick={() => update({ ...cost, extras: cost.extras.filter((_, j) => j !== i) })}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button className="min-h-[32px] text-[12px] font-semibold text-sky-700 hover:underline" onClick={() => update({ ...cost, extras: [...cost.extras, { name: "", qty: 1, price: 0 }] })}>
              + 추가 제품
            </button>
            <span className="text-[12px] text-gray-500">택배비 {won(SHIPPING_FEE)} × {parcels}건</span>
          </div>
        </div>
      ))}
    </div>
  );
}
