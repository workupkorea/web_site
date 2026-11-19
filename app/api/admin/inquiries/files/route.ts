import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-server";
import { PARTNERSHIP_BUCKET, RETENTION_MONTHS, parseFiles } from "@/lib/partnership-files";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StoredObj = { path: string; size: number; created: Date };

// 저장소의 전체 첨부파일 목록(문의 미접수 상태로 남은 고아 파일 포함).
async function listAll(sb: ReturnType<typeof createAdminClient>): Promise<StoredObj[]> {
  const out: StoredObj[] = [];
  const bucket = sb.storage.from(PARTNERSHIP_BUCKET);
  for (let off = 0; off < 100000; off += 1000) {
    const { data: folders, error } = await bucket.list("inbox", { limit: 1000, offset: off });
    if (error || !folders?.length) break;
    for (const folder of folders) {
      const { data: objs } = await bucket.list(`inbox/${folder.name}`, { limit: 100 });
      for (const o of objs ?? []) {
        const created = new Date(o.created_at ?? o.updated_at ?? Date.now());
        out.push({ path: `inbox/${folder.name}/${o.name}`, size: Number((o.metadata as { size?: number } | null)?.size ?? 0), created });
      }
    }
    if (folders.length < 1000) break;
  }
  return out;
}

// 보관 기간(6개월)이 지난 파일만
async function listExpired(sb: ReturnType<typeof createAdminClient>, cutoff: Date): Promise<StoredObj[]> {
  return (await listAll(sb)).filter((f) => f.created < cutoff);
}

function cutoffDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - RETENTION_MONTHS);
  return d;
}

// GET ?path=… → 첨부파일 내려받기(60초짜리 서명 URL로 이동). GET ?preview=1 → 삭제 대상 건수·용량 미리보기.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const sb = createAdminClient();

  // 누적 용량 + 삭제 대상(6개월 경과) 집계
  if (searchParams.get("preview")) {
    const cutoff = cutoffDate();
    const all = await listAll(sb);
    const expired = all.filter((f) => f.created < cutoff);
    const sum = (l: StoredObj[]) => l.reduce((s, f) => s + f.size, 0);
    return NextResponse.json({ count: expired.length, bytes: sum(expired), totalCount: all.length, totalBytes: sum(all) });
  }

  const path = searchParams.get("path") ?? "";
  const name = searchParams.get("name") ?? "";
  if (!/^inbox\/[0-9a-f-]{36}\/\d+\.[a-z0-9]+$/.test(path)) return NextResponse.json({ error: "잘못된 경로입니다." }, { status: 400 });
  const { data, error } = await sb.storage.from(PARTNERSHIP_BUCKET).createSignedUrl(path, 60, { download: name || true });
  if (error || !data) return NextResponse.json({ error: "파일을 찾을 수 없습니다. (보관 기간이 지나 삭제됐을 수 있습니다)" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}

// POST → 6개월 지난 첨부파일 일괄 삭제. 문의 본문은 그대로 두고 첨부 표시만 '삭제됨'으로 바꾼다.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const cutoff = cutoffDate();
  const expired = await listExpired(sb, cutoff);

  const CHUNK = 100;
  let deleted = 0;
  const removed = new Set<string>();
  for (let i = 0; i < expired.length; i += CHUNK) {
    const part = expired.slice(i, i + CHUNK).map((f) => f.path);
    const { error } = await sb.storage.from(PARTNERSHIP_BUCKET).remove(part);
    if (error) return NextResponse.json({ error: error.message, deleted }, { status: 500 });
    part.forEach((p) => removed.add(p));
    deleted += part.length;
  }

  // 문의 payload의 첨부 기록을 '삭제됨'으로 표시(파일명은 남겨 어떤 파일이 있었는지 확인 가능)
  if (removed.size) {
    for (let from = 0; from < 100000; from += 1000) {
      const { data: rows } = await sb.from("inquiries").select("id, payload").lt("created_at", new Date().toISOString())
        .order("created_at", { ascending: true }).range(from, from + 999);
      if (!rows?.length) break;
      for (const r of rows) {
        const payload = (r.payload ?? {}) as Record<string, unknown>;
        const files = parseFiles(payload._files);
        if (!files.some((f) => removed.has(f.path) && !f.deleted)) continue;
        const next = files.map((f) => (removed.has(f.path) ? { ...f, deleted: true } : f));
        await sb.from("inquiries").update({ payload: { ...payload, _files: JSON.stringify(next) } }).eq("id", r.id);
      }
      if (rows.length < 1000) break;
    }
  }

  await logAudit({
    action: "delete",
    resource: "inquiries",
    resourceLabel: "문의 첨부파일",
    summary: `${RETENTION_MONTHS}개월 경과 첨부파일 ${deleted}개 삭제`,
  });
  return NextResponse.json({ ok: true, deleted });
}
