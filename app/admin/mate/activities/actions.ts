"use server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { parseRound, readMateField, type MateActionState } from "@/lib/mate";
import { mateSizeLabels, validMateProductUrl, type MateAdminActivityProduct, type MateInventoryProduct } from "@/lib/mate-activities";
import { createAdminClient } from "@/lib/supabase-server";
import { setMateActivityClosed, storeMateActivity, type MateActivityImageChange } from "@/lib/mate-activity-server";
import { saveMateComment, saveMateRating } from "@/lib/mate-rating-server";
import { MATE_COMMENT_MAX, validMateRating } from "@/lib/mate-ratings";

export async function searchMateInventory(value: string): Promise<{ items: MateInventoryProduct[]; error?: string }> {
  if (!(await isAdmin())) return { items: [], error: "관리자 로그인이 필요합니다." };
  const query = typeof value === "string" ? value.slice(0, 60).replace(/[^\p{L}\p{N}\s-]/gu, "").trim() : "";
  if (query.length < 2) return { items: [], error: "검색어를 2자 이상 입력해 주세요." };
  const { data, error } = await createAdminClient().from("arrival_products")
    .select("id,product_name,product_code,brand,cost_price,size,color,detail_url")
    .or(`product_name.ilike.%${query}%,product_code.ilike.%${query}%`)
    .order("arrival_date", { ascending: false }).limit(16);
  if (error) return { items: [], error: "입출고 리스트를 불러오지 못했습니다." };
  return { items: (data ?? []).map((item) => ({ ...item, cost_price: item.cost_price > 0 ? item.cost_price : null })) };
}
function parseOptions(value: string, sizes = false) {
  const options = sizes ? mateSizeLabels(value) : [...new Set(value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean))];
  return options.length <= 30 && options.every((entry) => entry.length <= 60) ? options : null;
}

function parseCost(value: string) {
  if (!value) return null;
  return /^\d{1,9}$/.test(value) && Number(value) <= 100_000_000 ? Number(value) : undefined;
}

function parseAdditionalProducts(value: string): MateAdminActivityProduct[] | null {
  let drafts: unknown;
  try { drafts = JSON.parse(value || "[]"); } catch { return null; }
  if (!Array.isArray(drafts) || drafts.length > 19) return null;
  const products: MateAdminActivityProduct[] = [];
  const ids = new Set<string>();
  for (const draft of drafts) {
    if (!draft || typeof draft !== "object") return null;
    const read = (key: string) => typeof draft[key] === "string" ? draft[key].trim() as string : "";
    const id = read("id");
    const name = read("name");
    const source = read("code");
    const url = read("url");
    const cost = parseCost(read("cost"));
    const sizes = parseOptions(read("sizes"), true);
    const colors = parseOptions(read("colors"));
    if (!/^[0-9a-f-]{36}$/.test(id) || ids.has(id) || !name || name.length > 120 || source.length > 100
      || (url && !validMateProductUrl(url)) || cost === undefined || !sizes || !colors) return null;
    ids.add(id);
    products.push({ id, name, source_code: source || null, unit_cost: cost, size_options: sizes, color_options: colors, product_url: url || null });
  }
  return products;
}

async function saveActivity(form: FormData, inline: boolean): Promise<MateActionState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요합니다." };
  const round = parseRound(form.get("round"));
  const activity = parseRound(form.get("activity_no"));
  const name = readMateField(form, "product_name");
  const info = readMateField(form, "product_info");
  const url = readMateField(form, "product_url");
  if (!round || !activity || !name || name.length > 120 || info.length > 2000) {
    return { error: "회차 번호와 제품 정보를 확인해 주세요." };
  }
  if (url && !validMateProductUrl(url)) return { error: "제품 링크는 http 또는 https 주소로 입력해 주세요." };

  const sizes = parseOptions(readMateField(form, "size_options"), true);
  const colors = parseOptions(readMateField(form, "color_options"));
  if (!sizes || !colors) return { error: "사이즈와 컬러는 각각 최대 30개, 항목당 60자까지 입력할 수 있습니다." };
  const source = readMateField(form, "source_code");
  const cost = parseCost(readMateField(form, "unit_cost"));
  const additional = parseAdditionalProducts(readMateField(form, "additional_products"));
  if (source.length > 100 || cost === undefined || !additional) return { error: "제품의 옵션과 원가를 확인해 주세요." };
  const encodedImage = readMateField(form, "product_image_webp");
  let image: MateActivityImageChange | undefined;
  if (encodedImage) {
    if (encodedImage.length > 880_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedImage)) {
      return { error: "이미지 크기나 형식을 확인해 주세요." };
    }
    try {
      const source = Buffer.from(encodedImage, "base64");
      if (source.toString("ascii", 0, 4) !== "RIFF" || source.toString("ascii", 8, 12) !== "WEBP") {
        return { error: "이미지 형식을 확인해 주세요." };
      }
      const output = await sharp(source, { limitInputPixels: 1280 * 1280 }).webp({ quality: 80 }).toBuffer();
      const webp = output.toString("base64");
      if (webp.length > 880_000) return { error: "이미지가 너무 큽니다. 더 작은 사진을 선택해 주세요." };
      image = { product_image_webp: webp, product_image_version: randomUUID() };
    } catch {
      return { error: "이미지를 열 수 없습니다. 다른 사진을 선택해 주세요." };
    }
  } else if (form.get("remove_product_image") === "yes") {
    image = { product_image_webp: null, product_image_version: null };
  }

  const create = form.get("mode") === "create";
  const published = form.get("published") === "yes";
  const result = await storeMateActivity({
    round, activity_no: activity, product_name: name, product_info: info, product_url: url || null,
    size_options: sizes, color_options: colors, source_code: source || null, unit_cost: cost,
    additional_products: additional, published,
  }, create, image, {
    link: form.get("product_link_edit") !== "yes",
    info: form.get("product_info_edit") !== "yes",
  });
  if (result === "duplicate") return { error: "이 기수에 이미 같은 활동 회차가 있습니다." };
  if (result !== "saved") return { error: "활동 회차를 저장하지 못했습니다." };
  revalidatePath("/admin/mate");
  revalidatePath("/admin/mate/activities");
  revalidatePath("/admin/mate/results");
  revalidatePath(`/mate/${round}`);
  const path = `/admin/mate/activities/${round}/${activity}`;
  revalidatePath(path);
  if (create) redirect(inline ? `/admin/mate?round=${round}&activity=${activity}` : path);
  return { success: published ? "저장했습니다. 이 회차가 선정 메이트에게 공개되었습니다." : "비공개 상태로 저장했습니다." };
}
export async function saveMateActivity(_: MateActionState, form: FormData): Promise<MateActionState> {
  return saveActivity(form, false);
}

export async function saveInlineMateActivity(_: MateActionState, form: FormData): Promise<MateActionState> {
  return saveActivity(form, true);
}

export async function changeMateActivityClosure(_: MateActionState, form: FormData): Promise<MateActionState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요합니다." };
  const round = parseRound(form.get("round"));
  const activity = parseRound(form.get("activity_no"));
  const mode = form.get("mode");
  if (!round || !activity || (mode !== "close" && mode !== "open")) return { error: "활동 회차를 확인해 주세요." };
  if (!(await setMateActivityClosed(round, activity, mode === "close"))) return { error: "회차 상태를 저장하지 못했습니다." };
  revalidatePath("/admin/mate");
  revalidatePath("/admin/mate/overview");
  revalidatePath(`/admin/mate/activities/${round}/${activity}`);
  return { success: mode === "close" ? "회차를 종료했습니다." : "접수 마감을 해제했습니다." };
}

function validResultTarget(round: number, activity: number, applicationId: string) {
  return Boolean(parseRound(String(round)) && parseRound(String(activity))) && typeof applicationId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(applicationId);
}

function revalidateMateResults() {
  revalidatePath("/admin/mate");
  revalidatePath("/admin/mate/results");
  revalidatePath("/admin/mate/activities/[round]/[activity]", "page");
}

export async function commentMateResult(round: number, activity: number, applicationId: string, comment: string): Promise<MateActionState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요합니다." };
  if (!validResultTarget(round, activity, applicationId) || typeof comment !== "string") return { error: "코멘트 정보를 확인해 주세요." };
  const text = comment.replace(/\r\n/g, "\n").trim();
  if (text.length > MATE_COMMENT_MAX) return { error: `코멘트는 ${MATE_COMMENT_MAX}자까지 입력할 수 있습니다.` };
  if (!(await saveMateComment(round, activity, applicationId, text))) return { error: "코멘트를 저장하지 못했습니다." };
  revalidateMateResults();
  return { success: "코멘트를 저장했습니다." };
}

export async function rateMateResult(round: number, activity: number, applicationId: string, score: number | null): Promise<MateActionState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요합니다." };
  if (!validResultTarget(round, activity, applicationId) || !validMateRating(score)) {
    return { error: "평가결과 정보를 확인해 주세요." };
  }
  if (!(await saveMateRating(round, activity, applicationId, score))) return { error: "평가결과를 저장하지 못했습니다." };
  revalidateMateResults();
  return { success: "평가결과를 저장했습니다." };
}
