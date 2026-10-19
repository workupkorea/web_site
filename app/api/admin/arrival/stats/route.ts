import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getAdminMember } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// 시즌별 판매 통계용 원본 행 조회. 집계는 화면에서 시즌·기준을 바꿔가며 즉시 계산한다.
// (연 수백~수천 행 수준이라 전체 조회가 가장 단순하다)
const PAGE = 1000;
const BASE_COLS = "season, arrival_date, brand, category, product_code, product_name, quantity, order_quantity, sales_quantity, stock_quantity, order_rate, sales_rate, supply_price, price, updated_at";

export async function GET() {
  if (!(await getAdminMember())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sb = createAdminClient();
    // image 컬럼(제품 이미지)은 마이그레이션 전에는 없을 수 있어, 없으면 이미지 없이 조회한다
    let cols = `${BASE_COLS}, image`;
    const rows: unknown[] = [];
    // Supabase 기본 응답 한도(1000행)를 넘겨도 끝까지 가져온다
    for (let from = 0; ; from += PAGE) {
      let { data, error } = await sb.from("arrival_sales_archive").select(cols).range(from, from + PAGE - 1);
      if (error && cols.endsWith(", image") && error.message.includes("image")) {
        cols = BASE_COLS;
        ({ data, error } = await sb.from("arrival_sales_archive").select(cols).range(from, from + PAGE - 1));
      }
      if (error) {
        const missing = error.message.includes("arrival_sales_archive") &&
          (error.message.includes("does not exist") || error.message.includes("schema cache"));
        return NextResponse.json(
          { error: missing ? "arrival_sales_archive 테이블이 없습니다. supabase/migrations/arrival_sales_archive.sql 을 실행해주세요." : error.message },
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
