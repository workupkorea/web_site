/* eslint-disable @typescript-eslint/no-explicit-any */
// 워크업 연말 이벤트 — 고객 응모 페이지(/workup_luckup)와 검수 페이지(/workup_luckup/admin).
// 응모 데이터: Supabase 테이블 goldenbell_entries, 영수증 사진: Storage 비공개 버킷 goldenbell-receipts.
// 검수 페이지·API는 통합 회원 인증(grade=관리자)으로 보호한다.
import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { getSiteSection } from "@/lib/site-settings";
import { getPublicStores } from "@/lib/publicStores";
import { ADMIN_HTML, INDEX_HTML, INTERNAL_PREVIEW_HTML, PREVIEW_ADMIN_HTML, PREVIEW_HTML } from "../pages";
import { GOLDENBELL_PROMO_SECTION, renderPromoHtml } from "../promo";
import * as localPreviewDb from "../preview-draw";
import * as internalPreviewDb from "../internal-preview-db";
import { findRound, normalizePhone } from "../draw";
import * as draws from "../draw-server";
import { adminEvent, currentEntryEvent, testEventFor } from "../events-server";
import { eventPhase, isTestId, type PromotionEvent } from "@/app/admin/promotions/entries/events";
import { renderClosedPage, renderTestPage } from "../closed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "goldenbell_entries";
const BUCKET = "goldenbell-receipts";
const ENTRY_DAY_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
const PHONE_KEY = "goldenbell_entries_event_phone_key";
const PHOTO_KEY = "goldenbell_entries_event_photo_key";
const PHONE_MESSAGE = "이미 응모한 번호예요. 이벤트 기간 중 1인 1회만 응모할 수 있어요.";
const PHOTO_MESSAGE = "이미 응모에 사용한 영수증이에요. 다른 영수증 사진을 올려주세요.";
const PAGE_SIZE = 30; // 검수 목록: 한 페이지 응모자 수
const MAX_PHOTO = 4 * 1024 * 1024; // Vercel 함수 요청 본문 한도(4.5MB) 안쪽
const MAX_ENTRY_BODY = MAX_PHOTO + 32 * 1024; // 영수증과 multipart 필드·헤더 포함
const MAX_SHEET = 1024 * 1024; // 제외번호 엑셀
const FETCH_CHUNK = 1000; // Supabase 한 번에 가져오는 행 수 한도
const STATES = ["pending", "approved", "rejected"] as const;
const REJECT_REASONS = ["영수증 불명확", "기간 외 구매", "중복 응모", "매장 정보 불일치", "기타"];
const STATUS_LABELS: Record<string, string> = { pending: "검수 대기", approved: "승인", rejected: "반려" };
const UUID_RE = /^[a-f0-9-]{36}$/;
const DRAW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const EXT_MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

type Row = {
  id: string; phone: string; name: string; store: string; status: string;
  reject_reason: string | null; created_at: string; photo_hash: string; outcome?: "won" | "lost";
};

/* ---------- 응답 헬퍼 ---------- */
function send(body: BodyInit | null, status: number, contentType: string, extra: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      ...extra,
    },
  });
}
const json = (status: number, value: unknown) => send(JSON.stringify(value), status, "application/json; charset=utf-8");
const fail = (status: number, error: string) => json(status, { error });

/* ---------- 입력 정리 ---------- */
function sniffPhoto(photo: Buffer): string | null {
  if (photo.length >= 3 && photo[0] === 255 && photo[1] === 216 && photo[2] === 255) return "image/jpeg";
  if (photo.length >= 8 && photo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (photo.length >= 12 && photo.toString("ascii", 0, 4) === "RIFF" && photo.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
const tidy = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const code = (id: string) => id.slice(0, 8).toUpperCase();

/* ---------- Supabase 조회 헬퍼 ---------- */
// PostgREST 는 한 번에 1000행까지만 주므로 range 로 나눠서 모두 가져온다.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += FETCH_CHUNK) {
    const { data, error } = await build(from, from + FETCH_CHUNK - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < FETCH_CHUNK) return all;
  }
}
type Filters = { event: string; q: string; digits: string; status: string; store: string; from: string; to: string };
function readFilters(url: URL, event = ""): Filters {
  const param = (name: string) => (url.searchParams.get(name) || "").trim();
  const date = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
  const q = param("q").slice(0, 40);
  const status = param("status");
  return {
    event, q, digits: q.replace(/\D/g, "").slice(0, 11), status: (STATES as readonly string[]).includes(status) ? status : "",
    store: param("store").slice(0, 60), from: date(param("from")), to: date(param("to")),
  };
}
function applyFilters(query: any, f: Filters) {
  if (f.event) query = query.eq("event_id", f.event);
  if (f.status) query = query.eq("status", f.status);
  if (f.store) query = query.eq("store", f.store);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+09:00`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59.999+09:00`);
  if (f.q) {
    const like = f.q.replace(/[%,()*]/g, " ");
    query = f.digits ? query.or(`name.ilike.%${like}%,phone.like.%${f.digits}%`) : query.ilike("name", `%${like}%`);
  }
  return query;
}
function filterPreviewRows(rows: Row[], filters: Filters) {
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00+09:00`) : -Infinity;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999+09:00`) : Infinity;
  const query = filters.q.toLowerCase();
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.store && row.store !== filters.store) return false;
    const time = Date.parse(row.created_at);
    return time >= from && time <= to && (!query || row.name.toLowerCase().includes(query) ||
      (filters.digits && row.phone.includes(filters.digits)));
  });
}
// 같은 사진(photo_hash)이 서로 다른 번호로 접수된 해시 → 번호 집합
async function duplicateMap(hashes?: string[], previewRows?: Row[], eventId = "") {
  const map = new Map<string, Map<string, string>>(); // hash → (phone → name)
  const add = (rows: { phone: string; name: string; photo_hash: string }[]) => {
    for (const r of rows) {
      const phones = map.get(r.photo_hash) ?? new Map<string, string>();
      phones.set(r.phone, r.name);
      map.set(r.photo_hash, phones);
    }
  };
  if (previewRows) {
    add(previewRows);
    return map;
  }
  const sb = createAdminClient();
  // 실제 응모끼리는 이벤트가 달라도 비교하고, 테스트 응모는 같은 테스트 안에서만 비교한다.
  const rows = () => {
    const query = sb.from(TABLE).select("phone,name,photo_hash");
    return isTestId(eventId) ? query.eq("event_id", eventId) : query.not("event_id", "like", "%:test");
  };
  if (!hashes) {
    add(await fetchAll<any>((a, b) => rows().range(a, b)));
    return map;
  }
  for (let i = 0; i < hashes.length; i += 40) {
    const { data, error } = await rows().in("photo_hash", hashes.slice(i, i + 40));
    if (error) throw error;
    add(data ?? []);
  }
  return map;
}

/* ---------- 고객: 응모 / 내 응모 확인 ---------- */
async function readEntry(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_ENTRY_BODY) {
    return fail(413, "4MB 이하 영수증 사진을 올려주세요.");
  }
  const contentType = request.headers.get("content-type");
  if (!request.body || !contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return fail(400, "첨부 파일을 확인해 주세요.");
  }

  // 길이 헤더가 생략된 요청도 실제로 수신한 바이트 수로 제한한다.
  let received = 0;
  const boundedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > MAX_ENTRY_BODY) controller.error(new Error("Goldenbell entry body exceeds the size limit"));
      else controller.enqueue(chunk);
    },
  }));
  let form: FormData;
  try {
    form = await new Response(boundedBody, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    if (received > MAX_ENTRY_BODY) return fail(413, "4MB 이하 영수증 사진을 올려주세요.");
    return fail(400, "첨부 파일을 확인해 주세요.");
  }
  const name = tidy(form.get("name"));
  const phone = normalizePhone(form.get("phone"));
  const store = tidy(form.get("store"));
  const receipt = form.get("receipt");
  if (form.get("consent") !== "1") return fail(400, "개인정보 수집·이용에 동의해 주세요.");
  if (!name || name.length > 40 || !phone || !store || store.length > 60) {
    return fail(400, "이름, 010 휴대폰 번호, 매장명을 확인해 주세요.");
  }
  if (!receipt || typeof receipt === "string" || !receipt.size) return fail(400, "영수증 사진을 첨부해 주세요.");
  if (receipt.size > MAX_PHOTO) return fail(413, "4MB 이하 영수증 사진을 올려주세요.");
  const photo = Buffer.from(await receipt.arrayBuffer());
  const mime = sniffPhoto(photo);
  if (!mime || mime !== receipt.type) return fail(400, "JPG·PNG·WEBP 영수증 사진을 첨부해 주세요.");
  return { name, phone, store, photo, mime };
}

// 이벤트당 번호 1회. 최종 차단은 DB 고유 인덱스(PHONE_KEY·PHOTO_KEY)가 한다.
async function hasEntry(sb: ReturnType<typeof createAdminClient>, eventId: string, column: "entry_phone" | "photo_hash", value: string) {
  const { data, error } = await sb.from(TABLE).select("id").eq("event_id", eventId).eq(column, value).limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

const duplicatePhone = () => json(409, { error: PHONE_MESSAGE, field: "phone" });
const duplicatePhoto = () => json(409, { error: PHOTO_MESSAGE, field: "receipt" });

const closed = () => fail(403, "지금은 응모 기간이 아니에요.");
const testExpired = () => fail(403, "테스트 링크가 만료됐어요. 관리자에게 새 링크를 받아 주세요.");
/** 이 요청이 다루는 이벤트. 테스트 키가 있으면 테스트 영역이고, 키가 틀리면 null (실제 응모로 넘기지 않는다). */
async function requestEvent(request: Request) {
  const key = new URL(request.url).searchParams.get("test");
  return key === null ? currentEntryEvent() : testEventFor(key);
}
/** 응모를 받는 중인 이벤트. 아니면 거절 응답. 테스트 영역은 기간과 관계없이 열린다. */
async function openEvent(request: Request) {
  const event = await requestEvent(request);
  if (!event) return testExpired();
  return event.test || eventPhase(event) === "active" ? event : closed();
}

async function submit(request: Request) {
  const event = await openEvent(request);
  if (event instanceof Response) return event;
  const entry = await readEntry(request);
  if (entry instanceof Response) return entry;
  const { name, phone, store, photo, mime } = entry;
  const receivedAt = new Date();
  const now = receivedAt.toISOString();
  const day = ENTRY_DAY_FORMAT.format(receivedAt);
  const sb = createAdminClient();
  if (await hasEntry(sb, event.id, "entry_phone", phone)) return duplicatePhone();
  const hash = createHash("sha256").update(photo).digest("hex");
  if (await hasEntry(sb, event.id, "photo_hash", hash)) return duplicatePhoto();

  const id = randomUUID();
  const path = `${day.slice(0, 4)}/${id}.${MIME_EXT[mime]}`;
  const upload = await sb.storage.from(BUCKET).upload(path, photo, { contentType: mime });
  if (upload.error) throw upload.error;
  const insert = await sb.from(TABLE).insert({ id, event_id: event.id, phone, name, store, photo_path: path, photo_hash: hash, created_at: now, consent_at: now });
  if (insert.error) {
    const { error: cleanupError } = await sb.storage.from(BUCKET).remove([path]);
    if (cleanupError) console.error("[goldenbell] failed to remove unregistered receipt", cleanupError);
    if (insert.error.code === "23505") {
      if (insert.error.message.includes(PHONE_KEY)) return duplicatePhone();
      if (insert.error.message.includes(PHOTO_KEY)) {
        // 같은 번호가 같은 사진을 동시에 올리면 영수증 제약이 먼저 충돌할 수 있다.
        return await hasEntry(sb, event.id, "entry_phone", phone) ? duplicatePhone() : duplicatePhoto();
      }
    }
    throw insert.error;
  }
  return json(201, { code: code(id), store });
}
async function readPhone(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (!(length > 0 && length <= 1024)) return null;
  try { return normalizePhone((await request.json())?.phone); }
  catch { return null; }
}

async function checkPhone(request: Request) {
  const event = await openEvent(request);
  if (event instanceof Response) return event;
  const phone = await readPhone(request);
  if (!phone) return fail(400, "010으로 시작하는 휴대폰 번호를 확인해 주세요.");
  return await hasEntry(createAdminClient(), event.id, "entry_phone", phone) ? duplicatePhone() : json(200, { available: true });
}

// 휴대폰 번호로 접수번호·매장·응모일만 조회 (번호는 URL 이 아닌 본문으로 받는다).
// 검수 결과(승인·반려·사유)는 고객에게 보내지 않는다. 반려 건도 '응모 완료'로 보이고, 추첨에서만 제외한다.
async function lookup(request: Request) {
  const phone = await readPhone(request);
  if (!phone) return fail(400, "010으로 시작하는 휴대폰 번호를 확인해 주세요.");
  const event = await requestEvent(request);
  if (!event) return testExpired();
  const { data, error } = await createAdminClient().from(TABLE)
    .select("id,store,created_at").eq("event_id", event.id).eq("phone", phone).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return json(200, { entries: (data ?? []).map((r: any) => ({ code: code(r.id), store: r.store, created_at: r.created_at })) });
}
// 지역명 → 지점 선택, 응모 완료 화면의 길찾기·전화용 매장 정보 (공개 매장 단일 소스: DB)
async function storeList() {
  const stores = await getPublicStores();
  return json(200, { stores: stores.map(({ name, address, phone, hours, lat, lng }) => ({ name, address, phone, hours, lat, lng })) });
}

async function entryActivity(request: Request) {
  const event = await requestEvent(request);
  if (!event) return testExpired();
  const sb = createAdminClient();
  const now = new Date();
  const today = ENTRY_DAY_FORMAT.format(now);
  const todayEntries = (countOnly = false) => sb.from(TABLE).select("store", countOnly ? { count: "exact", head: true } : undefined)
    .eq("event_id", event.id)
    .gte("created_at", `${today}T00:00:00+09:00`).lte("created_at", now.toISOString())
    .neq("status", "rejected");
  // Entry store values are user input. Only publish names from the public store catalog.
  const [entries, stores] = await Promise.all([
    todayEntries().order("created_at", { ascending: false }).limit(100),
    sb.from("stores").select("name").eq("is_active", true),
  ]);
  if (entries.error) throw entries.error;
  if (stores.error) throw stores.error;
  const publicNames = new Map((stores.data ?? []).filter(({ name }) => typeof name === "string" && tidy(name)).map(({ name }) => [tidy(name), name as string]));
  const recentStores = [...new Set((entries.data ?? []).map(({ store }) => store as string))]
    .filter((store) => publicNames.has(store)).slice(0, 5);
  const counts = await Promise.all(recentStores.map(async (store) => {
    const { count, error } = await todayEntries(true).eq("store", store);
    if (error) throw error;
    return { store: publicNames.get(store), count: count ?? 0 };
  }));
  const activity = counts.filter(({ count }) => count > 0);

  return send(JSON.stringify({ activity }), 200, "application/json; charset=utf-8", {
    "Cache-Control": "public, max-age=0, s-maxage=15",
  });
}

/* ---------- 관리자: 목록 · 요약 · 엑셀 · 검수 ---------- */
const ROW_COLS = "id,phone,name,store,status,reject_reason,created_at,photo_hash";
function loadFilteredRows(filters: Filters, previewRows?: Row[]) {
  if (previewRows) return filterPreviewRows(previewRows, filters);
  const sb = createAdminClient();
  return fetchAll<Row>((a, b) => applyFilters(sb.from(TABLE).select(ROW_COLS), filters).order("created_at", { ascending: false }).order("id").range(a, b));
}
async function listGroups(url: URL, previewRows?: Row[], eventId = "") {
  const f = readFilters(url, eventId);
  const page = Math.min(10000, Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0)));
  const rows = await loadFilteredRows(f, previewRows);
  const phones: string[] = [];
  const names = new Map<string, string>();
  for (const r of rows) if (!names.has(r.phone)) { names.set(r.phone, r.name); phones.push(r.phone); } // 최신순 → 최신 이름
  const pagePhones = phones.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const more = phones.length > (page + 1) * PAGE_SIZE;
  const counts = new Map<string, { total: number; pending: number; approved: number; rejected: number }>();
  if (pagePhones.length) {
    const sb = previewRows ? null : createAdminClient();
    const all = sb ? await fetchAll<{ phone: string; status: string }>((a, b) => sb.from(TABLE).select("phone,status").eq("event_id", eventId).in("phone", pagePhones).range(a, b))
      : previewRows!.filter((row) => pagePhones.includes(row.phone));
    for (const r of all) {
      const c = counts.get(r.phone) ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
      c.total++; (c as any)[r.status]++;
      counts.set(r.phone, c);
    }
  }
  const shown = rows.filter((r) => pagePhones.includes(r.phone));
  const dupes = await duplicateMap([...new Set(shown.map((r) => r.photo_hash))], previewRows, eventId);
  const groups = pagePhones.map((phone) => ({
    phone, name: names.get(phone) ?? "", ...(counts.get(phone) ?? { total: 0, pending: 0, approved: 0, rejected: 0 }),
    records: shown.filter((r) => r.phone === phone).map((r) => {
      const others = [...(dupes.get(r.photo_hash) ?? new Map()).entries()].filter(([p]) => p !== phone).map(([p, n]) => ({ phone: p, name: n }));
      return { id: r.id, name: r.name, store: r.store, created_at: r.created_at, status: r.status, reject_reason: r.reject_reason, duplicate: others.length > 0, dupes: others, outcome: r.outcome };
    }),
  }));
  return json(200, { groups, more });
}
async function summary(previewRows?: Row[], eventId = "") {
  const sb = previewRows ? null : createAdminClient();
  const all = previewRows ?? await fetchAll<Pick<Row, "phone" | "store" | "status" | "photo_hash">>(
    (a, b) => sb!.from(TABLE).select("phone,store,status,photo_hash").eq("event_id", eventId).range(a, b),
  );
  const phonesByHash = new Map<string, Set<string>>();
  for (const r of all) phonesByHash.set(r.photo_hash, (phonesByHash.get(r.photo_hash) ?? new Set()).add(r.phone));
  const blank = () => ({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const total = { ...blank(), duplicate: 0 };
  const byStore = new Map<string, ReturnType<typeof blank>>();
  for (const r of all) {
    const s = byStore.get(r.store) ?? blank();
    for (const target of [total, s] as any[]) { target.total++; target[r.status]++; }
    if ((phonesByHash.get(r.photo_hash)?.size ?? 0) > 1) total.duplicate++;
    byStore.set(r.store, s);
  }
  const stores = [...byStore.entries()].map(([store, c]) => ({ store, ...c })).sort((x, y) => y.total - x.total || x.store.localeCompare(y.store, "ko"));
  return json(200, { ...total, stores, reasons: REJECT_REASONS });
}
async function exportExcel(url: URL, previewRows?: Row[], eventId = "") {
  const f = readFilters(url, eventId);
  const rows = await loadFilteredRows(f, previewRows);
  const dupes = await duplicateMap(undefined, previewRows, eventId);
  const sheet = XLSX.utils.json_to_sheet(rows.map((r) => ({
    접수번호: code(r.id),
    응모일시: new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }),
    이름: r.name,
    휴대폰: r.phone.replace(/^(010)(\d{4})(\d{4})$/, "$1-$2-$3"),
    "방문 매장": r.store,
    "검수 상태": STATUS_LABELS[r.status],
    "반려 사유": r.reject_reason || "",
    "중복 의심": (dupes.get(r.photo_hash)?.size ?? 0) > 1 ? "다른 번호로 같은 사진" : "",
    ...(previewRows ? { "아메리카노 추첨 결과": r.outcome === "won" ? "당첨" : "미당첨" } : {}),
  })));
  sheet["!cols"] = [10, 20, 10, 14, 20, 10, 16, 22, ...(previewRows ? [21] : [])].map((wch) => ({ wch }));
  return downloadWorkbook(sheet, "응모내역", previewRows ? "goldenbell-v2" : "goldenbell");
}
function couponWinners(url: URL, rows: Row[]) {
  return filterPreviewRows(rows, readFilters(url)).filter((row) => row.outcome === "won");
}
// 쿠폰 발송 대상: 승인된 당첨 건을 번호당 1건만 남긴다.
function couponRecipients(winners: Row[]) {
  return [...new Map(winners.filter((row) => row.status === "approved").map((row) => [row.phone, row])).values()];
}
function listCouponWinners(url: URL, rows: Row[]) {
  const winners = couponWinners(url, rows);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(winners.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1)));
  const entries = winners.slice((page - 1) * pageSize, page * pageSize)
    .map(({ name, phone, store, created_at, status }) => ({ name, phone, store, created_at, status }));
  return json(200, { entries, page, pages, total: winners.length, eligible: couponRecipients(winners).length });
}
function exportCouponRecipients(url: URL, rows: Row[]) {
  const recipients = couponRecipients(couponWinners(url, rows));
  const sheet = XLSX.utils.aoa_to_sheet([["이름", "휴대폰번호"], ...recipients.map((row) => [row.name, row.phone])]);
  sheet["!cols"] = [{ wch: 18 }, { wch: 16 }];
  return downloadWorkbook(sheet, "쿠폰 발송 대상", "goldenbell-v2-coupon");
}
function downloadWorkbook(sheet: XLSX.WorkSheet, sheetName: string, filename: string) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const file: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return send(new Uint8Array(file), 200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {
    "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
  });
}
async function receipt(id: string) {
  const sb = createAdminClient();
  const { data } = await sb.from(TABLE).select("photo_path").eq("id", id).maybeSingle();
  if (!data) return fail(404, "영수증을 찾지 못했어요.");
  const file = await sb.storage.from(BUCKET).download(data.photo_path);
  if (file.error || !file.data) return fail(404, "영수증을 찾지 못했어요.");
  const ext = String(data.photo_path).split(".").pop() || "";
  return send(await file.data.arrayBuffer(), 200, EXT_MIME[ext] || "application/octet-stream");
}
async function readJson(request: Request, limit: number): Promise<any> {
  if (Number(request.headers.get("content-length")) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(text + decoder.decode());
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); return null; }
      text += decoder.decode(value, { stream: true });
    }
  } catch { return null; }
}
const validReview = (body: any) => (STATES as readonly string[]).includes(body?.status) && (body.status !== "rejected" || REJECT_REASONS.includes(body.reason));
async function review(ids: string[], body: any) {
  const patch = { status: body.status, reject_reason: body.status === "rejected" ? body.reason : null };
  const { data, error } = await createAdminClient().from(TABLE).update(patch).in("id", ids).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/* ---------- 관리자: 당첨기 · 제외번호 ---------- */
async function drawRoute(request: Request, url: URL, action: string, event: PromotionEvent) {
  const method = request.method;
  try {
    if (method === "GET" && action === "") return json(200, await draws.drawOverview(event));
    if (method === "GET" && action === "/results") return json(200, await draws.eventResults(event));
    if (method === "GET" && action === "/export") {
      const round = findRound(draws.eventRounds(event), url.searchParams.get("prize"), url.searchParams.get("round"));
      if (!round) return fail(400, "추첨 회차를 확인해 주세요.");
      const sheet = XLSX.utils.aoa_to_sheet(await draws.winnerSheetRows(event, round));
      sheet["!cols"] = [14, 16, 22, 22, 18].map((wch) => ({ wch }));
      return downloadWorkbook(sheet, "당첨자", `goldenbell-${round.prize}-${round.round}`);
    }
    if (method !== "POST") return fail(404, "페이지를 찾지 못했어요.");
    if (action === "/excluded/upload") {
      const length = Number(request.headers.get("content-length"));
      if (!(length > 0 && length <= MAX_SHEET)) return fail(413, "1MB 이하 엑셀 파일을 올려주세요.");
      let rows: unknown[][];
      try {
        const book = XLSX.read(Buffer.from(await request.arrayBuffer()), { type: "buffer", sheetRows: 6000 });
        rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: true });
      } catch {
        return fail(400, "엑셀 파일을 읽지 못했어요.");
      }
      return json(200, await draws.addExcludedRows(event.id, rows, url.searchParams.get("memo") ?? ""));
    }
    const body = await readJson(request, 256 * 1024);
    if (action === "") {
      const round = findRound(draws.eventRounds(event), body?.prize, body?.round);
      return round ? json(200, await draws.runDraw(event, round)) : fail(400, "추첨 회차를 확인해 주세요.");
    }
    if (action === "/quota") {
      if (body?.prize !== "coffee" && body?.prize !== "gold") return fail(400, "당첨기를 확인해 주세요.");
      await draws.setQuota(event, body.prize, Number(body.quota));
      return json(200, { ok: true });
    }
    if (action === "/cancel") {
      if (typeof body?.id !== "string" || !UUID_RE.test(body.id)) return fail(400, "당첨 내역을 확인해 주세요.");
      return json(200, await draws.cancelWinner(event, body.id));
    }
    if (action === "/excluded") {
      if (typeof body?.phones !== "string") return fail(400, "등록할 번호를 입력해 주세요.");
      return json(200, await draws.addExcluded(event.id, body.phones, typeof body.memo === "string" ? body.memo : ""));
    }
    if (action === "/excluded/remove") {
      const phone = normalizePhone(body?.phone);
      if (!phone) return fail(400, "삭제할 번호를 확인해 주세요.");
      await draws.removeExcluded(event.id, phone);
      return json(200, { ok: true });
    }
    return fail(404, "페이지를 찾지 못했어요.");
  } catch (error) {
    if (error instanceof draws.DrawError) return fail(error.status, error.message);
    throw error;
  }
}

/* ---------- 라우팅 ---------- */
// 검수 화면 접근 권한: 관리자 로그인 회원.
// 테스트 편의상 로컬 개발 서버(npm run dev)에서는 로그인 없이 열린다.
// 배포 환경에서 로그인 없이 열어야 하면 환경변수 GOLDENBELL_ADMIN_OPEN=1 을 직접 설정해야 한다
// (응모자 개인정보가 보이므로 실제 이벤트 운영 전에는 반드시 제거할 것).
async function canOpenAdmin() {
  if (process.env.NODE_ENV === "development" || process.env.GOLDENBELL_ADMIN_OPEN === "1") return true;
  return isAdmin();
}

async function route(request: Request) {
  const url = new URL(request.url);
  // 공개 주소(/workup_luckup)와 내부 주소(/goldenbell) 어느 쪽으로 들어와도 같은 화면을 고른다.
  const path = url.pathname.replace(/^\/(?:goldenbell|workup_luckup)/, "") || "/";
  const method = request.method;
  const localPreview = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // Enable hosted testing only on a protected Preview deployment opted in explicitly.
  const internalPreview = process.env.VERCEL_ENV === "preview" && process.env.GOLDENBELL_INTERNAL_PREVIEW === "1";
  const previewEnabled = localPreview || internalPreview;
  const previewDb = internalPreview ? internalPreviewDb : localPreviewDb;
  const origin = request.headers.get("origin");
  if (method !== "GET" && origin && new URL(origin).host !== request.headers.get("host")) return fail(403, "허용되지 않은 요청이에요.");

  // 고객 화면
  if (method === "GET" && path === "/") {
    const event = await requestEvent(request);
    let html: string;
    if (!event) html = renderClosedPage(INDEX_HTML, null, "ended");
    else if (event.test) html = renderTestPage(INDEX_HTML);
    else {
      const phase = eventPhase(event);
      html = phase === "active" ? INDEX_HTML : renderClosedPage(INDEX_HTML, event, phase);
    }
    return send(html, 200, "text/html; charset=utf-8");
  }
  if (method === "GET" && path === "/promo") {
    const config = await getSiteSection(GOLDENBELL_PROMO_SECTION);
    return send(renderPromoHtml(config), 200, "text/html; charset=utf-8");
  }
  if (method === "GET" && path === "/v2" && previewEnabled) {
    return send(internalPreview ? INTERNAL_PREVIEW_HTML : PREVIEW_HTML, 200, "text/html; charset=utf-8", {
      "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",
    });
  }
  if (path === "/api/v2/draw" && previewEnabled) {
    if (method === "GET") return json(200, { soldOut: await previewDb.previewSoldOut() });
    if (method === "POST") {
      const id = request.headers.get("x-draw-id");
      if (!id || !DRAW_ID_RE.test(id)) {
        return fail(400, "테스트 응모를 다시 시도해 주세요.");
      }
      const entry = await readEntry(request);
      if (entry instanceof Response) return entry;
      const outcome = await previewDb.drawPreview(id, entry);
      if (outcome === "already-entered") return fail(409, "이 휴대폰 번호로 오늘 이미 응모하셨습니다. 동일한 휴대폰 번호로는 하루에 한 번만 응모할 수 있습니다.");
      return json(200, { outcome });
    }
  }
  if (method === "GET" && path === "/api/stores") return storeList();
  if (method === "GET" && path === "/api/entries/activity") return entryActivity(request);
  if (method === "POST" && path === "/api/entries") return submit(request);
  if (method === "POST" && path === "/api/entries/check-phone") return checkPhone(request);
  if (method === "POST" && path === "/api/entries/lookup") return lookup(request);

  // 관리자 화면·API — 관리자 로그인 필수
  const previewAdmin = path === "/v2/admin" || path.startsWith("/api/v2/admin/");
  const adminPath = previewAdmin ? path.replace("/v2/", "/") : path;
  if (adminPath === "/admin" || adminPath.startsWith("/api/admin/")) {
    if (previewAdmin && !previewEnabled) return fail(404, "페이지를 찾지 못했어요.");
    if (method === "GET" && path === "/admin" && url.searchParams.get("embedded") === "1") {
      if (!(await isAdmin())) return fail(401, "관리자 로그인이 필요해요.");
      return send(ADMIN_HTML, 200, "text/html; charset=utf-8", {
        "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; frame-ancestors 'self'; form-action 'self'; base-uri 'none'",
      });
    }
    if (!previewAdmin && !(await canOpenAdmin())) {
      return adminPath === "/admin"
        ? Response.redirect(new URL("/member/login?from=admin", request.url), 302)
        : fail(401, "관리자 로그인이 필요해요.");
    }
    if (method === "GET" && adminPath === "/admin") return send(previewAdmin ? PREVIEW_ADMIN_HTML : ADMIN_HTML, 200, "text/html; charset=utf-8");
    const drawMatch = !previewAdmin && adminPath.match(/^\/api\/admin\/draw(\/.*)?$/);
    if (drawMatch) {
      // 당첨 결과를 바꾸는 기능이라 검수 화면 공개 설정과 별개로 관리자 로그인을 요구한다.
      if (process.env.NODE_ENV !== "development" && !(await isAdmin())) return fail(401, "관리자 로그인이 필요해요.");
      const event = await adminEvent(url.searchParams.get("event"));
      return event ? drawRoute(request, url, drawMatch[1] ?? "", event) : fail(404, "이벤트를 찾지 못했어요.");
    }
    const previewRows = () => previewAdmin ? previewDb.listPreviewEntries() : undefined;
    // 목록·요약·엑셀은 선택한 이벤트의 응모만 다룬다 (2차 테스트 화면은 제외).
    let eventId = "";
    if (!previewAdmin && method === "GET" && /^\/api\/admin\/(groups|summary|export)$/.test(adminPath)) {
      const event = await adminEvent(url.searchParams.get("event"));
      if (!event) return fail(404, "이벤트를 찾지 못했어요.");
      eventId = event.id;
    }
    if (method === "GET" && adminPath === "/api/admin/groups") return listGroups(url, await previewRows(), eventId);
    if (method === "GET" && adminPath === "/api/admin/summary") return summary(await previewRows(), eventId);
    if (method === "GET" && adminPath === "/api/admin/export") return exportExcel(url, await previewRows(), eventId);
    if (method === "GET" && previewAdmin && adminPath === "/api/admin/coupon-winners") return listCouponWinners(url, await previewDb.listPreviewEntries());
    if (method === "GET" && previewAdmin && adminPath === "/api/admin/coupon-export") return exportCouponRecipients(url, await previewDb.listPreviewEntries());
    const receiptMatch = adminPath.match(/^\/api\/admin\/receipts\/([a-f0-9-]{36})$/);
    if (method === "GET" && receiptMatch) {
      if (!previewAdmin) return receipt(receiptMatch[1]);
      const image = await previewDb.readPreviewReceipt(receiptMatch[1]);
      return image ? send(Uint8Array.from(image.photo), 200, image.mime) : fail(404, "영수증을 찾지 못했어요.");
    }
    const saveReview = (ids: string[], body: any) => previewAdmin
      ? previewDb.updatePreviewReview(ids, body.status, body.status === "rejected" ? body.reason : null)
      : review(ids, body);
    if (method === "POST" && adminPath === "/api/admin/entries/bulk") {
      const body = await readJson(request, 16384);
      const ids = Array.isArray(body?.ids) ? body.ids : [];
      if (!validReview(body) || !ids.length || ids.length > 200 || !ids.every((id: unknown) => typeof id === "string" && UUID_RE.test(id))) {
        return fail(400, "검수 값이 올바르지 않아요.");
      }
      return json(200, { ok: true, changed: await saveReview(ids, body) });
    }
    const entryMatch = adminPath.match(/^\/api\/admin\/entries\/([a-f0-9-]{36})$/);
    if (method === "PATCH" && entryMatch) {
      const body = await readJson(request, 2048);
      if (!validReview(body)) return fail(400, "검수 값이 올바르지 않아요. 반려는 사유를 선택해야 해요.");
      return (await saveReview([entryMatch[1]], body)) ? json(200, { ok: true }) : fail(404, "응모 건을 찾지 못했어요.");
    }
  }
  return fail(404, "페이지를 찾지 못했어요.");
}

async function handle(request: Request) {
  try { return await route(request); }
  catch (error) {
    console.error("[goldenbell]", error);
    // 이벤트 SQL 실행 전에 배포하면 새 컬럼이 없다.
    if ((error as { code?: string })?.code === "42703") return fail(503, "DB 설정이 필요해요. 연말 이벤트 SQL을 실행해 주세요.");
    return fail(500, "처리 중 문제가 생겼어요.");
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
