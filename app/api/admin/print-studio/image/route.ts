import { getAdminMember } from "@/lib/admin-auth";
import { validPrintImageUrl } from "@/lib/print-studio";

export const maxDuration = 30;
export async function GET(req: Request) {
  if (!(await getAdminMember())) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!validPrintImageUrl(url)) return Response.json({ error: "허용되지 않은 이미지 주소입니다." }, { status: 400 });
  try {
    const upstream = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
    const type = upstream.headers.get("content-type")?.split(";")[0] ?? "";
    if (!upstream.ok || !["image/png","image/jpeg","image/webp"].includes(type)) return Response.json({ error: "상품 사진을 가져오지 못했습니다." }, { status: 502 });
    const limit = 4 * 1024 * 1024;
    if (Number(upstream.headers.get("content-length")) > limit) { await upstream.body?.cancel(); return Response.json({ error: "사진이 너무 큽니다. 직접 사진을 넣어 주세요." }, { status: 413 }); }
    const reader = upstream.body!.getReader(), chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return Response.json({ error: "사진이 너무 큽니다." }, { status: 413 }); } chunks.push(value); }
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ error: "상품 사진 연결에 실패했습니다." }, { status: 502 }); }
}
