/* eslint-disable @typescript-eslint/no-explicit-any */
// 연말연시 골든벨 이벤트 — 고객 응모 페이지(/goldenbell)와 검수 페이지(/goldenbell/admin).
// 응모 데이터: Supabase 테이블 goldenbell_entries, 영수증 사진: Storage 비공개 버킷 goldenbell-receipts.
// 검수 페이지·API는 통합 회원 인증(grade=관리자)으로 보호한다.
import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { getPublicStores } from "@/lib/publicStores";
import { ADMIN_HTML, INDEX_HTML } from "../pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "goldenbell_entries";
const BUCKET = "goldenbell-receipts";
const PAGE_SIZE = 30; // 검수 목록: 한 페이지 응모자 수
const MAX_PHOTO = 4 * 1024 * 1024; // Vercel 함수 요청 본문 한도(4.5MB) 안쪽
const FETCH_CHUNK = 1000; // Supabase 한 번에 가져오는 행 수 한도
const STATES = ["pending", "approved", "rejected"] as const;
const REJECT_REASONS = ["영수증 불명확", "기간 외 구매", "중복 응모", "매장 정보 불일치", "기타"];
const STATUS_LABELS: Record<string, string> = { pending: "검수 대기", approved: "승인", rejected: "반려" };
const UUID_RE = /^[a-f0-9-]{36}$/;
const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const EXT_MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

type Row = {
  id: string; phone: string; name: string; store: string; status: string;
  reject_reason: string | null; created_at: string; photo_hash: string; photo_path?: string;
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
function normalizePhone(input: unknown): string | null {
  let value = String(input ?? "").trim().replace(/[\s()-]/g, "");
  if (value.startsWith("+82")) value = "0" + value.slice(3);
  return /^010\d{8}$/.test(value) ? value : null;
}
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
type Filters = { q: string; digits: string; status: string; store: string; from: string; to: string };
function readFilters(url: URL): Filters {
  const param = (name: string) => (url.searchParams.get(name) || "").trim();
  const date = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
  const q = param("q").slice(0, 40);
  const status = param("status");
  return {
    q, digits: q.replace(/\D/g, "").slice(0, 11), status: (STATES as readonly string[]).includes(status) ? status : "",
    store: param("store").slice(0, 60), from: date(param("from")), to: date(param("to")),
  };
}
function applyFilters(query: any, f: Filters) {
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
// 같은 사진(photo_hash)이 서로 다른 번호로 접수된 해시 → 번호 집합
async function duplicateMap(hashes?: string[]) {
  const sb = createAdminClient();
  const map = new Map<string, Map<string, string>>(); // hash → (phone → name)
  const add = (rows: { phone: string; name: string; photo_hash: string }[]) => {
    for (const r of rows) {
      const phones = map.get(r.photo_hash) ?? new Map<string, string>();
      phones.set(r.phone, r.name);
      map.set(r.photo_hash, phones);
    }
  };
  if (!hashes) {
    add(await fetchAll<any>((a, b) => sb.from(TABLE).select("phone,name,photo_hash").range(a, b)));
    return map;
  }
  for (let i = 0; i < hashes.length; i += 40) {
    const { data, error } = await sb.from(TABLE).select("phone,name,photo_hash").in("photo_hash", hashes.slice(i, i + 40));
    if (error) throw error;
    add(data ?? []);
  }
  return map;
}

/* ---------- 고객: 응모 / 내 응모 확인 ---------- */
async function submit(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > MAX_PHOTO + 32768) {
    return fail(413, "4MB 이하 영수증 사진을 올려주세요.");
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return fail(400, "첨부 파일을 확인해 주세요."); }
  const name = tidy(form.get("name"));
  const phone = normalizePhone(form.get("phone"));
  const store = tidy(form.get("store"));
  const receipt = form.get("receipt");
  if (form.get("consent") !== "1") return fail(400, "개인정보 수집·이용에 동의해 주세요.");
  if (!name || name.length > 40 || !phone || !store || store.length > 60) {
    return fail(400, "이름, 010 휴대폰 번호, 매장명을 확인해 주세요.");
  }
  if (!receipt || typeof receipt === "string" || !receipt.size || receipt.size > MAX_PHOTO) {
    return fail(400, "4MB 이하 영수증 사진을 첨부해 주세요.");
  }
  const photo = Buffer.from(await receipt.arrayBuffer());
  const mime = sniffPhoto(photo);
  if (!mime || mime !== receipt.type) return fail(400, "JPG·PNG·WEBP 영수증 사진을 첨부해 주세요.");
  const hash = createHash("sha256").update(photo).digest("hex");

  const sb = createAdminClient();
  const existing = await sb.from(TABLE).select("id,store").eq("phone", phone).eq("photo_hash", hash).maybeSingle();
  if (existing.data) return json(200, { code: code(existing.data.id), store: existing.data.store });

  const id = randomUUID();
  const path = `${new Date().getFullYear()}/${id}.${MIME_EXT[mime]}`;
  const upload = await sb.storage.from(BUCKET).upload(path, photo, { contentType: mime });
  if (upload.error) throw upload.error;
  const now = new Date().toISOString();
  const insert = await sb.from(TABLE).insert({ id, phone, name, store, photo_path: path, photo_hash: hash, created_at: now, consent_at: now });
  if (insert.error) {
    await sb.storage.from(BUCKET).remove([path]);
    if (insert.error.code === "23505") { // 동시에 같은 사진이 들어온 경우 — 먼저 들어온 건으로 안내
      const again = await sb.from(TABLE).select("id,store").eq("phone", phone).eq("photo_hash", hash).maybeSingle();
      if (again.data) return json(200, { code: code(again.data.id), store: again.data.store });
    }
    throw insert.error;
  }
  return json(201, { code: code(id), store });
}
// 휴대폰 번호로 접수번호·매장·상태·반려 사유만 조회 (번호는 URL 이 아닌 본문으로 받는다)
async function lookup(request: Request) {
  const length = Number(request.headers.get("content-length"));
  let body: any;
  if (length > 0 && length <= 1024) { try { body = await request.json(); } catch { /* 아래에서 처리 */ } }
  const phone = normalizePhone(body?.phone);
  if (!phone) return fail(400, "010으로 시작하는 휴대폰 번호를 확인해 주세요.");
  const { data, error } = await createAdminClient().from(TABLE)
    .select("id,store,created_at,status,reject_reason").eq("phone", phone).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return json(200, { entries: (data ?? []).map((r: any) => ({ code: code(r.id), store: r.store, created_at: r.created_at, status: r.status, reason: r.reject_reason || "" })) });
}
// 지역명 → 지점 선택, 응모 완료 화면의 길찾기·전화용 매장 정보 (공개 매장 단일 소스: DB)
async function storeList() {
  const stores = await getPublicStores();
  return json(200, { stores: stores.map(({ name, address, phone, hours, lat, lng }) => ({ name, address, phone, hours, lat, lng })) });
}

/* ---------- 관리자: 목록 · 요약 · 엑셀 · 검수 ---------- */
const ROW_COLS = "id,phone,name,store,status,reject_reason,created_at,photo_hash";
async function listGroups(url: URL) {
  const f = readFilters(url);
  const page = Math.min(10000, Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0)));
  const sb = createAdminClient();
  const rows = await fetchAll<Row>((a, b) => applyFilters(sb.from(TABLE).select(ROW_COLS), f).order("created_at", { ascending: false }).order("id").range(a, b));
  const phones: string[] = [];
  const names = new Map<string, string>();
  for (const r of rows) if (!names.has(r.phone)) { names.set(r.phone, r.name); phones.push(r.phone); } // 최신순 → 최신 이름
  const pagePhones = phones.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const more = phones.length > (page + 1) * PAGE_SIZE;
  const counts = new Map<string, { total: number; pending: number; approved: number; rejected: number }>();
  if (pagePhones.length) {
    const all = await fetchAll<{ phone: string; status: string }>((a, b) => sb.from(TABLE).select("phone,status").in("phone", pagePhones).range(a, b));
    for (const r of all) {
      const c = counts.get(r.phone) ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
      c.total++; (c as any)[r.status]++;
      counts.set(r.phone, c);
    }
  }
  const shown = rows.filter((r) => pagePhones.includes(r.phone));
  const dupes = await duplicateMap([...new Set(shown.map((r) => r.photo_hash))]);
  const groups = pagePhones.map((phone) => ({
    phone, name: names.get(phone) ?? "", ...(counts.get(phone) ?? { total: 0, pending: 0, approved: 0, rejected: 0 }),
    records: shown.filter((r) => r.phone === phone).map((r) => {
      const others = [...(dupes.get(r.photo_hash) ?? new Map()).entries()].filter(([p]) => p !== phone).map(([p, n]) => ({ phone: p, name: n }));
      return { id: r.id, name: r.name, store: r.store, created_at: r.created_at, status: r.status, reject_reason: r.reject_reason, duplicate: others.length > 0, dupes: others };
    }),
  }));
  return json(200, { groups, more });
}
async function summary() {
  const sb = createAdminClient();
  const all = await fetchAll<any>((a, b) => sb.from(TABLE).select("phone,store,status,photo_hash").range(a, b));
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
async function exportExcel(url: URL) {
  const f = readFilters(url);
  const sb = createAdminClient();
  const rows = await fetchAll<Row>((a, b) => applyFilters(sb.from(TABLE).select(ROW_COLS), f).order("created_at", { ascending: false }).order("id").range(a, b));
  const dupes = await duplicateMap();
  const sheet = XLSX.utils.json_to_sheet(rows.map((r) => ({
    접수번호: code(r.id),
    응모일시: new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }),
    이름: r.name,
    휴대폰: r.phone.replace(/^(010)(\d{4})(\d{4})$/, "$1-$2-$3"),
    "방문 매장": r.store,
    "검수 상태": STATUS_LABELS[r.status],
    "반려 사유": r.reject_reason || "",
    "중복 의심": (dupes.get(r.photo_hash)?.size ?? 0) > 1 ? "다른 번호로 같은 사진" : "",
  })));
  sheet["!cols"] = [10, 20, 10, 14, 20, 10, 16, 22].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "응모내역");
  const file: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return send(new Uint8Array(file), 200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {
    "Content-Disposition": `attachment; filename="goldenbell-${new Date().toISOString().slice(0, 10)}.xlsx"`,
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
  const length = Number(request.headers.get("content-length"));
  if (!length || length > limit) return null;
  try { return await request.json(); } catch { return null; }
}
const validReview = (body: any) => (STATES as readonly string[]).includes(body?.status) && (body.status !== "rejected" || REJECT_REASONS.includes(body.reason));
async function review(ids: string[], body: any) {
  const patch = { status: body.status, reject_reason: body.status === "rejected" ? body.reason : null };
  const { data, error } = await createAdminClient().from(TABLE).update(patch).in("id", ids).select("id");
  if (error) throw error;
  return data?.length ?? 0;
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
  const path = url.pathname.slice("/goldenbell".length) || "/";
  const method = request.method;
  const origin = request.headers.get("origin");
  if (method !== "GET" && origin && new URL(origin).host !== request.headers.get("host")) return fail(403, "허용되지 않은 요청이에요.");

  // 고객 화면
  if (method === "GET" && path === "/") return send(INDEX_HTML, 200, "text/html; charset=utf-8");
  if (method === "GET" && path === "/api/stores") return storeList();
  if (method === "POST" && path === "/api/entries") return submit(request);
  if (method === "POST" && path === "/api/entries/lookup") return lookup(request);

  // 관리자 화면·API — 관리자 로그인 필수
  if (path === "/admin" || path.startsWith("/api/admin/")) {
    if (!(await canOpenAdmin())) {
      return path === "/admin"
        ? Response.redirect(new URL("/member/login?from=admin", request.url), 302)
        : fail(401, "관리자 로그인이 필요해요.");
    }
    if (method === "GET" && path === "/admin") return send(ADMIN_HTML, 200, "text/html; charset=utf-8");
    if (method === "GET" && path === "/api/admin/groups") return listGroups(url);
    if (method === "GET" && path === "/api/admin/summary") return summary();
    if (method === "GET" && path === "/api/admin/export") return exportExcel(url);
    const receiptMatch = path.match(/^\/api\/admin\/receipts\/([a-f0-9-]{36})$/);
    if (method === "GET" && receiptMatch) return receipt(receiptMatch[1]);
    if (method === "POST" && path === "/api/admin/entries/bulk") {
      const body = await readJson(request, 16384);
      const ids = Array.isArray(body?.ids) ? body.ids : [];
      if (!validReview(body) || !ids.length || ids.length > 200 || !ids.every((id: unknown) => typeof id === "string" && UUID_RE.test(id))) {
        return fail(400, "검수 값이 올바르지 않아요.");
      }
      return json(200, { ok: true, changed: await review(ids, body) });
    }
    const entryMatch = path.match(/^\/api\/admin\/entries\/([a-f0-9-]{36})$/);
    if (method === "PATCH" && entryMatch) {
      const body = await readJson(request, 2048);
      if (!validReview(body)) return fail(400, "검수 값이 올바르지 않아요. 반려는 사유를 선택해야 해요.");
      return (await review([entryMatch[1]], body)) ? json(200, { ok: true }) : fail(404, "응모 건을 찾지 못했어요.");
    }
  }
  return fail(404, "페이지를 찾지 못했어요.");
}

async function handle(request: Request) {
  try { return await route(request); }
  catch (error) {
    console.error("[goldenbell]", error);
    return fail(500, "처리 중 문제가 생겼어요.");
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
