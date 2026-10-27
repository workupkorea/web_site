import { createHash } from "crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

const BUCKET       = "arrival-images";
const MAX_EDGE     = 1200; // 긴 변 최대 px
const WEBP_QUALITY = 80;

/**
 * Supabase Storage는 ASCII 외 문자(한글 등)가 든 키를 거부한다("Invalid key").
 * 안전하지 않은 문자는 "_"로 치환하고, 치환이 일어난 경우 원본명 해시를 붙여
 * 서로 다른 한글 파일명이 같은 키로 충돌(덮어쓰기)하지 않게 한다.
 */
function toStorageKey(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).replace(/[^A-Za-z0-9.]/g, "").toLowerCase() : "";
  const safeBase = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  if (safeBase === base) return `${base}${ext}`;
  const hash = createHash("sha1").update(name).digest("hex").slice(0, 8);
  return `${safeBase.replace(/^_+|_+$/g, "") || "img"}_${hash}${ext}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "파일 없음" }, { status: 400 });
    }

    const sb = createAdminClient();

    // 버킷 없으면 생성 시도
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (listErr) {
      return NextResponse.json({ error: `버킷 목록 조회 실패: ${listErr.message}` }, { status: 500 });
    }
    if (!buckets?.find(b => b.name === BUCKET)) {
      const { error: createErr } = await sb.storage.createBucket(BUCKET, { public: true });
      if (createErr) {
        return NextResponse.json({ error: `버킷 생성 실패: ${createErr.message}` }, { status: 500 });
      }
    }

    const saved: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      let filename    = toStorageKey(file.name.split("/").pop() ?? file.name);
      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      let contentType = file.type || "image/jpeg";

      // 로딩 속도를 위해 긴 변 MAX_EDGE 이하 WebP로 변환 (실패 시 원본 그대로 저장)
      try {
        buffer = await sharp(buffer)
          .rotate() // EXIF 회전 반영
          .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
        filename    = filename.replace(/\.[^.]*$/, "") + ".webp";
        contentType = "image/webp";
      } catch (e) {
        console.warn("[arrival/images] 리사이즈 실패, 원본 저장:", filename, e);
      }

      const { error } = await sb.storage
        .from(BUCKET)
        .upload(filename, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        errors.push(`${filename}: ${error.message}`);
        continue;
      }

      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(filename);
      saved.push(urlData.publicUrl);
    }

    if (errors.length > 0 && saved.length === 0) {
      return NextResponse.json({ error: errors.join(" | ") }, { status: 500 });
    }

    return NextResponse.json({ saved, count: saved.length, errors });
  } catch (err) {
    console.error("[arrival/images] route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
