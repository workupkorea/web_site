import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-server";
import { currentWeek } from "./preview-draw";
import type { Outcome, PreviewEntry, PreviewReviewRow, PreviewReviewStatus } from "./preview-draw";

const TABLE = "goldenbell_v2_preview_entries";
const PAGE_SIZE = 1000;

export async function previewSoldOut() {
  const { count, error } = await createAdminClient().from(TABLE).select("id", { count: "exact", head: true })
    .eq("week_start", currentWeek()).eq("outcome", "won");
  if (error) throw error;
  return (count ?? 0) >= 200;
}

export async function drawPreview(id: string, entry: PreviewEntry): Promise<Outcome> {
  const { data, error } = await createAdminClient().rpc("goldenbell_v2_preview_draw", {
    p_id: id, p_name: entry.name, p_phone: entry.phone, p_store: entry.store, p_mime: entry.mime,
    p_photo_base64: Buffer.from(entry.photo).toString("base64"),
    p_photo_hash: createHash("sha256").update(entry.photo).digest("hex"),
  });
  if (error) throw error;
  if (data === "won" || data === "lost" || data === "sold-out" || data === "already-entered") return data;
  throw new Error("Internal Golden Bell draw returned an unexpected result");
}

export async function listPreviewEntries() {
  const client = createAdminClient();
  const results: PreviewReviewRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from(TABLE)
      .select("id,name,phone,store,created_at,outcome,status,photo_hash,reject_reason")
      .order("created_at", { ascending: false }).order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    results.push(...data as PreviewReviewRow[]);
    if (data.length < PAGE_SIZE) return results;
  }
}

export async function readPreviewReceipt(id: string) {
  const { data, error } = await createAdminClient().from(TABLE).select("mime,photo").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return { mime: data.mime, photo: Buffer.from(data.photo.slice(2), "hex") };
}

export async function updatePreviewReview(ids: string[], status: PreviewReviewStatus, reason: string | null) {
  const { data, error } = await createAdminClient().from(TABLE)
    .update({ status, reject_reason: reason }).in("id", ids).select("id");
  if (error) throw error;
  return data.length;
}
