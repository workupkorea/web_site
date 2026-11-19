import { NextResponse } from "next/server";
import {
  getArrivalProducts,
  saveArrivalOverride,
  bulkSaveArrivalOverride,
  addNewProduct,
  addMultipleProducts,
  updateManualProduct,
  renameManualProductCode,
} from "@/lib/arrival";
import type { ManualProductFields } from "@/lib/arrival";
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
      costPrice: Number(p.costPrice) || 0,
      supplyPrice: Number(p.supplyPrice) || 0,
      image: p.image ? String(p.image) : null, // W주문 불러오기 시 대표 이미지 주소
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
    const { productCode, reason, originalArrivalDate, clearHistory, manualFields, ...data } = body as {
      productCode: string;
      reason?: string;
      originalArrivalDate?: string; // 복합키 생성용 원래 입고일
      clearHistory?: boolean;       // 변경이력만 삭제
      manualFields?: ManualProductFields; // 내부활용(개별 등록) 제품의 기본 정보 수정
    } & ArrivalOverride;
    if (!productCode) return NextResponse.json({ error: "productCode required" }, { status: 400 });
    const { newProductCode, ...infoFields } = (manualFields ?? {}) as ManualProductFields & { newProductCode?: string };
    if (manualFields) await updateManualProduct(productCode, originalArrivalDate ?? "", infoFields);
    await saveArrivalOverride(productCode, data, reason, originalArrivalDate, clearHistory);
    // 코드 변경은 마지막에 — 위 저장들이 기존 코드를 키로 쓰므로, 끝난 뒤 행·override 키를 함께 옮긴다.
    if (manualFields && newProductCode?.trim() && newProductCode.trim() !== productCode) {
      await renameManualProductCode(productCode, originalArrivalDate ?? "", newProductCode.trim());
    }
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
