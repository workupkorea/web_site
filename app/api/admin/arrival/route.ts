import { NextResponse } from "next/server";
import {
  getArrivalProducts,
  saveArrivalOverride,
  bulkSaveArrivalOverride,
  addNewProduct,
  addMultipleProducts,
} from "@/lib/arrival";
import type { ArrivalOverride, ArrivalProduct } from "@/lib/arrival";

export const dynamic = "force-dynamic";

// 단일 상품 등록 / 일괄 CSV 임포트
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 일괄 임포트: { products: ArrivalProduct[] }
    if (Array.isArray(body.products)) {
      const result = await addMultipleProducts(
        (body.products as ArrivalProduct[]).map((p) => ({
          productCode: String(p.productCode ?? "").trim(),
          productName: String(p.productName ?? "").trim(),
          brand: String(p.brand ?? "").trim(),
          category: String(p.category ?? "").trim(),
          color: String(p.color ?? "").trim(),
          price: Number(p.price) || 0,
          arrivalDate: String(p.arrivalDate ?? "").trim(),
          status: (p.status as ArrivalProduct["status"]) || "입고예정",
          description: String(p.description ?? "").trim(),
          note: String(p.note ?? "").trim(),
          image: null,
          detailUrl: null,
          changeHistory: [],
        }))
      );
      return NextResponse.json(result);
    }

    // 단일 등록
    const p = body as ArrivalProduct;
    if (!p.productCode?.trim()) {
      return NextResponse.json({ error: "productCode required" }, { status: 400 });
    }
    await addNewProduct({
      productCode: p.productCode.trim(),
      productName: String(p.productName ?? "").trim(),
      brand: String(p.brand ?? "").trim(),
      category: String(p.category ?? "").trim(),
      color: String(p.color ?? "").trim(),
      price: Number(p.price) || 0,
      arrivalDate: String(p.arrivalDate ?? "").trim(),
      status: p.status || "입고예정",
      description: String(p.description ?? "").trim(),
      note: String(p.note ?? "").trim(),
      image: null,
      detailUrl: null,
      changeHistory: [],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 단일 상품 수정
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { productCode, reason, originalArrivalDate, clearHistory, ...data } = body as {
      productCode: string;
      reason?: string;
      originalArrivalDate?: string; // 복합키 생성용 원래 입고일
      clearHistory?: boolean;       // 변경이력만 삭제
    } & ArrivalOverride;
    if (!productCode) return NextResponse.json({ error: "productCode required" }, { status: 400 });
    await saveArrivalOverride(productCode, data, reason, originalArrivalDate, clearHistory);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 일괄 수정
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { productCodes, reason, ...data } = body as {
      productCodes: string[];
      reason?: string;
    } & ArrivalOverride;
    if (!productCodes?.length) return NextResponse.json({ error: "productCodes required" }, { status: 400 });
    await bulkSaveArrivalOverride(productCodes, data, reason);
    return NextResponse.json({ ok: true, count: productCodes.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const products = await getArrivalProducts();
  return NextResponse.json(products);
}
