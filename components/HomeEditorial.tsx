import FeatureHeroLayout from "@/components/FeatureHeroLayout";
import { getHomeEditorials } from "@/lib/editorial-blocks";
import type { HeroFilter } from "@/lib/home-layout";

// editorialFilter: 예약 메인의 기획전 필터. 생략하면 접속 시각 기준으로 직접 계산한다.
export default async function HomeEditorial({ editorialFilter }: { editorialFilter?: HeroFilter }) {
  const items = await getHomeEditorials(editorialFilter);
  if (items.length === 0) return null;
  return (
    <section>
      {items.map(({ editorial, reversed }, i) => (
        <FeatureHeroLayout key={editorial.slug || i} editorial={editorial} reversed={reversed} headingTag="h2" />
      ))}
    </section>
  );
}
