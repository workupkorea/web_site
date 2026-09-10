import { NextResponse } from "next/server";
import { getArrivalProducts } from "@/lib/arrival";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getArrivalProducts();
  return NextResponse.json(products);
}
