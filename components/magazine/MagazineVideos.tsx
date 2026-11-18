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
    <section
      aria-labelledby={block.title ? headingId : undefined}
      className={`relative overflow-hidden text-white ${block.title ? "pt-14 md:pt-24" : ""}`}
      style={{ background: "radial-gradient(ellipse at 8% 0%, rgba(229,84,27,0.20), transparent 55%), linear-gradient(180deg,#1d1e20 0%,#141517 100%)" }}
    >
      {block.title && (
        <div className="mb-8 md:mb-12 px-5 md:px-14">
          <div className="flex items-center gap-4">
            <Kicker>{block.kicker || "Film"}</Kicker>
            <span aria-hidden className="h-px flex-1 bg-white/15" />
            <span aria-hidden className="text-[10px] md:text-xs tracking-[0.3em] text-white/40">{String(videos.length).padStart(2, "0")} {videos.length > 1 ? "FILMS" : "FILM"}</span>
          </div>
          {block.title && (
            <h2 id={headingId} className="mt-4 md:mt-6 text-[26px] md:text-5xl font-black tracking-tight leading-[1.15] break-keep">
              {block.title}
            </h2>
          )}
        </div>
      )}
      <div className={grid ? `grid gap-1 md:gap-1.5 items-start grid-cols-1 ${videos.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}` : "space-y-1 md:space-y-1.5"}>
        {videos.map(({ it, parsed }, n) => (
          <figure key={it.id} className={grid ? "" : parsed.vertical ? "mx-auto max-w-[340px] px-5 py-6" : ""}>
            <YouTubePlayer
              id={parsed.id}
              vertical={parsed.vertical}
              title={it.title || block.title || "캠페인 영상"}
              heading={it.title}
              caption={it.caption}
              index={videos.length > 1 ? n + 1 : undefined}
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
