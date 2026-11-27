import type { Metadata } from "next";
import TshirtStudio from "@/components/studio/TshirtStudio";
import { getFooterConfig } from "@/lib/footer-server";
import { getStudioSettings } from "@/lib/studio-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "나만의 티셔츠 꾸미기 | 워크업 스튜디오",
  description: "스티커·텍스트·도형으로 나만의 워크업 티셔츠를 디자인하고, 가까운 매장에서 직접 제작 상담받아 보세요.",
  path: "/studio",
  absoluteTitle: true,
});

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
