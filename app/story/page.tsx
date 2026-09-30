import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getSiteSection } from "@/lib/site-settings";
import { DEFAULT_STORY, DEFAULT_STORY_STYLE, storyStyleVars, type StoryConfig } from "@/data/story";
import StoryHeroView from "@/components/StoryHeroView";
import StorySectionView from "@/components/StorySectionView";

export const metadata: Metadata = {
  title: "STORY — 브랜드 철학",
  description: "워크업이 왜 존재하는가. 일하는 사람을 위한 브랜드의 철학.",
};

// 관리자(/admin/main/story)에서 저장한 구성을 읽는다. 없으면 DEFAULT_STORY로 폴백 → 편집 전엔 기존과 동일.
export default async function StoryPage() {
  const config = await getSiteSection<StoryConfig>("story_page");
  const hero = config?.hero ?? DEFAULT_STORY.hero;
  const sections = (config?.sections?.length ? config.sections : DEFAULT_STORY.sections)
    .filter((section) => section.type !== "founding");
  const style = config?.style ?? DEFAULT_STORY_STYLE;

  return (
    <main className="bg-white" style={storyStyleVars(style) as CSSProperties}>
      <StoryHeroView hero={hero} />
      {sections.filter((s) => s.visible).map((s) => (
        <StorySectionView key={s.id} section={s} />
      ))}
    </main>
  );
}
