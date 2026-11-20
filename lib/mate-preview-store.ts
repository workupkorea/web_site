import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { seoulDate, type MateApplication, type MateRound } from "./mate";
import type { MateActivity, MateResponse } from "./mate-activities";

const file = join(process.cwd(), "generated", "mate-preview.json");

type Preview = {
  rounds: MateRound[];
  applications: MateApplication[];
  activities: (MateActivity & { product_image_webp?: string | null })[];
  responses: MateResponse[];
  activityDemoVersion: 2;
};

function dateAfter(today: string, days: number) {
  const date = new Date(today + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultRound(): MateRound {
  const today = seoulDate();
  return {
    round: 3,
    activity_period: "2026FW 시즌부터 2027SS 시즌까지",
    starts_on: today,
    ends_on: dateAfter(today, 30),
    announces_on: dateAfter(today, 37),
    retain_through: dateAfter(today, 90),
    outdoor_quota: null,
    work_quota: null,
    lifestyle_quota: null,
    published: true,
  };
}

const demoProfiles = [
  ["김하준", "서울특별시 마포구 가상솔길 24, 302호", 178, "male", "outdoor", "주말 등산에서 재킷의 활동성과 수납력을 확인해 실제 착용 후기를 남기고 싶습니다."],
  ["박서윤", "경기도 수원시 영통구 가상별길 17, 805호", 164, "female", "work", "작업 현장과 일상에서 입을 수 있는 조합을 찾아 짧은 영상으로 소개하겠습니다."],
  ["이도현", "인천광역시 연수구 가상파도길 38, 1204호", 182, "male", "lifestyle", "출퇴근과 주말 나들이에 같은 제품을 활용한 일주일 코디를 기록하고 싶습니다."],
  ["최지우", "부산광역시 수영구 가상바다길 52, 501호", 167, "female", "outdoor", "바닷가 산책과 자전거 라이딩에서 느낀 착용감을 사진과 영상으로 담겠습니다."],
  ["정우진", "충청남도 천안시 서북구 가상참길 63, 202호", 175, "male", "work", "목공 작업에서 움직임과 주머니 배치를 비교해 실용성을 구체적으로 설명하겠습니다."],
  ["한소민", "대구광역시 수성구 가상숲길 19, 703호", 161, "female", "lifestyle", "평소 즐겨 입는 옷과 함께 코디해 체형별 핏과 레이어링 방법을 보여주고 싶습니다."],
  ["윤건우", "대전광역시 유성구 가상빛길 41, 106동 1102호", 184, "male", "outdoor", "가벼운 캠핑과 야외 이동 중에 제품을 사용해 보고 장단점이 드러나는 리뷰를 만들겠습니다."],
  ["강다은", "광주광역시 북구 가상들길 28, 204호", 169, "female", "work", "소품 제작과 촬영을 하는 하루 동안 작업복을 착용하고 편의성을 기록하겠습니다."],
  ["서준혁", "강원특별자치도 춘천시 가상호수길 76, 101호", 173, "male", "lifestyle", "도심과 교외를 오가는 하루를 브이로그로 담아 다양한 상황에서의 코디를 제안하겠습니다."],
  ["오유나", "제주특별자치도 제주시 가상오름길 35, 402호", 165, "female", "outdoor", "바람이 부는 산책길에서 어떤 옷과 겹쳐 입기 좋은지 사진과 후기 콘텐츠로 보여드리겠습니다."],
] as const;

export function readMatePreview(): Preview {
  let stored: Pick<Preview, "rounds" | "applications"> & Partial<Preview>;
  try {
    stored = JSON.parse(readFileSync(file, "utf8")) as typeof stored;
    if (stored.activityDemoVersion === 2) return stored as Preview;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    stored = { rounds: [defaultRound()], applications: [] };
  }

  const round = stored.rounds.find((entry) => entry.round === 3);
  const preview: Preview = { ...stored, activities: stored.activities ?? [], responses: stored.responses ?? [], activityDemoVersion: 2 };
  if (round) {
    const submitTime = Date.now();
    const demo = demoProfiles.map(([name, address, height, gender, style, message], index): MateApplication => {
      const snsId = `mate.demo.${String(index + 1).padStart(2, "0")}`;
      const previous = stored.applications.find((item) => item.round === 3 && item.sns_id === snsId);
      return {
        id: previous?.id ?? randomUUID(),
        round: 3,
        sns_id: snsId,
        feed_styles: [style],
        name,
        gender,
        phone: `010000010${String(index + 1).padStart(2, "0")}`,
        address,
        height_cm: height,
        message,
        status: previous?.status ?? "selected",
        submitted_at: previous?.submitted_at ?? new Date(submitTime - index * 60000).toISOString(),
        retain_through: previous?.retain_through ?? round.retain_through ?? dateAfter(seoulDate(), 90),
      };
    });
    const demoIds = new Set(demo.map((item) => item.id));
    preview.applications = [...stored.applications.filter((item) => !demoIds.has(item.id)
      && (item.round !== 3 || item.sns_id !== "mate.demo" || item.name !== "예시 지원자")), ...demo];
    if (!preview.activities.some((item) => item.round === 3 && item.activity_no === 1)) {
      preview.activities.push({
        round: 3, activity_no: 1, product_name: "워크업 유틸리티 재킷 (예시)",
        product_info: "현장과 일상에서 활용할 수 있는 가상의 워크 재킷입니다. 착용 후 핏·수납·움직임을 경험하고, 채널에 맞는 스타일링 콘텐츠를 제작하는 회차입니다.",
        product_url: null, published: true,
      });
    }
    for (const [index, application] of demo.entries()) {
      if (preview.responses.some((item) => item.round === 3 && item.activity_no === 1 && item.application_id === application.id)) continue;
      const size = ["L", "S", "XL", "M", null, null, "XL", "M", null, "S"][index];
      preview.responses.push({ round: 3, activity_no: 1, application_id: application.id, choice: size ? "yes" : "no",
        size, updated_at: new Date().toISOString() });
    }
  }

  writeMatePreview(preview);
  return preview;
}

// The local server uses synchronous reads and atomic replacement for mutations.
export function writeMatePreview(preview: Preview) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    writeFileSync(temporary, JSON.stringify(preview, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}