// 직원 테스트 영역에 넣는 가짜 응모. 테스트 이벤트 id(<id>:test)에만 사용한다.
import { createHash, randomInt, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import { isTestId } from "@/app/admin/promotions/entries/events";
import { createAdminClient } from "@/lib/supabase-server";

const PEOPLE = 300; // 커피 1주차 정원(200명)을 넘겨 추첨을 확인할 수 있는 인원
const EXCLUDED = [1, 2, 150, 151, 152];
const REASONS = ["영수증 불명확", "기간 외 구매", "중복 응모", "매장 정보 불일치", "기타"];
const DAY_MS = 24 * 60 * 60 * 1000;
const SPREAD_DAYS = 14;
const INSERT_CHUNK = 200;
const BUCKET = "goldenbell-receipts";
const phone = (person: number) => `0100000${String(person).padStart(4, "0")}`;

/** 글자 없는 영수증 모양의 회색조 PNG. variant 마다 줄 길이가 다르다. */
export function sampleReceipt(variant: number) {
  const width = 240, height = 360;
  const pixels = Buffer.alloc((width + 1) * height); // 각 줄의 첫 바이트는 필터 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const paper = x >= 30 && x < 210 && y >= 20 && y < 340;
      const line = y >= 45 && y < 270 && y % 17 < 5 && x >= 45 && x < 105 + ((Math.floor(y / 17) * variant * 37) % 90);
      const barcode = y >= 290 && y < 320 && x >= 55 && x < 185 && (x * variant) % 7 < 3;
      pixels[y * (width + 1) + 1 + x] = !paper ? 150 : line || barcode ? 60 : 245;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8비트 회색조
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

/** 테스트 영역이 비어 있으면 가짜 데이터를 넣는다. 넣은 응모 수를 돌려준다. */
export async function seedTestData(testId: string, now = Date.now()) {
  if (!isTestId(testId)) throw new Error("Seed data is allowed only in a test event");
  const sb = createAdminClient();
  const existing = await sb.from("goldenbell_entries").select("id").eq("event_id", testId).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data.length) return 0;
  const stores = await sb.from("stores").select("name").eq("is_active", true).limit(14);
  if (stores.error) throw stores.error;
  if (!stores.data.length) throw new Error("No active store for seed data");

  const photos: string[] = [];
  for (let variant = 1; variant <= 3; variant++) {
    const path = `test/${testId.replace(":", "-")}-sample-${variant}.png`;
    const { error } = await sb.storage.from(BUCKET).upload(path, sampleReceipt(variant), { contentType: "image/png", upsert: true });
    if (error) throw error;
    photos.push(path);
  }

  const rows = [];
  for (let person = 1; person <= PEOPLE; person++) {
    const count = person <= 20 ? 5 : person <= 100 ? 2 : 1;
    for (let n = 0; n < count; n++) {
      // 하루 1회 규칙: 같은 번호는 서로 다른 날짜에, 같은 시각 기준으로 넣는다.
      const daysAgo = 1 + ((person + n * 2) % SPREAD_DAYS);
      const created = new Date(now - daysAgo * DAY_MS).toISOString();
      const roll = randomInt(100);
      const status = roll < 82 ? "approved" : roll < 92 ? "pending" : "rejected";
      const id = randomUUID();
      rows.push({
        id, event_id: testId, phone: phone(person), name: `테스트${String(person).padStart(3, "0")}`,
        store: stores.data[randomInt(stores.data.length)].name as string, photo_path: photos[randomInt(photos.length)],
        photo_hash: createHash("sha256").update(id).digest("hex"), status,
        reject_reason: status === "rejected" ? REASONS[randomInt(REASONS.length)] : null, created_at: created, consent_at: created,
      });
    }
  }
  // 중복 의심 확인용: 서로 다른 번호 5쌍이 같은 사진
  for (let i = 0; i < 5; i++) rows[rows.length - 1 - i].photo_hash = rows[rows.length - 11 - i].photo_hash;

  for (let from = 0; from < rows.length; from += INSERT_CHUNK) {
    const { error } = await sb.from("goldenbell_entries").insert(rows.slice(from, from + INSERT_CHUNK));
    if (error) throw error;
  }
  const { error } = await sb.from("goldenbell_excluded_phones").upsert(
    EXCLUDED.map((person) => ({ event_id: testId, phone: phone(person), memo: "테스트 제외" })), { onConflict: "event_id,phone" });
  if (error) throw error;
  return rows.length;
}
