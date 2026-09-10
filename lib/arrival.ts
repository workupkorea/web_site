import { createAdminClient } from "./supabase-server";

export type ArrivalStatus = "입고완료" | "입고예정" | "입고지연" | "일정미정" | "대기" | "일정미표기";

export interface ChangeHistoryEntry {
  changedAt: string;
  previousDate: string;
  newDate: string;
  reason: string;
}

export interface ArrivalProduct {
  productCode: string;
  productName: string;
  brand: string;
  category: string;
  productType?: string;
  newArrivalType?: string;
  color: string;
  /** 사이즈런 (예: "00S~4XL"). 시트 "사이즈런" 열에서 가져옴 */
  size?: string;
  /** 총주문 수량 (시트 "총주문 수량" 열). 주문율 = orderQuantity / quantity */
  orderQuantity?: number;
  /** 총판매 수량 (시트 "총판매 수량" 열) */
  salesQuantity?: number;
  /** 총재고 수량 (시트 "총재고 수량" 열) */
  stockQuantity?: number;
  /** 이 행이 구글 시트에서 마지막으로 동기화된 시각 (ISO) */
  syncedAt?: string;
  supplyPrice?: number;
  price: number;
  quantity?: number;
  arrivalDate: string;
  status: ArrivalStatus;
  description: string;
  note: string;
  image: string | null;
  detailUrl: string | null;
  changeHistory?: ChangeHistoryEntry[];
  marketingUsage?: string;
  /** 구글 시트에서 이 상품의 행이 마지막으로 수정된 시각 (ISO). 시트에 "행최종수정일시" 열이 있을 때만 채워짐 */
  sheetEditedAt?: string;
}

export interface ArrivalOverride {
  arrivalDate?: string;
  status?: ArrivalStatus;
  image?: string | null;
  detailUrl?: string | null;
  changeHistory?: ChangeHistoryEntry[];
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(row: any): ArrivalProduct {
  return {
    productCode:    row.product_code,
    productName:    row.product_name,
    brand:          row.brand,
    category:       row.category,
    productType:    row.product_type ?? undefined,
    newArrivalType: row.new_arrival_type ?? undefined,
    color:          row.color,
    size:           row.size ?? undefined,
    orderQuantity:  row.order_quantity ?? undefined,
    salesQuantity:  row.sales_quantity ?? undefined,
    stockQuantity:  row.stock_quantity ?? undefined,
    syncedAt:       row.synced_at ?? undefined,
    supplyPrice:    row.supply_price ?? undefined,
    price:          row.price,
    quantity:       row.quantity ?? undefined,
    arrivalDate:    row.arrival_date,
    status:         row.status as ArrivalStatus,
    description:    row.description,
    note:           row.note,
    marketingUsage: row.marketing_usage ?? undefined,
    image:          row.image ?? null,
    detailUrl:      row.detail_url ?? null,
    changeHistory:  (row.change_history as ChangeHistoryEntry[]) ?? [],
    sheetEditedAt:  row.sheet_edited_at ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOverride(row: any): ArrivalOverride {
  return {
    arrivalDate:   row.arrival_date ?? undefined,
    status:        row.status ?? undefined,
    image:         row.image ?? undefined,
    detailUrl:     row.detail_url ?? undefined,
    changeHistory: (row.change_history as ChangeHistoryEntry[]) ?? [],
  };
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

export async function getArrivalProducts(): Promise<ArrivalProduct[]> {
  const supabase = createAdminClient();

  const [{ data: products }, { data: overrideRows }] = await Promise.all([
    supabase.from("arrival_products").select("*").order("arrival_date").order("brand").order("product_name"),
    supabase.from("arrival_overrides").select("*"),
  ]);

  if (!products) return [];

  const overrideMap = new Map<string, ArrivalOverride>();
  for (const row of overrideRows ?? []) {
    overrideMap.set(row.override_key, rowToOverride(row));
  }

  return products.map(row => {
    const p = rowToProduct(row);
    const compoundKey = p.arrivalDate ? `${p.productCode}::${p.arrivalDate}` : null;
    const ov = (compoundKey && overrideMap.get(compoundKey)) || overrideMap.get(p.productCode);
    if (!ov) return p;
    // undefined 값은 스프레드하지 않음 (원본 arrivalDate 등을 덮어쓰지 않기 위해)
    const result = { ...p };
    if (ov.arrivalDate !== undefined) result.arrivalDate = ov.arrivalDate;
    if (ov.status !== undefined) result.status = ov.status;
    if (ov.image !== undefined) result.image = ov.image;
    if (ov.detailUrl !== undefined) result.detailUrl = ov.detailUrl;
    if (ov.changeHistory !== undefined) result.changeHistory = ov.changeHistory;
    return result;
  });
}

export async function saveArrivalOverride(
  productCode: string,
  data: ArrivalOverride,
  reason?: string,
  originalDate?: string,
  clearHistory?: boolean
): Promise<void> {
  const supabase = createAdminClient();
  const key = originalDate ? `${productCode}::${originalDate}` : productCode;

  const { data: existing } = await supabase
    .from("arrival_overrides")
    .select("*")
    .eq("override_key", key)
    .single();

  const prev: ArrivalOverride = existing ? rowToOverride(existing) : {};

  let changeHistory: ChangeHistoryEntry[] = clearHistory ? [] : (prev.changeHistory ?? []);

  if (
    !clearHistory &&
    reason !== undefined &&
    data.arrivalDate !== undefined &&
    data.arrivalDate !== prev.arrivalDate
  ) {
    const { data: baseRow } = await supabase
      .from("arrival_products")
      .select("arrival_date")
      .eq("product_code", productCode)
      .maybeSingle();

    const previousDate = prev.arrivalDate ?? baseRow?.arrival_date ?? "";
    changeHistory = [
      ...changeHistory,
      {
        changedAt: new Date().toISOString(),
        previousDate,
        newDate: data.arrivalDate,
        reason: reason || "사유 없음",
      },
    ];
  }

  const merged: ArrivalOverride = { ...prev, ...data, changeHistory };

  await supabase.from("arrival_overrides").upsert({
    override_key:   key,
    arrival_date:   merged.arrivalDate ?? null,
    status:         merged.status ?? null,
    image:          merged.image ?? null,
    detail_url:     merged.detailUrl ?? null,
    change_history: changeHistory,
    updated_at:     new Date().toISOString(),
  });
}

export async function bulkSaveArrivalOverride(
  productCodes: string[],
  data: ArrivalOverride,
  reason?: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: existingRows } = await supabase
    .from("arrival_overrides")
    .select("*")
    .in("override_key", productCodes);

  const existingMap = new Map<string, ArrivalOverride>();
  for (const row of existingRows ?? []) {
    existingMap.set(row.override_key, rowToOverride(row));
  }

  const { data: baseRows } = await supabase
    .from("arrival_products")
    .select("product_code, arrival_date")
    .in("product_code", productCodes);

  const baseDateMap = new Map<string, string>();
  for (const row of baseRows ?? []) {
    baseDateMap.set(row.product_code, row.arrival_date);
  }

  const upserts = productCodes.map(code => {
    const prev = existingMap.get(code) ?? {};
    let changeHistory: ChangeHistoryEntry[] = prev.changeHistory ?? [];

    if (
      reason !== undefined &&
      data.arrivalDate !== undefined &&
      data.arrivalDate !== prev.arrivalDate
    ) {
      const previousDate = prev.arrivalDate ?? baseDateMap.get(code) ?? "";
      changeHistory = [
        ...changeHistory,
        {
          changedAt: new Date().toISOString(),
          previousDate,
          newDate: data.arrivalDate,
          reason: reason || "사유 없음",
        },
      ];
    }

    const merged = { ...prev, ...data, changeHistory };
    return {
      override_key:   code,
      arrival_date:   merged.arrivalDate ?? null,
      status:         merged.status ?? null,
      image:          merged.image ?? null,
      detail_url:     merged.detailUrl ?? null,
      change_history: changeHistory,
      updated_at:     new Date().toISOString(),
    };
  });

  await supabase.from("arrival_overrides").upsert(upserts);
}

export async function addNewProduct(product: ArrivalProduct): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("arrival_products").insert({
    product_code:     product.productCode,
    product_name:     product.productName,
    brand:            product.brand,
    category:         product.category,
    product_type:     product.productType ?? null,
    new_arrival_type: product.newArrivalType ?? null,
    color:            product.color,
    supply_price:     product.supplyPrice ?? 0,
    price:            product.price,
    quantity:         product.quantity ?? 0,
    arrival_date:     product.arrivalDate,
    status:           product.status,
    description:      product.description,
    note:             product.note,
    marketing_usage:  product.marketingUsage ?? null,
    image:            product.image ?? null,
    detail_url:       product.detailUrl ?? null,
    change_history:   product.changeHistory ?? [],
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(`상품코드 ${product.productCode}는 이미 존재합니다.`);
    }
    throw new Error(error.message);
  }
}

export async function addMultipleProducts(
  newProducts: ArrivalProduct[]
): Promise<{ added: number; skipped: string[] }> {
  const supabase = createAdminClient();

  const codes = newProducts.map(p => p.productCode);
  const { data: existing } = await supabase
    .from("arrival_products")
    .select("product_code")
    .in("product_code", codes);

  const existingCodes = new Set((existing ?? []).map(r => r.product_code));
  const skipped: string[] = [];
  const toAdd = newProducts.filter(p => {
    if (existingCodes.has(p.productCode)) { skipped.push(p.productCode); return false; }
    return true;
  });

  if (toAdd.length > 0) {
    const rows = toAdd.map(p => ({
      product_code:     p.productCode,
      product_name:     p.productName,
      brand:            p.brand,
      category:         p.category,
      product_type:     p.productType ?? null,
      new_arrival_type: p.newArrivalType ?? null,
      color:            p.color,
      supply_price:     p.supplyPrice ?? 0,
      price:            p.price,
      quantity:         p.quantity ?? 0,
      arrival_date:     p.arrivalDate,
      status:           p.status,
      description:      p.description,
      note:             p.note,
      marketing_usage:  p.marketingUsage ?? null,
      image:            p.image ?? null,
      detail_url:       p.detailUrl ?? null,
      change_history:   p.changeHistory ?? [],
    }));
    await supabase.from("arrival_products").insert(rows);
  }

  return { added: toAdd.length, skipped };
}

export async function autoCompleteArrivals(): Promise<string[]> {
  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  // 오늘 이하 날짜이면서 입고예정 상태인 상품 조회 (overrides 포함)
  const [{ data: products }, { data: overrideRows }] = await Promise.all([
    supabase.from("arrival_products").select("product_code, arrival_date, status"),
    supabase.from("arrival_overrides").select("override_key, arrival_date, status"),
  ]);

  const overrideMap = new Map<string, { arrivalDate?: string; status?: string }>();
  for (const row of overrideRows ?? []) {
    overrideMap.set(row.override_key, { arrivalDate: row.arrival_date, status: row.status });
  }

  const updated: string[] = [];
  const upserts: object[] = [];

  for (const p of products ?? []) {
    const compoundKey = p.arrival_date ? `${p.product_code}::${p.arrival_date}` : null;
    const ov = (compoundKey && overrideMap.get(compoundKey)) || overrideMap.get(p.product_code);
    const effectiveDate   = ov?.arrivalDate   ?? p.arrival_date;
    const effectiveStatus = ov?.status        ?? p.status;

    if (effectiveDate && effectiveDate <= todayStr && effectiveStatus === "입고예정") {
      const key = compoundKey ?? p.product_code;
      const existing = overrideMap.get(key) ?? {};
      upserts.push({
        override_key: key,
        ...existing,
        status: "입고완료",
        updated_at: new Date().toISOString(),
      });
      updated.push(p.product_code);
    }
  }

  if (upserts.length > 0) {
    await supabase.from("arrival_overrides").upsert(upserts);
  }

  return updated;
}

// 구글 시트 동기화 시 전체 상품 교체 (기존 데이터 삭제 후 재삽입)
export async function replaceAllProducts(products: ArrivalProduct[]): Promise<void> {
  const supabase = createAdminClient();

  // 기존 전체 삭제
  const { error: delError } = await supabase.from("arrival_products").delete().neq("id", 0);
  if (delError) throw new Error(`[arrival_products DELETE] ${delError.message}`);

  if (products.length === 0) return;

  const rows = products.map(p => ({
    product_code:     p.productCode,
    product_name:     p.productName,
    brand:            p.brand,
    category:         p.category,
    product_type:     p.productType ?? null,
    new_arrival_type: p.newArrivalType ?? null,
    color:            p.color,
    size:             p.size ?? null,
    order_quantity:   p.orderQuantity ?? null,
    sales_quantity:   p.salesQuantity ?? null,
    stock_quantity:   p.stockQuantity ?? null,
    supply_price:     p.supplyPrice ?? 0,
    price:            p.price,
    quantity:         p.quantity ?? 0,
    arrival_date:     p.arrivalDate,
    status:           p.status,
    description:      p.description,
    note:             p.note,
    marketing_usage:  p.marketingUsage ?? null,
    image:            p.image ?? null,
    detail_url:       p.detailUrl ?? null,
    change_history:   p.changeHistory ?? [],
    sheet_edited_at:  p.sheetEditedAt ?? null,
    synced_at:        new Date().toISOString(),
  }));

  // 500개씩 나눠서 insert (Supabase 요청 크기 제한 대비)
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error: insError } = await supabase.from("arrival_products").insert(rows.slice(i, i + CHUNK));
    if (insError) throw new Error(`[arrival_products INSERT chunk ${i}] ${insError.message}`);
  }
}

// 오버라이드 중 삭제된 상품 코드 정리
export async function cleanupOrphanOverrides(validCodes: Set<string>): Promise<void> {
  const supabase = createAdminClient();
  const { data: overrideRows } = await supabase.from("arrival_overrides").select("override_key");

  const toDelete = (overrideRows ?? [])
    .filter(row => {
      const baseCode = row.override_key.includes("::") ? row.override_key.split("::")[0] : row.override_key;
      return !validCodes.has(baseCode);
    })
    .map(row => row.override_key);

  if (toDelete.length > 0) {
    await supabase.from("arrival_overrides").delete().in("override_key", toDelete);
  }
}
