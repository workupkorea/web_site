import { createAdminClient } from "./supabase-server";
import { seasonOf } from "./arrival-season";

export type ArrivalStatus = "입고완료" | "입고예정" | "입고지연" | "일정미정" | "대기" | "일정미표기";

export interface ChangeHistoryEntry {
  changedAt: string;
  previousDate: string;
  newDate: string;
  reason: string;
}

/** 시트 주차별 주문·판매 열 한 주분 (주간 증분 값). 날짜는 YYYY-MM-DD */
export interface WeeklySales {
  weekStart: string;
  weekEnd: string;
  order: number;
  sales: number;
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
  /** 시트 "주문율" 열 값(%) — 수기 보정이 반영된 값이라 계산값 대신 그대로 사용. 없으면 orderQuantity/quantity로 계산 */
  orderRate?: number;
  /** 시트 "판매율" 열 값(%) — 시트 기준 분모가 달라 계산값과 다를 수 있어 그대로 사용 */
  salesRate?: number;
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
  /** 시트의 주차별 주문·판매. 판매 통계 아카이브용이라 arrival_products에는 저장하지 않는다 */
  weekly?: WeeklySales[];
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
    orderRate:      row.order_rate ?? undefined,
    salesRate:      row.sales_rate ?? undefined,
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

  // 기본 override(productCode)와 날짜별 override(productCode::arrivalDate)는
  // 서로 다른 시점에 독립적으로 저장될 수 있으므로(예: 이미지 등록 후 날짜만 수정)
  // 택일하지 않고 필드 단위로 겹쳐 적용한다 — 기본 → 날짜별 순.
  // 이미지는 상품코드(기본) 키가 기준이다. 날짜별 키에 남은 예전 이미지가 최신 이미지를 가리지 않도록
  // 날짜별 override의 image는 적용하지 않고, 기본 키에 이미지가 없을 때만 폴백으로 쓴다.
  function applyOverride(result: ArrivalProduct, ov: ArrivalOverride | undefined, withImage: boolean) {
    if (!ov) return;
    if (ov.arrivalDate !== undefined) result.arrivalDate = ov.arrivalDate;
    if (ov.status !== undefined) result.status = ov.status;
    if (withImage && ov.image !== undefined) result.image = ov.image;
    if (ov.detailUrl !== undefined) result.detailUrl = ov.detailUrl;
    if (ov.changeHistory !== undefined) result.changeHistory = ov.changeHistory;
  }

  return products.map(row => {
    const p = rowToProduct(row);
    const compoundKey = p.arrivalDate ? `${p.productCode}::${p.arrivalDate}` : null;
    const baseOv = overrideMap.get(p.productCode);
    const dateOv = compoundKey ? overrideMap.get(compoundKey) : undefined;
    if (!baseOv && !dateOv) return p;
    const result = { ...p };
    applyOverride(result, baseOv, true);
    applyOverride(result, dateOv, false);
    if (!baseOv?.image && dateOv?.image) result.image = dateOv.image;
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

  // 이미지는 항상 상품코드(기본) 키에만 저장한다. 날짜별 키에 두면 다른 경로(빠른 업로드 등)로 바꾼
  // 최신 이미지와 충돌하고, 입고일이 바뀌면 조회되지 않는 키에 저장되어 예전 이미지가 되살아난다.
  if (originalDate) {
    const newImage = data.image !== undefined ? data.image : prev.image; // 날짜 키에 남은 기존 이미지는 기본 키로 이전
    if (newImage !== undefined) {
      const { data: baseExisting } = await supabase
        .from("arrival_overrides")
        .select("*")
        .eq("override_key", productCode)
        .maybeSingle();
      const base: ArrivalOverride = baseExisting ? rowToOverride(baseExisting) : {};
      await supabase.from("arrival_overrides").upsert({
        override_key:   productCode,
        arrival_date:   base.arrivalDate ?? null,
        status:         base.status ?? null,
        image:          newImage ?? null,
        detail_url:     base.detailUrl ?? null,
        change_history: base.changeHistory ?? [],
        updated_at:     new Date().toISOString(),
      });
    }
    merged.image = undefined;
  }

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

  // 점주님들이 보는 실시간 화면이므로 절대 비어 보이면 안 된다.
  // 예전 방식(전체 삭제 → insert)은 insert 도중 오류가 나면 테이블이 빈 채로 남는 위험이 있었다.
  // "새 데이터를 먼저 넣고, 성공했을 때만 기존 데이터를 지우는" 순서 자체는 유지하되,
  // (product_code, arrival_date) unique 제약 때문에 기존에 남아있는(=이번에도 유지되는) 상품과
  // 새로 넣는 행이 같은 키를 가지면 plain insert는 항상 충돌한다. upsert로 같은 키는 갱신,
  // 새 키는 삽입되게 하고, 이번 동기화에서 사라진 키만 골라 마지막에 삭제한다.
  if (products.length === 0) {
    throw new Error("동기화할 상품이 0건입니다. 기존 데이터를 보존하기 위해 교체를 중단합니다.");
  }

  const { data: oldRows, error: oldErr } = await supabase.from("arrival_products").select("id, product_code, arrival_date");
  if (oldErr) throw new Error(`[arrival_products SELECT old ids] ${oldErr.message}`);
  const newKeys = new Set(products.map(p => `${p.productCode}::${p.arrivalDate}`));
  const staleIds = (oldRows ?? [])
    .filter(r => !newKeys.has(`${r.product_code}::${r.arrival_date}`))
    .map(r => r.id);

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
    order_rate:       p.orderRate ?? null,
    sales_rate:       p.salesRate ?? null,
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

  // 500개씩 나눠서 upsert (Supabase 요청 크기 제한 대비) — 같은 (product_code, arrival_date)는 갱신,
  // 없던 키는 삽입되므로 남아있는 기존 행과 충돌하지 않는다.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error: upsertError } = await supabase
      .from("arrival_products")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "product_code,arrival_date" });
    if (upsertError) throw new Error(`[arrival_products UPSERT chunk ${i}] ${upsertError.message}`);
  }

  // upsert가 전부 성공한 뒤, 이번 동기화에서 사라진(=더 이상 시트에 없는) 기존 행만 삭제한다
  if (staleIds.length > 0) {
    const { error: delError } = await supabase.from("arrival_products").delete().in("id", staleIds);
    if (delError) throw new Error(`[arrival_products DELETE stale] ${delError.message}`);
  }
}

// 시즌별 판매 비교용 영구 아카이브. arrival_products와 달리 시트에서 빠진 상품도 지우지 않는다.
// 부가 기능이므로 실패해도 동기화 본 흐름을 막지 않도록 예외를 삼키고 결과만 반환한다.
export async function archiveSalesSnapshot(products: ArrivalProduct[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const rows = products
      .filter(p => p.arrivalDate)
      .map(p => ({
        product_code:   p.productCode,
        arrival_date:   p.arrivalDate,
        season:         seasonOf(p.arrivalDate),
        product_name:   p.productName,
        brand:          p.brand,
        category:       p.category,
        quantity:       p.quantity ?? 0,
        order_quantity: p.orderQuantity ?? null,
        sales_quantity: p.salesQuantity ?? null,
        stock_quantity: p.stockQuantity ?? null,
        order_rate:     p.orderRate ?? null,
        sales_rate:     p.salesRate ?? null,
        supply_price:   p.supplyPrice ?? 0,
        price:          p.price,
        updated_at:     now,
      }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from("arrival_sales_archive")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "product_code,arrival_date" });
      if (error) return { ok: false, error: error.message };
    }

    // 제품 이미지: 시트에는 없고 오버라이드(관리자 등록)에 있다. 시트에서 빠진 제품의 오버라이드는
    // 이후 정리되므로 지금 아카이브에 복사해 둔다. image 컬럼 미생성이어도 본 저장은 이미 끝났으니 실패는 무시한다.
    // 이미지가 있는 제품만, 이미지 컬럼만 upsert해서 이미 저장된 이미지를 빈 값으로 덮지 않는다.
    try {
      const merged = await getArrivalProducts();
      const imgRows = merged
        .filter(p => p.arrivalDate && p.image)
        .map(p => ({ product_code: p.productCode, arrival_date: p.arrivalDate, image: p.image }));
      for (let i = 0; i < imgRows.length; i += CHUNK) {
        await supabase
          .from("arrival_sales_archive")
          .upsert(imgRows.slice(i, i + CHUNK), { onConflict: "product_code,arrival_date" });
      }
    } catch { /* 이미지는 부가 정보 */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// 시트의 주차별 주문·판매를 영구 보관한다. 시트에서 지난 주 열이나 상품이 사라져도 지우지 않는다.
// 주문·판매가 모두 0인 주는 저장하지 않는다(없으면 0으로 해석). 실패해도 동기화는 막지 않는다.
export async function archiveWeeklySales(products: ArrivalProduct[]): Promise<{ ok: boolean; rows: number; error?: string }> {
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const rows = products
      .filter(p => p.arrivalDate && p.weekly?.length)
      .flatMap(p => p.weekly!
        .filter(w => w.order > 0 || w.sales > 0)
        .map(w => ({
          product_code: p.productCode,
          arrival_date: p.arrivalDate,
          week_start:   w.weekStart,
          week_end:     w.weekEnd,
          order_qty:    w.order,
          sales_qty:    w.sales,
          updated_at:   now,
        })));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from("arrival_weekly_sales")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "product_code,arrival_date,week_start" });
      if (error) return { ok: false, rows: 0, error: error.message };
    }
    return { ok: true, rows: rows.length };
  } catch (e) {
    return { ok: false, rows: 0, error: e instanceof Error ? e.message : String(e) };
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

  // 안전장치: 한 번에 기존 오버라이드의 절반 이상이 "고아"로 판정되면
  // 시트 파싱/컬럼 매핑이 잘못됐을 가능성이 높으므로 삭제를 중단한다.
  // (2026-09-14: 시트 컬럼 밀림으로 전체 오버라이드가 삭제된 사고 재발 방지)
  const total = (overrideRows ?? []).length;
  if (total > 0 && toDelete.length / total > 0.5) {
    throw new Error(
      `오버라이드 ${toDelete.length}/${total}개가 고아로 판정되어 정리를 중단했습니다. ` +
      `시트 컬럼 매핑이 어긋났을 수 있으니 확인 후 다시 시도하세요.`
    );
  }

  if (toDelete.length > 0) {
    await supabase.from("arrival_overrides").delete().in("override_key", toDelete);
  }
}
