import { createAdminClient } from "@/lib/supabase-server";
import { PARTNERSHIP_BUCKET, parseFiles } from "@/lib/partnership-files";

/** 문의가 삭제될 때 딸린 첨부파일도 Storage에서 지운다(실패해도 문의 삭제는 막지 않음). */
export async function removeFilesOfInquiries(
  sb: ReturnType<typeof createAdminClient>,
  rows: { payload?: unknown }[],
): Promise<void> {
  const paths = rows.flatMap((r) => parseFiles((r.payload as Record<string, unknown> | null)?._files))
    .filter((f) => !f.deleted).map((f) => f.path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await sb.storage.from(PARTNERSHIP_BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.warn("[inquiries] 첨부파일 삭제 실패:", error.message);
  }
}
