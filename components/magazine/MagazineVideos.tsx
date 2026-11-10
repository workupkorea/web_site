import type { MagazineVideoBlock } from "@/lib/home-magazine";
import { parseYouTubeUrl } from "@/lib/home-magazine";
import { Kicker } from "./parts";
import YouTubePlayer from "./YouTubePlayer";

// 유튜브 영상 구간 — 관리자가 지정한 위치(after)에 끼워진다. 영상 1개면 크게, 여러 개면 격자.
// 쇼츠(세로) 영상은 세로 비율로 좁게 보여준다.
export default function MagazineVideos({ block }: { block: MagazineVideoBlock }) {
  const videos = block.items
    .map((it, i) => ({ it, parsed: parseYouTubeUrl(it.url), i }))
    .filter((v): v is { it: typeof v.it; parsed: NonNullable<typeof v.parsed>; i: number } => !!v.parsed);
  if (videos.length === 0) return null;

  const headingId = `mag-video-${block.id}`;
  const grid = block.layout === "grid" && videos.length > 1;
  return (
    <section aria-labelledby={block.title ? headingId : undefined} className="px-5 py-10 md:px-14 md:py-16 bg-[#1d1e20] text-white">
      {(block.title || block.kicker) && (
        <div className="mb-5 md:mb-8">
          {block.kicker && <Kicker>{block.kicker}</Kicker>}
          {block.title && (
            <h2 id={headingId} className="mt-2 text-[22px] md:text-4xl font-bold break-keep">
              {block.title}
            </h2>
          )}
        </div>
      )}
      <div className={grid ? `grid gap-5 md:gap-6 items-start grid-cols-1 ${videos.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}` : "space-y-8 md:space-y-10"}>
        {videos.map(({ it, parsed }) => (
          <figure key={it.id} className={grid ? "" : parsed.vertical ? "mx-auto max-w-[340px]" : "mx-auto max-w-5xl"}>
            <YouTubePlayer id={parsed.id} vertical={parsed.vertical} title={it.title || block.title || "캠페인 영상"} />
            {(it.title || it.caption) && (
              <figcaption className="mt-3">
                {it.title && <p className="text-sm md:text-base font-bold">{it.title}</p>}
                {it.caption && <p className="text-xs md:text-[13px] text-white/65 mt-0.5">{it.caption}</p>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
