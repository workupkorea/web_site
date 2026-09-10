import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";

type StoreStat = {
  store_id: number | null;
  store_name: string;
  view: number;
  list_click: number;
  directions_kakao: number;
  directions_naver: number;
  call: number;
  kakao_chat: number;
  conversions: number;
};

type RpcRow = {
  store_id: number | null;
  store_name: string | null;
  view_count: number;
  list_click_count: number;
  directions_kakao_count: number;
  directions_naver_count: number;
  call_count: number;
  kakao_chat_count: number;
};

async function fetchAggregated(
  supabase: ReturnType<typeof import("@/lib/supabase-server").createAdminClient>,
  sinceIso: string,
  untilIso: string | null,
) {
  const { data, error } = await supabase.rpc("aggregate_store_events", {
    since_iso: sinceIso,
    until_iso: untilIso ?? undefined,
  });
  if (error) throw new Error(error.message);
  return buildResult((data ?? []) as RpcRow[]);
}

function buildResult(rows: RpcRow[]) {
  const stores: StoreStat[] = rows.map((r) => {
    const view = Number(r.view_count ?? 0);
    const list_click = Number(r.list_click_count ?? 0);
    const directions_kakao = Number(r.directions_kakao_count ?? 0);
    const directions_naver = Number(r.directions_naver_count ?? 0);
    const call = Number(r.call_count ?? 0);
    const kakao_chat = Number(r.kakao_chat_count ?? 0);
    return {
      store_id: r.store_id,
      store_name: r.store_name || "(삭제된 지점)",
      view, list_click, directions_kakao, directions_naver, call, kakao_chat,
      conversions: directions_kakao + directions_naver + call + kakao_chat,
    };
  });
  stores.sort((a, b) => b.conversions - a.conversions || b.view - a.view);
  const totals = stores.reduce(
    (t, s) => ({
      view: t.view + s.view,
      list_click: t.list_click + s.list_click,
      directions: t.directions + s.directions_kakao + s.directions_naver,
      call: t.call + s.call,
      kakao_chat: t.kakao_chat + s.kakao_chat,
      conversions: t.conversions + s.conversions,
    }),
    { view: 0, list_click: 0, directions: 0, call: 0, kakao_chat: 0, conversions: 0 },
  );
  return { stores, totals };
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");
  const dateRe    = /^\d{4}-\d{2}-\d{2}$/;

  let sinceIso: string;
  let untilIso: string | null = null;
  let periodMs = 0; // 기간 길이 (ms) — 이전 기간 계산용

  if (fromParam && toParam && dateRe.test(fromParam) && dateRe.test(toParam)) {
    const fromTs = new Date(`${fromParam}T00:00:00+09:00`).getTime();
    const toTs   = new Date(`${toParam}T23:59:59.999+09:00`).getTime();
    sinceIso  = new Date(fromTs).toISOString();
    untilIso  = new Date(toTs).toISOString();
    periodMs  = toTs - fromTs;
  } else {
    const days = Number(searchParams.get("days") ?? "30");
    if (days > 0) {
      periodMs = days * 86400000;
      sinceIso = new Date(Date.now() - periodMs).toISOString();
    } else {
      sinceIso = new Date(0).toISOString();
    }
  }

  const supabase = createAdminClient();

  try {
    // 현재 기간 — RPC 단일 쿼리로 집계 (기존 최대 402회 순차 쿼리 대체)
    const current = await fetchAggregated(supabase, sinceIso, untilIso);

    // 이전 기간 (days=0 전체 조회면 비교 없음)
    let prev = null;
    if (periodMs > 0) {
      const prevUntil = new Date(new Date(sinceIso).getTime() - 1).toISOString();
      const prevSince = new Date(new Date(sinceIso).getTime() - periodMs).toISOString();
      prev = await fetchAggregated(supabase, prevSince, prevUntil);
    }

    return NextResponse.json({
      stores:     current.stores,
      totals:     current.totals,
      prevTotals: prev?.totals ?? null,
      prevStores: prev?.stores ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
