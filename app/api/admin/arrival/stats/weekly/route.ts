import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getAdminMember } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// 주차별 주문·판매(arrival_weekly_sales) 전체 조회. 제품·시기 분석은 화면에서 필터를 바꿔가며 계산한다.
const PAGE = 1000;

export async function GET() {
  if (!(await getAdminMember())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sb = createAdminClient();
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("arrival_weekly_sales")
        .select("product_code, arrival_date, week_start, week_end, order_qty, sales_qty")
        .order("week_start")
        .range(from, from + PAGE - 1);
      if (error) {
        const missing = error.message.includes("arrival_weekly_sales") &&
          (error.message.includes("does not exist") || error.message.includes("schema cache"));
        return NextResponse.json(
          { error: missing ? "arrival_weekly_sales 테이블이 없습니다. supabase/migrations/arrival_weekly_sales.sql 을 실행해주세요." : error.message },
          { status: 500 },
        );
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
