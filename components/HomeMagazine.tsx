import { Fragment, type ReactNode } from "react";
import { isDividerKey, isMagazinePublishable, isSectionEnabled, magazineBgFor, type HomeMagazineConfig, type MagazineBgKey, type MagazineSectionKey } from "@/lib/home-magazine";
import MagazineCover from "./magazine/MagazineCover";
import MagazineInterview from "./magazine/MagazineInterview";
import MagazineChapter from "./magazine/MagazineChapter";
import MagazineBehind from "./magazine/MagazineBehind";
import MagazineWearing from "./magazine/MagazineWearing";
import MagazineClosing from "./magazine/MagazineClosing";
import MagazineVideos from "./magazine/MagazineVideos";
import MagazineContents from "./magazine/MagazineContents";
import MagazineDivider from "./magazine/MagazineDivider";
import MagazineChapterTabs from "./magazine/MagazineChapterTabs";
import { ChapterProvider } from "./magazine/ChapterContext";

// 메인 캠페인 매거진 섹션(관리자 "메인 배치"의 magazine 키). 배우 계약 기간 한정 노출.
// 데이터는 app/page.tsx 에서 한 번 읽어 넘겨받는다(매장검색바 위치 계산에도 같이 쓰기 때문).
// 공개 OFF 또는 커버 미입력이면 아무것도 렌더하지 않는다 → 기존 메인 그대로.
// afterCover: 커버 바로 아래 끼울 요소(매장 검색바) — 첫 화면 다음에 매장 찾기가 오도록.
// 하위 구간은 각자 내용이 비어 있으면 스스로 렌더하지 않는다.
export default function HomeMagazine({
  config,
  afterCover,
}: {
  config: HomeMagazineConfig;
  afterCover?: ReactNode;
}) {
  if (!isMagazinePublishable(config)) return null;

  // 커버 다음 구간들 — 관리자가 정한 순서(sectionOrder)대로 렌더하고, 노출을 끈 구간은 건너뛴다(isSectionEnabled).
  // 유튜브 영상 구간(videos)은 영상 블록 전체가 정해진 자리에 한꺼번에 나온다.
  const blocks: Record<MagazineSectionKey, ReactNode> = {
    interview: <MagazineInterview interview={config.interview} />,
    chapters: (
      <MagazineChapterTabs
        chapters={config.chapters.map((chapter, i) => ({
          id: chapter.id,
          no: i + 1,
          title: chapter.title,
          node: <MagazineChapter chapter={chapter} no={i + 1} tight={config.chapterView === "tabs" && config.chapters.length > 1} />,
        }))}
      />
    ),
    videos: (
      <div id="mag-videos" className="scroll-mt-24">
        {config.videos.map((b) => (
          <MagazineVideos key={b.id} block={b} />
        ))}
      </div>
    ),
    behind: <MagazineBehind title={config.behind.title} images={config.behind.images} />,
    wearing: <MagazineWearing wearing={config.wearing} chapters={config.chapters.map((c, i) => ({ id: c.id, no: i + 1, title: c.title }))} />,
    closing: <MagazineClosing closing={config.closing} />,
  };

  // 구간 배경색 지정 시: 바깥 래퍼에 색을 깔고, 안쪽 구간들의 기본 배경은 투명 처리한다(.mag-custom-bg)
  const withBg = (key: MagazineBgKey, node: ReactNode) => {
    const bg = magazineBgFor(config, key);
    return bg ? (
      <div className="mag-custom-bg" style={{ backgroundColor: bg }}>
        {node}
      </div>
    ) : (
      node
    );
  };

  return (
    <ChapterProvider ids={config.chapters.map((c) => c.id)} tabs={config.chapterView === "tabs"}>
    <div className="bg-[#f6f4ef] text-[#1d1e20]">
      {config.topBanner === "magazine" && (
        <>
          <MagazineCover issue={config.issue} cover={config.cover} />
          {afterCover}
        </>
      )}
      {withBg("contents", <MagazineContents config={config} />)}
      <div id="magazine-content" className="scroll-mt-16 mag-sans">
        {config.sectionOrder
          .filter((key) => isSectionEnabled(config, key))
          .map((key) => (
            <Fragment key={key}>
              {isDividerKey(key) ? (
                (() => {
                  const d = config.dividers.find((x) => x.id === key.slice(8));
                  return d ? <MagazineDivider divider={d} /> : null;
                })()
              ) : (
                withBg(key, blocks[key])
              )}
            </Fragment>
          ))}
      </div>
    </div>
    </ChapterProvider>
  );
}
