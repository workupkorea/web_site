// 워크업 유튜브 롱폼 섹션 — 채널 "동영상" 탭(쇼츠 제외)을 서버에서 읽어 최신 롱폼을 노출한다.
// 공식 API 키 없이 동작하도록 채널 페이지의 초기 데이터(ytInitialData)를 파싱하며,
// 6시간 캐시 + 마지막 성공값 보관으로 호출량과 장애 영향을 최소화한다.
// 파싱에 실패하면(유튜브 구조 변경 등) 섹션 전체를 숨겨 빈 영역이 보이지 않게 한다.
import YoutubeLongformCard from "./YoutubeLongformCard";

const CHANNEL_HANDLE = "WorkUp_official";
const CHANNEL_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}`;
const MAX_VIDEOS = 3;

const YoutubeGlyph = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
  </svg>
);

export type YoutubeVideo = { id: string; title: string };

let lastGoodVideos: YoutubeVideo[] | null = null;

async function getVideos(): Promise<YoutubeVideo[]> {
  try {
    const res = await fetch(`${CHANNEL_URL}/videos`, {
      headers: {
        "Accept-Language": "ko-KR,ko;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; WorkupSite/1.0)",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
      next: { revalidate: 21600 },
    });
    if (!res.ok) return lastGoodVideos ?? [];
    const html = await res.text();

    // 영상 카드(lockupViewModel) 단위로 잘라 ID·제목을 뽑는다. 동영상 탭이므로 쇼츠는 섞이지 않는다.
    const videos: YoutubeVideo[] = [];
    for (const chunk of html.split('"lockupViewModel":').slice(1)) {
      if (!chunk.includes("LOCKUP_CONTENT_TYPE_VIDEO")) continue;
      const id = chunk.match(/"contentId":"([\w-]{11})"/)?.[1];
      const rawTitle = chunk.match(/"title":\{"content":"((?:[^"\\]|\\.)*)"/)?.[1];
      if (!id || !rawTitle || videos.some((v) => v.id === id)) continue;
      let title = rawTitle;
      try {
        title = JSON.parse(`"${rawTitle}"`);
      } catch {}
      videos.push({ id, title });
      if (videos.length >= MAX_VIDEOS) break;
    }
    if (videos.length > 0) lastGoodVideos = videos;
    return videos.length > 0 ? videos : lastGoodVideos ?? [];
  } catch {
    return lastGoodVideos ?? [];
  }
}

export default async function HomeYoutubeLongform() {
  const videos = await getVideos();
  if (videos.length === 0) return null;
  // 모바일 하단 바로가기는 1개일 때 숨긴다(안내 패널의 "채널 구독하기"가 그 역할).
  const multiple = videos.length > 1;

  return (
    <section className="bg-white py-14 border-t border-gray-100">
      <div className="px-[15px] md:px-[70px]">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-2">YouTube</p>
            <h2 className="text-2xl font-bold text-[#303236]">@{CHANNEL_HANDLE}</h2>
          </div>
          {/* PC 전용 바로가기 — 인스타그램 섹션과 같은 위치·스타일 */}
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-[#303236] tracking-wide transition-colors hidden sm:flex items-center gap-1"
          >
            <YoutubeGlyph className="w-4 h-4" />
            유튜브 바로가기 →
          </a>
        </div>

        {/* 1개면 영상 + 안내 패널(PC 2단), 여러 개면 3열 그리드 */}
        {videos.length === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-[1.7fr_1fr] gap-4 md:gap-0 items-stretch">
            <YoutubeLongformCard id={videos[0].id} title={videos[0].title} showTitle={false} />
            <div className="flex flex-col justify-center bg-[#F5F5F3] px-6 py-6 md:px-10">
              <p className="text-xs tracking-widest text-[#E5541B] uppercase mb-3">Latest</p>
              <h3 className="text-lg md:text-2xl font-bold text-[#303236] leading-snug">
                {videos[0].title}
              </h3>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                영상 속 제품, 매장에서 직접 입어보고 비교해보세요.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href="/store"
                  className="inline-flex items-center justify-center min-h-[44px] px-6 bg-[#303236] text-white text-xs tracking-widest"
                >
                  가까운 매장 찾기
                </a>
                <a
                  href={CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-[44px] px-6 border border-[#303236] text-[#303236] text-xs tracking-widest"
                >
                  채널 구독하기
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {videos.map((v) => (
              <YoutubeLongformCard key={v.id} id={v.id} title={v.title} />
            ))}
          </div>
        )}

        {multiple && (
        <div className="mt-8 text-center sm:hidden">
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center border border-[#303236] text-[#303236] text-xs tracking-widest px-8 py-3 min-h-[44px]"
          >
            유튜브 채널 바로가기 →
          </a>
        </div>
        )}
      </div>
    </section>
  );
}
