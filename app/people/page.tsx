import type { Metadata } from "next";
import PeopleGrid from "@/components/PeopleGrid";
import { DEFAULT_PEOPLE, normalizePeople, type Person } from "@/data/people";
import { normalizeMateZone, type MateZoneConfig } from "@/data/mate-zone";
import { getSiteSection } from "@/lib/site-settings";

type PageHeader = { title: string; description: string };
type PageData = { header?: PageHeader; items?: Person[] };

export const metadata: Metadata = {
  title: "MATE — 일하는 사람들의 이야기",
  description: "워크업과 함께하는 사람들. 매일 현장에서 땀 흘리는 사람들의 이야기.",
};

export default async function PeoplePage() {
  const [config, mateZoneRaw] = await Promise.all([
    getSiteSection<PageData>("people_page"),
    getSiteSection<MateZoneConfig>("mate_zone"),
  ]);
  const normalized = normalizePeople(config?.items);
  const items = normalized.length ? normalized : DEFAULT_PEOPLE;
  const mateZone = normalizeMateZone(mateZoneRaw);

  return (
    <main>
      <PeopleGrid items={items} mateZone={mateZone} />
    </main>
  );
}
