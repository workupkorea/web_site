import { NextResponse } from "next/server";
import { autoCompleteArrivals } from "@/lib/arrival";

export const dynamic = "force-dynamic";

// Vercel Cron: 매일 23:50 UTC (= 08:50 KST) 실행
// 오늘 입고일인 상품을 자동으로 입고완료 처리
export async function GET(req: Request) {
  // Vercel Cron 요청 검증
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updated = await autoCompleteArrivals();
    return NextResponse.json({
      ok: true,
      updatedCount: updated.length,
      updatedCodes: updated,
      runAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
