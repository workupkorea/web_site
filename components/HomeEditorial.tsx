import FeatureHeroLayout from "@/components/FeatureHeroLayout";
import { getHomeEditorials } from "@/lib/editorial-blocks";

export default async function HomeEditorial() {
  const items = await getHomeEditorials();
  return (
    <section>
      {items.map(({ editorial, reversed }, i) => (
        <FeatureHeroLayout key={editorial.slug || i} editorial={editorial} reversed={reversed} headingTag="h2" />
      ))}
    </section>
  );
}
