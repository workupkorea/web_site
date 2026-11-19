import { NextResponse } from "next/server";
import { getArrivalProducts } from "@/lib/arrival";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getArrivalProducts();
  // 내부활용용(매장입고 아님)은 점주 화면에 노출하지 않는다.
  return NextResponse.json(products.filter(p => !(p.note ?? "").includes("내부활용")));
}
