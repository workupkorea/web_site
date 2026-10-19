// 시즌별 판매 통계 화면들(/admin/arrival/stats, /admin/arrival/stats/products)이 공유하는 타입·계산 유틸.
// 서버 전용 코드를 가져오지 않으므로 클라이언트 컴포넌트에서 그대로 쓸 수 있다.
import { useEffect, useState } from "react";

export interface ArchiveRow {
  season: string; arrival_date: string; brand: string; category: string;
  product_code: string; product_name: string;
  quantity: number; order_quantity: number | null; sales_quantity: number | null; stock_quantity: number | null;
  order_rate: number | null; sales_rate: number | null;
  supply_price: number; price: number;
  image?: string | null; // 쉼표로 이어진 이미지 URL들 (대표는 첫 번째). image 컬럼 생성 전에는 없다
  updated_at: string;
}

export interface Agg {
  key: string; label: string; products: number; inQty: number; orderQty: number; salesQty: number; stockQty: number;
  rateSum: number; rateCnt: number; // 상품별 판매율 합·개수 (평균 판매율 계산용)
  oRateSum: number; oRateCnt: number; // 상품별 주문율 합·개수 (평균 주문율 계산용)
}

export const n = (v: number | null | undefined) => v ?? 0;
export const fmt = (v: number) => v.toLocaleString("ko-KR");
export const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

// 상품 판매율(%): 시트의 판매율(수기 보정 포함)을 우선 쓰고, 없으면 판매÷입고로 계산 — 입고 스케쥴 "주문 순위"와 같은 기준
export const salesRateOf = (r: ArchiveRow) => r.sales_rate ?? rate(n(r.sales_quantity), n(r.quantity));
// 주문율도 같은 방식 (시트 값 우선)
export const orderRateOf = (r: ArchiveRow) => r.order_rate ?? rate(n(r.order_quantity), n(r.quantity));
// 평균 판매율은 주문이 있는 상품만 대상으로 한다. 아직 판매 전인 상품(입고예정 등)이 평균을 끌어내리는 것을 막기 위함
export const countsForAvg = (r: ArchiveRow) => n(r.order_quantity) > 0 && salesRateOf(r) != null;
// 상품별 주문율의 단순 평균 (판매율과 같은 기준)
export const avgOrderRate = (a: { oRateSum: number; oRateCnt: number } | null | undefined) =>
  a && a.oRateCnt > 0 ? Math.round(a.oRateSum / a.oRateCnt) : null;
// 상품별 판매율의 단순 평균 (입고량 합산 비율은 대량 입고 상품 하나에 크게 좌우되어 쓰지 않는다)
export const avgRate = (a: { rateSum: number; rateCnt: number } | null | undefined) =>
  a && a.rateCnt > 0 ? Math.round(a.rateSum / a.rateCnt) : null;

// 오늘(KST) 기준 입고일 D-day. 입고 후 지난 날은 D+N, 입고 예정은 D-N, 당일은 D-Day
export const todayKst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
export const dayDiff = (iso: string, today: string) =>
  Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000);
export function dDayLabel(iso: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = dayDiff(iso, today);
  return d === 0 ? "D-Day" : d > 0 ? `D+${d}` : `D${d}`;
}

// "26FW" → 전년 같은 시즌 "25FW"
export const prevYearSeason = (s: string) => {
  const m = /^(\d{2})(SS|FW)$/.exec(s);
  return m ? `${String(+m[1] - 1).padStart(2, "0")}${m[2]}` : "";
};
// 최신 시즌이 위로 오게 정렬 (연도 → FW가 SS보다 뒤)
export const seasonRank = (s: string) => {
  const m = /^(\d{2})(SS|FW)$/.exec(s);
  return m ? +m[1] * 2 + (m[2] === "FW" ? 1 : 0) : -1;
};

export const shiftYear = (iso: string, years: number) => (iso ? `${+iso.slice(0, 4) - years}${iso.slice(4)}` : "");
export const inRange = (d: string, s: string, e: string) => (!s || d >= s) && (!e || d <= e);

export function aggregate(rows: ArchiveRow[], keyOf: (r: ArchiveRow) => string): Agg[] {
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const key = keyOf(r) || "(미분류)";
    const a = map.get(key) ?? { key, label: key, products: 0, inQty: 0, orderQty: 0, salesQty: 0, stockQty: 0, rateSum: 0, rateCnt: 0, oRateSum: 0, oRateCnt: 0 };
    a.products += 1;
    if (countsForAvg(r)) { a.rateSum += salesRateOf(r)!; a.rateCnt += 1; }
    if (n(r.order_quantity) > 0 && orderRateOf(r) != null) { a.oRateSum += orderRateOf(r)!; a.oRateCnt += 1; }
    a.inQty += n(r.quantity);
    a.orderQty += n(r.order_quantity);
    a.salesQty += n(r.sales_quantity);
    a.stockQty += n(r.stock_quantity);
    map.set(key, a);
  }
  return [...map.values()];
}

// 주차별 주문·판매 한 행 (arrival_weekly_sales). 값은 그 주의 증분
export interface WeeklyRow {
  product_code: string; arrival_date: string;
  week_start: string; week_end: string;
  order_qty: number; sales_qty: number;
}

// 주 시작일 + 일수
export const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// 주차별 행 전체 로딩 (관리자 API)
export function useWeeklyRows() {
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/arrival/stats/weekly", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data?.error ?? "불러오지 못했습니다"); return; }
        setRows(data.rows ?? []);
      } catch {
        setError("네트워크 오류로 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { rows, loading, error };
}

// 아카이브 전체 행 로딩 (관리자 API)
export function useArchiveRows() {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/arrival/stats", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data?.error ?? "불러오지 못했습니다"); return; }
        setRows(data.rows ?? []);
      } catch {
        setError("네트워크 오류로 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { rows, loading, error };
}
