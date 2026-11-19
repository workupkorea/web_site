import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase-server";
import {
  PARTNERSHIP_BUCKET, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, validateFileMeta, extOf,
} from "@/lib/partnership-files";

export const dynamic = "force-dynamic";

// 공개: 첨부파일 직접 업로드용 서명 URL 발급.
// Vercel 함수는 요청 본문 4.5MB 제한이 있어 파일은 브라우저 → Supabase Storage로 직접 올린다.
// 개수·확장자·용량은 여기서 검증하고, 용량은 버킷 fileSizeLimit이 한 번 더 강제한다.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const files: { name?: unknown; size?: unknown }[] = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `파일은 최대 ${MAX_FILES}개까지 첨부할 수 있습니다.` }, { status: 400 });

  let total = 0;
  for (const f of files) {
    const name = String(f.name ?? "");
    const size = Number(f.size);
    const err = validateFileMeta(name, size);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    total += size;
  }
  if (total > MAX_TOTAL_BYTES) return NextResponse.json({ error: "첨부파일 총 용량이 너무 큽니다." }, { status: 400 });

  const sb = createAdminClient();
  // 버킷이 없으면 비공개로 생성(파일당 용량 제한 포함). 이미 있으면 용량 제한만 갱신.
  const { data: buckets, error: listErr } = await sb.storage.listBuckets();
  if (listErr) return NextResponse.json({ error: "업로드 준비에 실패했습니다." }, { status: 500 });
  if (!buckets?.find((b) => b.name === PARTNERSHIP_BUCKET)) {
    const { error } = await sb.storage.createBucket(PARTNERSHIP_BUCKET, { public: false, fileSizeLimit: MAX_FILE_BYTES });
    if (error) return NextResponse.json({ error: "업로드 준비에 실패했습니다." }, { status: 500 });
  }

  // 경로: inbox/<업로드ID>/<번호>.<확장자> — 한글 파일명 키 오류를 피하려고 원본명은 메타데이터로만 보관
  const uploadId = randomUUID();
  const out: { path: string; signedUrl: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = `inbox/${uploadId}/${i + 1}.${extOf(String(files[i].name))}`;
    const { data, error } = await sb.storage.from(PARTNERSHIP_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: "업로드 준비에 실패했습니다." }, { status: 500 });
    out.push({ path, signedUrl: data.signedUrl });
  }
  return NextResponse.json({ files: out });
}
