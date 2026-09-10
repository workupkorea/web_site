import { NextResponse } from "next/server";
import type { ArrivalStatus, ArrivalProduct } from "@/lib/arrival";
import { replaceAllProducts, cleanupOrphanOverrides } from "@/lib/arrival";

export const dynamic = "force-dynamic";

const SHEET_ID = "1-LTVNiZNSOXRra4SA0MTY1V7SCfvKtJP0QS-2HTAgVA";
const SHEET_GID = "0"; // 품목리스트 탭
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const YEAR = 2026;

// ─── CSV 파서 ─────────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = "";
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }
  if (row.length > 0 || field) { row.push(field); rows.push(row); }
  return rows;
}

// ─── 날짜 파싱 ────────────────────────────────────────────────────────────────
// G열 물류입고일: "9/15" 단일 셀 형식 또는 구분 셀 형식 모두 처리
function parseArrivalDate(dateCell: string, _unused?: string): [string, ArrivalStatus] {
  const mc = dateCell.trim();

  if (!mc || mc === "-" || mc === "대기") {
    return mc === "대기" ? ["", "대기"] : ["", "일정미표기"];
  }

  try {
    let month = NaN;
    let day = NaN;

    if (mc.includes("/")) {
      // "9/15" 또는 "09/15" 형식
      const parts = mc.split("/").map(s => parseInt(s.trim(), 10));
      month = parts[0];
      day = parts[1];
    } else if (mc.includes(".")) {
      // "9.15" 형식
      const parts = mc.split(".").filter(Boolean).map(s => parseInt(s.trim(), 10));
      month = parts[0];
      day = parts[1] ?? NaN;
    } else {
      // 월만 있는 경우 ("9월") → 일정미표기
      month = parseInt(mc.replace("월", "").trim(), 10);
    }

    if (isNaN(month) || isNaN(day)) return ["", "일정미표기"];

    const d = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const status: ArrivalStatus = new Date(d) <= today ? "입고완료" : "입고예정";
    return [d, status];
  } catch {
    return ["", "일정미표기"];
  }
}

function parsePrice(s: string): number {
  const n = parseInt(s.replace(/,/g, "").trim(), 10);
  return isNaN(n) ? 0 : n;
}

// "행최종수정일시"(또는 "…수정일시") 헤더 열 인덱스를 찾는다. 없으면 -1.
// 이 헤더는 상단 병합셀(1행)에 들어갈 수 있어 상위 몇 개 행을 함께 훑는다.
function findStampIdx(rows: string[][]): number {
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const i = (rows[r] ?? []).findIndex(h => String(h ?? "").replace(/\s/g, "").includes("수정일시"));
    if (i >= 0) return i;
  }
  return -1;
}

// Apps Script 가 기록한 시각 문자열 → ISO. 파싱 불가하면 빈 문자열
function parseSheetStamp(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

// ─── 시트 파싱 → 상품 배열 ───────────────────────────────────────────────────
function parseSheetRows(rows: string[][]): ArrivalProduct[] {
  // 컬럼 인덱스 (헤더 row[3] 기준)
  const IDX = {
    no: 1, productType: 2, newArrivalType: 3, cat: 4, arrivalDate: 6,
    brand: 8, name: 17, code: 18, colorCode: 19,
    fullCode: 20, colorName: 23, sizeRun: 25, note: 28, marketingUsage: 29,
    supplyPrice: 32, price: 33,
    quantity: 38,       // 공급 수량 (공급점 발주)
    totalArrival: 41,   // 총입고(사입) 수량
    orderQty: 45,       // 총주문 수량
    salesQty: 49,       // 총판매 수량
    stockQty: 54,       // 총재고 수량
  } as const;

  // 입고 수량: 총입고(사입) 수량이 0이 아니면 그 값, 아니면 공급 수량으로 폴백
  function rowQty(row: string[]): number {
    const total = parsePrice(row[IDX.totalArrival] ?? "");
    return total !== 0 ? total : parsePrice(row[IDX.quantity] ?? "");
  }

  const stampIdx = findStampIdx(rows);

  type GroupKey = string; // `${baseCode}::${arrDate}`
  const groups = new Map<GroupKey, ArrivalProduct>();
  const groupColors = new Map<GroupKey, string[]>();
  const groupStamps = new Map<GroupKey, string>(); // 그룹 내 행들의 최신 수정시각(ISO)

  for (const row of rows.slice(4)) {
    const noVal = (row[IDX.no] ?? "").trim();
    if (!/^\d+$/.test(noVal)) continue;

    const baseCode = (row[IDX.code] ?? "").trim();
    if (!baseCode) continue;

    const [arrDate, status] = parseArrivalDate(row[IDX.arrivalDate] ?? "");

    const key: GroupKey = `${baseCode}::${arrDate}`;

    const colorName = (row[IDX.colorName] ?? "").trim();
    const colorCode = (row[IDX.colorCode] ?? "").trim();
    const color = colorName || colorCode;

    if (!groups.has(key)) {
      const marketingUsage = (row[IDX.marketingUsage] ?? "").trim() || undefined;
      groups.set(key, {
        productCode: baseCode,
        productName: (row[IDX.name] ?? "").trim(),
        brand: (row[IDX.brand] ?? "").trim(),
        category: (row[IDX.cat] ?? "").trim(),
        productType: (row[IDX.productType] ?? "").trim() || undefined,
        newArrivalType: (row[IDX.newArrivalType] ?? "").trim() || undefined,
        color: "",
        size: (row[IDX.sizeRun] ?? "").trim() || undefined,
        supplyPrice: parsePrice(row[IDX.supplyPrice] ?? ""),
        price: parsePrice(row[IDX.price] ?? ""),
        quantity: rowQty(row),
        orderQuantity: parsePrice(row[IDX.orderQty] ?? ""),
        salesQuantity: parsePrice(row[IDX.salesQty] ?? ""),
        stockQuantity: parsePrice(row[IDX.stockQty] ?? ""),
        arrivalDate: arrDate,
        status,
        description: "",
        note: (row[IDX.note] ?? "").trim(),
        marketingUsage,
        image: null,
        detailUrl: null,
        changeHistory: [],
      });
    } else {
      // 같은 그룹에 수량 합산
      const existing = groups.get(key)!;
      existing.quantity = (existing.quantity ?? 0) + rowQty(row);
      existing.orderQuantity = (existing.orderQuantity ?? 0) + parsePrice(row[IDX.orderQty] ?? "");
      existing.salesQuantity = (existing.salesQuantity ?? 0) + parsePrice(row[IDX.salesQty] ?? "");
      existing.stockQuantity = (existing.stockQuantity ?? 0) + parsePrice(row[IDX.stockQty] ?? "");
    }

    if (color) {
      const colors = groupColors.get(key) ?? [];
      if (!colors.includes(color)) colors.push(color);
      groupColors.set(key, colors);
    }

    if (stampIdx >= 0) {
      const stamp = parseSheetStamp(row[stampIdx] ?? "");
      const prev = groupStamps.get(key);
      if (stamp && (!prev || stamp > prev)) groupStamps.set(key, stamp);
    }
  }

  const products: ArrivalProduct[] = [];
  for (const [key, product] of groups) {
    product.color = (groupColors.get(key) ?? []).join(",");
    product.sheetEditedAt = groupStamps.get(key) || undefined;
    products.push(product);
  }

  // 입고일 → 브랜드 → 상품명 순 정렬
  products.sort((a, b) =>
    (a.arrivalDate || "9999").localeCompare(b.arrivalDate || "9999") ||
    a.brand.localeCompare(b.brand) ||
    a.productName.localeCompare(b.productName)
  );

  return products;
}

// ─── POST /api/admin/arrival/sync-sheet ──────────────────────────────────────
export async function POST() {
  try {
    // 1. 구글 시트 CSV 가져오기
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `구글 시트 요청 실패: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const csvText = await res.text();
    const rows = parseCSV(csvText);
    const products = parseSheetRows(rows);

    if (products.length === 0) {
      return NextResponse.json({ error: "파싱된 상품이 없습니다. 시트 구조를 확인해주세요." }, { status: 400 });
    }

    // 2. DB에 상품 전체 교체 저장
    await replaceAllProducts(products);

    // 3. 삭제된 상품 코드의 오버라이드 정리
    const newCodes = new Set(products.map(p => p.productCode));
    await cleanupOrphanOverrides(newCodes);

    // 4. 통계 반환
    const byStatus = products.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      total: products.length,
      byStatus,
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
