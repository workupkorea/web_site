import { NextResponse } from "next/server";
import type { ArrivalStatus, ArrivalProduct } from "@/lib/arrival";
import { replaceAllProducts, cleanupOrphanOverrides, getArrivalProducts } from "@/lib/arrival";

export const dynamic = "force-dynamic";

const SHEET_ID = "1-LTVNiZNSOXRra4SA0MTY1V7SCfvKtJP0QS-2HTAgVA";
const SHEET_GID = "0"; // 품목리스트 탭
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// 구글 시트가 느리거나 일시적으로 응답이 없을 때 요청이 무한정 걸려있지 않도록 타임아웃을 두고,
// 일시적인 네트워크 오류는 몇 번 재시도한다 (점주님들이 보는 화면이라 동기화 실패로 인한 중단을 최소화).
async function fetchCSVWithRetry(url: string, retries = 2, timeoutMs = 15000): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

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

// 실제 데이터 파싱에 쓰이는 열들이 기대하는 헤더 텍스트를 담고 있는지 검증한다.
// 시트에서 열이 추가/삭제/이동되면 IDX 인덱스가 엉뚱한 열을 가리키게 되어
// 판매가/공급가가 뒤바뀌는 등 조용한 데이터 오염이 발생했던 전례가 있다 (2026-09-14).
// 헤더가 기대와 다르면 동기화 자체를 막아야 하므로, 데이터 교체 전에 반드시 호출한다.
const EXPECTED_HEADERS: Record<string, { idx: number; keywords: string[] }> = {
  "번호(NO)":        { idx: 1,  keywords: ["NO"] },
  "상품 구분":       { idx: 2,  keywords: ["상품", "구분"] },
  "신상 구분":       { idx: 3,  keywords: ["신상", "구분"] },
  "물류 입고일":     { idx: 6,  keywords: ["입고일"] },
  "브랜드명":        { idx: 8,  keywords: ["브랜드"] },
  "품명":            { idx: 17, keywords: ["품명"] },
  "품번":            { idx: 18, keywords: ["품번"] },
  "컬러 CO.":        { idx: 19, keywords: ["컬러"] },
  "품번컬러 CO.":    { idx: 20, keywords: ["품번컬러"] },
  "컬러명":          { idx: 23, keywords: ["컬러명"] },
  "사이즈런":        { idx: 25, keywords: ["사이즈"] },
  "비고":            { idx: 28, keywords: ["비고"] },
  "마케팅 활용여부": { idx: 29, keywords: ["마케팅"] },
  "공급가":          { idx: 32, keywords: ["공급가"] },
  "판매가":          { idx: 33, keywords: ["판매가"] },
  "공급 수량":       { idx: 38, keywords: ["수량"] },
  "총입고 수량":     { idx: 41, keywords: ["수량"] },
  "총주문 수량":     { idx: 45, keywords: ["수량"] },
  "총판매 수량":     { idx: 49, keywords: ["수량"] },
  "총재고 수량":     { idx: 54, keywords: ["수량"] },
};

type HeaderMismatch = { label: string; idx: number; expected: string; actual: string };

function validateHeaders(rows: string[][]): HeaderMismatch[] {
  const header = rows[3] ?? [];
  const mismatches: HeaderMismatch[] = [];
  for (const [label, { idx, keywords }] of Object.entries(EXPECTED_HEADERS)) {
    const actual = String(header[idx] ?? "").replace(/\s/g, "");
    const ok = keywords.some(k => actual.includes(k.replace(/\s/g, "")));
    if (!ok) {
      mismatches.push({ label, idx, expected: keywords.join("/"), actual: (header[idx] ?? "").trim() || "(비어있음)" });
    }
  }
  return mismatches;
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
  // 2026-09-14: name~stockQty 구간이 실제 헤더보다 1칸씩 밀려 있던 것을 재확인해 수정함
  // (판매가 자리에 지점마진율이, 공급가 자리에 판매가가 들어가는 등의 오류 원인).
  const IDX = {
    no: 1, productType: 2, newArrivalType: 3, cat: 4, arrivalDate: 6,
    brand: 8,            // 브랜드명 (I열). J열(9)은 브랜드코드(예: "KT")라 표시용으로 쓰지 않음
    name: 17, code: 18, colorCode: 19,
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
    // 1. 구글 시트 CSV 가져오기 (타임아웃 + 재시도)
    let res: Response;
    try {
      res = await fetchCSVWithRetry(CSV_URL);
    } catch (e) {
      return NextResponse.json(
        { error: `구글 시트 요청 실패(네트워크/타임아웃): ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 }
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `구글 시트 요청 실패: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const csvText = await res.text();
    const rows = parseCSV(csvText);

    // 2. 시트 양식(헤더) 검증 — 열이 추가/삭제/이동되면 기존 데이터가 조용히 오염될 수 있으므로
    //    데이터를 교체하기 전에 먼저 막는다.
    const mismatches = validateHeaders(rows);
    if (mismatches.length > 0) {
      const detail = mismatches
        .map(m => `- ${m.label} (${m.idx}번째 열): 기대="${m.expected}" / 실제="${m.actual}"`)
        .join("\n");
      return NextResponse.json(
        {
          error: `구글 시트 양식이 변경되어 동기화를 중단했습니다. 열이 추가/삭제/이동되었을 수 있습니다.\n${detail}`,
          headerMismatch: true,
          mismatches,
        },
        { status: 422 }
      );
    }

    const products = parseSheetRows(rows);

    if (products.length === 0) {
      return NextResponse.json({ error: "파싱된 상품이 없습니다. 시트 구조를 확인해주세요." }, { status: 400 });
    }

    // 2-1. 안전장치: 새로 파싱된 상품 수가 기존 대비 급감했다면(예: 시트 일부만 로드됐거나
    //      실수로 대량 삭제된 경우) 동기화를 중단한다. 점주님들이 보는 화면이 갑자기
    //      텅 비거나 크게 줄어드는 사고를 막기 위함.
    const existing = await getArrivalProducts();
    if (existing.length >= 20 && products.length < existing.length * 0.5) {
      return NextResponse.json(
        {
          error:
            `새로 읽은 상품 수(${products.length}개)가 기존(${existing.length}개)보다 급격히 줄어들어 동기화를 중단했습니다. ` +
            `시트가 일부만 로드되었거나 실수로 행이 삭제되었을 수 있으니 시트 상태를 확인 후 다시 시도해주세요.`,
          suspiciousDrop: true,
          existingCount: existing.length,
          newCount: products.length,
        },
        { status: 422 }
      );
    }

    // 3. DB에 상품 전체 교체 저장 (신규 삽입 성공 후에만 기존 데이터 삭제 — 실패 시 기존 데이터 보존)
    await replaceAllProducts(products);

    // 4. 삭제된 상품 코드의 오버라이드 정리
    const newCodes = new Set(products.map(p => p.productCode));
    await cleanupOrphanOverrides(newCodes);

    // 5. 통계 반환
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
