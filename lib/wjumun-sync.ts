// wjumun(본사 B2B 관리자) 가맹점 목록 동기화 — 서버 전용.
// 관리자 계정은 AES-256-GCM 으로 암호화해 site_settings(wjumun_credentials)에 저장하고,
// 복호화는 이 모듈(동기화 실행 시)에서만 한다. 화면·API 응답으로는 절대 내려주지 않는다.
//
// 흐름: 로그인 → excel.php(전체 가맹점 표) 수집 → 마지막 승인 스냅샷과 비교 → 관리자가 승인하면 반영.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBulkShip } from "./bulk-ship";

const BASE_URL = "https://wjumun.com";
const LOGIN_PATH = "/admin/index.php";
const LIST_PATH = "/admin/member/excel.php?findType=mem_name&findword=&registS=&registE=&sort1=first_regist&sort2=desc&type=10";
const FETCH_TIMEOUT_MS = 30_000;

export const CRED_SECTION = "wjumun_credentials";
export const SNAPSHOT_SECTION = "wjumun_snapshot";
export const STATUS_SECTION = "store_status";

// ── 타입 ─────────────────────────────────────────────
export type WjumunRow = {
  code: string; // 아이디 (= stores.store_code)
  name: string;
  manager: string;
  contact: string;
  shipNotice: string;
  email: string;
  address: string;
  openedAt: string;
};

export type Supplementary = Pick<WjumunRow, "manager" | "contact" | "shipNotice" | "email" | "openedAt">;
export type StatusRow = Supplementary & { storeId: number; code?: string; name?: string };
export type StoreLite = { id: number; name: string; store_code: string | null };

type Credentials = { userid: string; passwordEnc: string; updatedAt: string };
export type Snapshot = { rows: WjumunRow[]; syncedAt: string; syncedBy?: string };

const FIELD_LABEL: Record<keyof Omit<WjumunRow, "code">, string> = {
  name: "가맹점명",
  manager: "담당자",
  contact: "연락처",
  shipNotice: "출고안내번호",
  email: "이메일",
  address: "주소",
  openedAt: "오픈일",
};
const COMPARE_FIELDS = Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[];
const SUPPLEMENTARY_FIELDS: (keyof Supplementary)[] = ["manager", "contact", "shipNotice", "email", "openedAt"];

export type FieldChange = { field: string; label: string; before: string; after: string };
export type ChangeItem = {
  code: string;
  name: string;
  matched: boolean; // 우리 스토어관리에 매칭되는 지점인지
  kind: "added" | "removed" | "changed";
  bulk: "set" | "unset" | null; // 일괄출고금지 지정/해제 여부
  changes: FieldChange[];
};
export type SyncPreview = {
  mode: "first" | "diff"; // first: 스냅샷 없음 → 현재 지점 현황과 비교
  fetchedAt: string;
  hash: string;
  totals: { fetched: number; bulk: number; matched: number; unmatched: number };
  items: ChangeItem[];
};

// ── 암호화 ───────────────────────────────────────────
function getKey(): Buffer {
  const raw = process.env.WJUMUN_CRED_KEY;
  if (!raw) throw new Error("WJUMUN_CRED_KEY 환경변수가 설정되지 않았습니다.");
  return createHash("sha256").update(raw).digest(); // 길이·형식과 무관하게 32바이트 키로 정규화
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

function decryptSecret(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ── 계정 저장/조회 ───────────────────────────────────
async function readSection<T>(sb: SupabaseClient, section: string): Promise<T | null> {
  const { data, error } = await sb.from("site_settings").select("config").eq("section", section).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.config as T) ?? null;
}

async function writeSection(sb: SupabaseClient, section: string, config: unknown) {
  const { error } = await sb
    .from("site_settings")
    .upsert({ section, config, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) throw new Error(error.message);
}

export async function getCredentialInfo(sb: SupabaseClient) {
  const c = await readSection<Credentials>(sb, CRED_SECTION);
  return { userid: c?.userid ?? "", hasPassword: !!c?.passwordEnc, updatedAt: c?.updatedAt ?? null };
}

// password 를 생략하면 기존 비밀번호를 유지한다(아이디만 변경).
export async function saveCredentials(sb: SupabaseClient, userid: string, password?: string) {
  const prev = await readSection<Credentials>(sb, CRED_SECTION);
  const passwordEnc = password ? encryptSecret(password) : prev?.passwordEnc;
  if (!passwordEnc) throw new Error("비밀번호를 입력해 주세요.");
  await writeSection(sb, CRED_SECTION, { userid, passwordEnc, updatedAt: new Date().toISOString() } satisfies Credentials);
}

export async function deleteCredentials(sb: SupabaseClient) {
  await writeSection(sb, CRED_SECTION, null);
}

// ── wjumun 로그인 + 목록 수집 ────────────────────────
function mergeCookies(jar: Map<string, string>, res: Response) {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");

const cellText = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

// excel.php 는 중첩 표가 섞인 HTML 이라, <tr 단위로 잘라 셀이 있는 행만 읽는다.
export function parseWjumunTable(html: string): WjumunRow[] {
  const rows: string[][] = [];
  for (const chunk of html.split(/<tr\b/i).slice(1)) {
    const body = chunk.split(/<\/tr>/i)[0];
    const cells = [...body.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1]));
    if (cells.length > 0) rows.push(cells);
  }
  const headerIdx = rows.findIndex((r) => r.includes("아이디") && r.includes("가맹점명"));
  if (headerIdx < 0) return [];
  const header = rows[headerIdx];
  const col = (label: string) => header.indexOf(label);
  const idx = {
    code: col("아이디"),
    name: col("가맹점명"),
    manager: col("담당자"),
    contact: col("연락처"),
    shipNotice: col("출고안내번호"),
    email: col("이메일"),
    address: col("주소"),
    openedAt: col("오픈일"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
  return rows
    .slice(headerIdx + 1)
    .filter((r) => r.length === header.length && get(r, idx.code))
    .map((r) => ({
      code: get(r, idx.code),
      name: get(r, idx.name),
      manager: get(r, idx.manager),
      contact: get(r, idx.contact),
      shipNotice: get(r, idx.shipNotice),
      email: get(r, idx.email),
      address: get(r, idx.address),
      openedAt: get(r, idx.openedAt),
    }));
}

async function timedFetch(url: string, init: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
}

export async function fetchWjumunRows(sb: SupabaseClient): Promise<WjumunRow[]> {
  const cred = await readSection<Credentials>(sb, CRED_SECTION);
  if (!cred?.userid || !cred.passwordEnc) throw new Error("wjumun 관리자 계정이 저장되어 있지 않습니다.");
  const password = decryptSecret(cred.passwordEnc);

  const jar = new Map<string, string>();
  // 세션 쿠키(PHPSESSID)를 먼저 받은 뒤 로그인 폼을 전송한다.
  mergeCookies(jar, await timedFetch(`${BASE_URL}${LOGIN_PATH}`, { method: "GET" }));
  const login = await timedFetch(`${BASE_URL}${LOGIN_PATH}`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(jar) },
    body: new URLSearchParams({ a_userid: cred.userid, a_passwd: password }),
  });
  mergeCookies(jar, login);

  const res = await timedFetch(`${BASE_URL}${LIST_PATH}`, { method: "GET", headers: { Cookie: cookieHeader(jar) } });
  if (!res.ok) throw new Error(`wjumun 목록 요청 실패 (HTTP ${res.status})`);
  const rows = parseWjumunTable(await res.text());
  if (rows.length === 0) {
    throw new Error("wjumun 목록을 읽지 못했습니다. 저장된 아이디/비밀번호가 맞는지 확인해 주세요.");
  }
  return rows;
}

// ── 비교 ─────────────────────────────────────────────
function hashRows(rows: WjumunRow[]) {
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

const pickChanges = (before: Partial<WjumunRow>, after: Partial<WjumunRow>, fields = COMPARE_FIELDS): FieldChange[] =>
  fields
    .filter((f) => (before[f] ?? "") !== (after[f] ?? ""))
    .map((f) => ({ field: f, label: FIELD_LABEL[f], before: before[f] ?? "", after: after[f] ?? "" }));

function bulkTransition(before: string | undefined, after: string | undefined): "set" | "unset" | null {
  const b = isBulkShip(before);
  const a = isBulkShip(after);
  return a && !b ? "set" : !a && b ? "unset" : null;
}

type StoreMatcher = (row: { code: string; name: string }) => StoreLite | undefined;
function makeMatcher(stores: StoreLite[]): StoreMatcher {
  const byCode = new Map(stores.filter((s) => s.store_code).map((s) => [s.store_code as string, s]));
  const byName = new Map(stores.map((s) => [s.name, s]));
  return (r) => byCode.get(r.code) ?? byName.get(r.name);
}

async function loadContext(sb: SupabaseClient) {
  const [{ data: stores, error }, status, snapshot] = await Promise.all([
    sb.from("stores").select("id, name, store_code"),
    readSection<{ rows: StatusRow[]; updatedAt: string | null }>(sb, STATUS_SECTION),
    readSection<Snapshot>(sb, SNAPSHOT_SECTION),
  ]);
  if (error) throw new Error(error.message);
  return { stores: (stores ?? []) as StoreLite[], statusRows: status?.rows ?? [], snapshot };
}

export async function buildPreview(sb: SupabaseClient): Promise<SyncPreview> {
  const [fetched, ctx] = await Promise.all([fetchWjumunRows(sb), loadContext(sb)]);
  const match = makeMatcher(ctx.stores);
  const items: ChangeItem[] = [];

  if (ctx.snapshot) {
    const prev = new Map(ctx.snapshot.rows.map((r) => [r.code, r]));
    const next = new Map(fetched.map((r) => [r.code, r]));
    for (const r of fetched) {
      const p = prev.get(r.code);
      if (!p) {
        items.push({ code: r.code, name: r.name, matched: !!match(r), kind: "added", bulk: bulkTransition(undefined, r.openedAt), changes: [] });
        continue;
      }
      const changes = pickChanges(p, r);
      if (changes.length > 0) {
        items.push({ code: r.code, name: r.name, matched: !!match(r), kind: "changed", bulk: bulkTransition(p.openedAt, r.openedAt), changes });
      }
    }
    for (const p of ctx.snapshot.rows) {
      if (!next.has(p.code)) {
        items.push({ code: p.code, name: p.name, matched: !!match(p), kind: "removed", bulk: null, changes: [] });
      }
    }
  } else {
    // 첫 동기화: 이전 스냅샷이 없으므로, 지금 사이트(지점 현황)에 저장된 값과 비교한다.
    const statusById = new Map(ctx.statusRows.map((r) => [r.storeId, r]));
    for (const r of fetched) {
      const store = match(r);
      if (!store) {
        items.push({ code: r.code, name: r.name, matched: false, kind: "added", bulk: bulkTransition(undefined, r.openedAt), changes: [] });
        continue;
      }
      const cur = statusById.get(store.id);
      const changes = pickChanges(cur ?? {}, r, SUPPLEMENTARY_FIELDS);
      if (changes.length > 0) {
        items.push({ code: r.code, name: r.name, matched: true, kind: "changed", bulk: bulkTransition(cur?.openedAt, r.openedAt), changes });
      }
    }
  }

  const matchedCount = fetched.filter((r) => match(r)).length;
  return {
    mode: ctx.snapshot ? "diff" : "first",
    fetchedAt: new Date().toISOString(),
    hash: hashRows(fetched),
    totals: {
      fetched: fetched.length,
      bulk: fetched.filter((r) => isBulkShip(r.openedAt)).length,
      matched: matchedCount,
      unmatched: fetched.length - matchedCount,
    },
    items,
  };
}

// ── 반영(승인) ───────────────────────────────────────
// 미리보기 때와 데이터가 달라졌으면(그 사이 wjumun 변경) 반영하지 않고 다시 확인받는다.
export async function applySync(sb: SupabaseClient, expectedHash: string, actorName: string) {
  const [fetched, ctx] = await Promise.all([fetchWjumunRows(sb), loadContext(sb)]);
  if (hashRows(fetched) !== expectedHash) return { stale: true as const };

  const match = makeMatcher(ctx.stores);
  const byStoreId = new Map(ctx.statusRows.map((r) => [r.storeId, r]));
  let applied = 0;
  for (const r of fetched) {
    const store = match(r);
    if (!store) continue;
    byStoreId.set(store.id, {
      storeId: store.id,
      manager: r.manager,
      contact: r.contact,
      shipNotice: r.shipNotice,
      email: r.email,
      openedAt: r.openedAt,
    });
    applied++;
  }

  const now = new Date().toISOString();
  await writeSection(sb, STATUS_SECTION, { rows: [...byStoreId.values()], updatedAt: now });
  await writeSection(sb, SNAPSHOT_SECTION, { rows: fetched, syncedAt: now, syncedBy: actorName } satisfies Snapshot);
  return { stale: false as const, applied, bulk: fetched.filter((r) => isBulkShip(r.openedAt)).length, syncedAt: now, syncedBy: actorName };
}

// 변경 없음 확인 기록 — 데이터는 건드리지 않고 "누가, 언제 확인했는지"만 스냅샷에 남긴다.
// 미리보기 이후 wjumun 데이터가 바뀌었으면 기록하지 않고 다시 확인받는다.
export async function recordCheck(sb: SupabaseClient, expectedHash: string, actorName: string) {
  const [fetched, snap] = await Promise.all([fetchWjumunRows(sb), readSection<Snapshot>(sb, SNAPSHOT_SECTION)]);
  if (!snap || hashRows(fetched) !== expectedHash || hashRows(snap.rows) !== expectedHash) return { stale: true as const };
  const now = new Date().toISOString();
  await writeSection(sb, SNAPSHOT_SECTION, { ...snap, syncedAt: now, syncedBy: actorName } satisfies Snapshot);
  return { stale: false as const, syncedAt: now, syncedBy: actorName };
}

// 마지막으로 승인·반영한 동기화(누가, 언제) — 스냅샷 본문(개인정보)은 내려주지 않는다.
export async function getLastSync(sb: SupabaseClient): Promise<{ syncedAt: string | null; syncedBy: string | null }> {
  const snap = await readSection<Snapshot>(sb, SNAPSHOT_SECTION);
  return { syncedAt: snap?.syncedAt ?? null, syncedBy: snap?.syncedBy ?? null };
}

// ── 일괄출고금지점 ID 조회 (공지 & 현황·통계에서 제외할 때 사용) ──
export async function getBulkShipStoreIds(sb: SupabaseClient): Promise<Set<number>> {
  const status = await readSection<{ rows: StatusRow[] }>(sb, STATUS_SECTION).catch(() => null);
  return new Set((status?.rows ?? []).filter((r) => isBulkShip(r.openedAt)).map((r) => r.storeId));
}
