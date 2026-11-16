import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminMember } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { PRINT_BUCKET, PRINT_MAX_BYTES, UUID_RE, printOwnerKey, samePrintOrigin, validPrintObjectPath } from "@/lib/print-studio";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const unavailable = () => json({ error: "전단 저장 공간을 준비하지 못했습니다. 관리자에게 저장 공간 설정을 확인해 주세요." }, 503);
export async function GET(req: Request) {
  const member = await getAdminMember();
  if (!member) return json({ error: "로그인이 필요합니다." }, 401);
  const sb = createAdminClient(), owner = printOwnerKey(member.id), id = new URL(req.url).searchParams.get("id");
  if (id && !UUID_RE.test(id)) return json({ error: "작업 번호가 올바르지 않습니다." }, 400);
  if (id) {
    const { data, error } = await sb.from("print_studio_projects").select("*").eq("owner_key", owner).eq("id", id).maybeSingle();
    if (error) return unavailable();
    if (!data) return json({ error: "작업을 찾을 수 없습니다." }, 404);
    const { data: signed, error: signingError } = await sb.storage.from(PRINT_BUCKET).createSignedUrl(data.object_path, 120);
    if (signingError || !signed) return unavailable();
    return json({ project: data, downloadUrl: signed.signedUrl });
  }
  const { data, error } = await sb.from("print_studio_projects").select("id,title,revision,paper,width_mm,height_mm,cell_count,updated_at").eq("owner_key", owner).order("updated_at", { ascending: false }).limit(200);
  return error ? unavailable() : json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const member = await getAdminMember();
  if (!member) return json({ error: "로그인이 필요합니다." }, 401);
  if (!samePrintOrigin(req)) return json({ error: "허용되지 않은 요청입니다." }, 403);
  if (Number(req.headers.get("content-length")) > 10000) return json({ error: "요청이 너무 큽니다." }, 413);
  const body = await req.json().catch(() => null);
  if (!body || !UUID_RE.test(body.id ?? "")) return json({ error: "작업 번호가 올바르지 않습니다." }, 400);
  const sb = createAdminClient(), owner = printOwnerKey(member.id);
  const { data: current, error: readError } = await sb.from("print_studio_projects").select("revision,object_path").eq("owner_key", owner).eq("id", body.id).maybeSingle();
  if (readError) return unavailable();
  if ((current?.revision ?? null) !== (body.expectedRevision ?? null)) return json({ error: "다른 창에서 수정한 작업입니다. 내 작업을 새 이름으로 저장하거나 최신 작업을 불러오세요." }, 409);
  if (body.action === "prepare") {
    const revision = randomUUID(), path = `${owner}/${body.id}/${revision}.json`;
    const { data, error } = await sb.storage.from(PRINT_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return unavailable();
    return json({ uploadUrl: data.signedUrl, path, revision, maxBytes: PRINT_MAX_BYTES });
  }
  if (body.action !== "commit" || !validPrintObjectPath(body.path, owner, body.id) || !UUID_RE.test(body.revision ?? "") || !body.path.endsWith(`/${body.revision}.json`)) return json({ error: "저장 정보가 올바르지 않습니다." }, 400);
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200 || ![body.width, body.height].every(v => Number.isFinite(v) && v >= 80 && v <= 1000) || !Number.isInteger(body.cellCount) || body.cellCount < 1 || body.cellCount > 144) return json({ error: "작업 정보가 올바르지 않습니다." }, 400);
  const fileName = body.path.split("/").pop(), folder = `${owner}/${body.id}`;
  const { data: files, error: fileError } = await sb.storage.from(PRINT_BUCKET).list(folder, { search: fileName, limit: 5 });
  const file = files?.find(f => f.name === fileName);
  if (fileError || !file || Number(file.metadata?.size) > PRINT_MAX_BYTES) return json({ error: "업로드된 작업 파일을 확인하지 못했습니다. 다시 저장해 주세요." }, 400);
  const record = { id: body.id, owner_key: owner, title: body.title.trim(), object_path: body.path, revision: body.revision, paper: String(body.paper ?? "custom").slice(0,20), width_mm: body.width, height_mm: body.height, cell_count: body.cellCount, updated_at: new Date().toISOString() };
  const query = current
    ? sb.from("print_studio_projects").update(record).eq("id", body.id).eq("owner_key", owner).eq("revision", current.revision).select("id,revision,updated_at")
    : sb.from("print_studio_projects").insert(record).select("id,revision,updated_at");
  const { data: saved, error } = await query;
  if (error || !saved?.length) return json({ error: "저장 중 다른 창의 변경이 확인되었습니다. 새 이름으로 저장해 주세요." }, 409);
  // Old versions remain recoverable in private Storage; a failed save never overwrites a saved original.
  return json({ project: saved[0] });
}
