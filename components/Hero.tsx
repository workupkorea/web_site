import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";
import HeroCarousel from "./HeroCarousel";
import type { HeroFilter } from "@/lib/home-layout";

type HeroSlide = {
  id: string;
  season_text: string;
  title: string;
  subtitle: string;
  btn1_text: string;
  btn1_link: string;
  btn1_visible: boolean;
  btn2_text: string;
  btn2_link: string;
  btn2_visible: boolean;
  pc_image_url: string | null;
  mobile_image_url: string | null;
  pc_video_url?: string | null;
  mobile_video_url?: string | null;
  pc_image_position?: string | null;
  mobile_image_position?: string | null;
  pc_image_scale?: number | null;
  mobile_image_scale?: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text_layers?: any[] | null;
  content_x?: number | null;
  content_y?: number | null;
  is_visible: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  image_schedules?: ImageSchedule[] | null;
  sort_order: number;
};

// 슬라이드 안에서 지정 일시에 PC/모바일 이미지를 교체하는 예약 (종료 비우면 계속 유지)
type ImageSchedule = {
  start: string | null;
  end: string | null;
  pc_image_url: string | null;
  mobile_image_url: string | null;
};

// 현재 시각이 구간 안인 예약 중 가장 늦게 시작한 것을 적용. 이미지 슬라이드에만 적용(동영상 제외).
function applyImageSchedule(s: HeroSlide, now: string): HeroSlide {
  if (s.pc_video_url || !Array.isArray(s.image_schedules)) return s;
  const active = s.image_schedules
    .filter((r) => (!r.start || r.start <= now) && (!r.end || r.end >= now) && (r.pc_image_url || r.mobile_image_url))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    .pop();
  if (!active) return s;
  return {
    ...s,
    pc_image_url: active.pc_image_url || s.pc_image_url,
    mobile_image_url: active.mobile_image_url || active.pc_image_url || s.mobile_image_url,
  };
}

// 홈페이지 최고 트래픽 구간이라 noStore() 대신 unstable_cache로 감싼다.
// 관리자 저장 시 hero-slides API 의 revalidateTag("hero_slides")로 즉시 갱신되고,
// 예약 노출(scheduled_start/end) 전환은 최대 120초 지연 내에 반영된다.
const getActiveSlides = unstable_cache(
  async (slideType: string): Promise<HeroSlide[]> => {
    try {
      const supabase = createAdminClient();
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("hero_slides")
        .select("*")
        .eq("is_visible", true)
        .eq("slide_type", slideType)
        .order("sort_order", { ascending: true });
      if (!data || data.length === 0) return [];
      return data
        .filter((s: HeroSlide) => {
          if (s.scheduled_start && s.scheduled_start > now) return false;
          if (s.scheduled_end && s.scheduled_end < now) return false;
          return true;
        })
        .map((s: HeroSlide) => applyImageSchedule(s, now));
    } catch {
      return [];
    }
  },
  ["hero-slides"],
  { tags: ["hero_slides"], revalidate: 120 }
);

// slideType: "main"(홈) | "product"(프로덕트 상단). product는 슬라이드가 없으면 아무것도 렌더하지 않음.
// heroFilter: 메인 전체 예약(캠페인) 시 노출할/제외할 슬라이드. 캐시 밖에서 거르므로 캐시 키는 그대로.
export default async function Hero({ slideType = "main", heroFilter = null }: { slideType?: string; heroFilter?: HeroFilter }) {
  let slides = await getActiveSlides(slideType);
  if (heroFilter && slideType === "main") {
    const ids = new Set(heroFilter.ids);
    slides = slides.filter((s) => (heroFilter.mode === "only" ? ids.has(s.id) : !ids.has(s.id)));
  }
  if (slides.length === 0) return slideType === "main" ? <HeroDefault /> : null;
  return <HeroCarousel slides={slides} />;
}

function HeroDefault() {
  return (
    <section className="relative bg-[#303236] overflow-hidden min-h-[520px] md:min-h-[700px] flex flex-col justify-center">
      <div className="max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="max-w-2xl">
          <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-6">
            2026 Summer Collection
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            일하는 사람이
            <br />
            제일 멋있다.
          </h1>
          <p className="text-base text-gray-300 leading-relaxed mb-10">
            워크업은 일하는 사람 편에서 만든 옷입니다.
            <br />
            현장부터 일상까지, 버티는 옷.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/products"
              className="inline-block bg-[#E5541B] text-white text-sm tracking-widest px-8 py-3 hover:bg-[#d05518] transition-colors"
            >
              컬렉션 보기
            </a>
            <a
              href="/story"
              className="inline-block border border-white text-white text-sm tracking-widest px-8 py-3 hover:bg-white hover:text-[#303236] transition-colors"
            >
              브랜드 스토리
            </a>
          </div>
        </div>
      </div>
      <div className="absolute right-0 top-0 h-full w-1/3 bg-[#152238] hidden lg:block" />
    </section>
  );
}
