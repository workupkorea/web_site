import type { Metadata } from "next";
import TshirtStudio from "@/components/studio/TshirtStudio";
import { getFooterConfig } from "@/lib/footer-server";
import { getStudioSettings } from "@/lib/studio-server";

export const metadata: Metadata = {
  // 레이아웃 템플릿("%s | WORKUP")을 거치면 WORKUP이 중복되므로 절대 제목 사용
  title: { absolute: "나만의 티셔츠 꾸미기 | WORKUP 스튜디오" },
  description:
    "스티커·텍스트·도형으로 나만의 워크업 티셔츠를 디자인하고, 가까운 매장에서 직접 제작 상담받아 보세요.",
  openGraph: {
    title: "나만의 티셔츠 꾸미기 | WORKUP 스튜디오",
    description: "나만의 워크업 티셔츠를 만들고 매장에서 제작 상담받아 보세요.",
    type: "website",
  },
};

export default async function StudioPage() {
  const [footer, studio] = await Promise.all([getFooterConfig(), getStudioSettings()]);
  return (
    <TshirtStudio
      kakaoUrl={footer.kakao_url}
      heading={studio.heading}
      subheading={studio.subheading}
      shirtImageUrl={studio.shirtImageUrl}
      defaultColor={studio.defaultColor}
      enabledColors={studio.enabledColors}
      designs={studio.designs}
    />
  );
}
