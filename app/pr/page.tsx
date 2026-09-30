import type { Metadata } from "next";
import Link from "next/link";
import { getPrRoom } from "@/lib/pr-room-server";
import { visiblePosts, type PrPost } from "@/lib/pr-room";

export const metadata: Metadata = {
  title: "공지사항 — 워크업 새소식",
  description:
    "워크업의 새로운 소식, 매장 오픈, 이벤트 소식을 한눈에 확인하세요. 가까운 워크업 매장에서 직접 만나보실 수 있습니다.",
  openGraph: {
    title: "공지사항 — 워크업 새소식",
    description: "워크업의 새로운 소식과 이야기를 전해드립니다.",
    type: "website",
  },
};

// 카드 클릭 동작(하이브리드): 외부 링크가 있으면 새 탭으로 이동, 없으면 사이트 내 상세 페이지.
function CardLink({ post, children }: { post: PrPost; children: React.ReactNode }) {
  if (post.link) {
    return (
      <a href={post.link} target="_blank" rel="noopener noreferrer" className="group block">
        {children}
      </a>
    );
  }
  return (
    <Link href={`/pr/${post.id}`} className="group block">
      {children}
    </Link>
  );
}

export default async function PrRoomPage() {
  const config = await getPrRoom();
  const posts = visiblePosts(config);

  return (
    <main>
      {/* ── 페이지 타이틀 (메이트·필드테스트와 동일 스타일) ── */}
      <section className="pt-16 pb-0 bg-[#FAFAF8]">
        <div className="px-[15px] md:px-[70px]">
          <h1 className="text-[32px] md:text-[42px] font-bold text-[#303236] leading-tight mb-4">
            {config.title}
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed max-w-xl">
            {config.subtitle.split("\n").map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
        </div>
      </section>

      {/* ── 게시판 ── */}
      <section className="bg-[#FAFAF8] pt-[60px] pb-16 min-h-[40vh]">
        <div className="px-[15px] md:px-[70px]">
          {posts.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-gray-400 text-sm">아직 등록된 소식이 없습니다.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
              {posts.map((post) => (
                <li key={post.id}>
                  <CardLink post={post}>
                    <article className="bg-white overflow-hidden border border-gray-200 transition-shadow group-hover:shadow-lg h-full flex flex-col">
                      {/* 이미지 — 순수 비주얼(텍스트는 아래 HTML 레이어로 처리) */}
                      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.image_url}
                          alt={post.title || "워크업 소식"}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
                        />
                        {post.link && (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-black/55 text-white text-[10px] font-medium px-2 py-1 rounded-full backdrop-blur-sm">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            바로가기
                          </span>
                        )}
                      </div>
                      {/* 텍스트 */}
                      <div className="p-5 flex flex-col flex-1">
                        {post.date && (
                          <p className="text-[11px] font-medium text-[#E5541B] tracking-wide mb-2">{post.date}</p>
                        )}
                        <h2 className="text-[15px] md:text-base font-bold text-[#303236] leading-snug line-clamp-2">
                          {post.title}
                        </h2>
                        {post.summary && (
                          <p className="mt-2 text-[13px] text-gray-500 leading-relaxed line-clamp-2">{post.summary}</p>
                        )}
                      </div>
                    </article>
                  </CardLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
