import type { Metadata } from "next";
import Link from "next/link";
import { getPrRoom } from "@/lib/pr-room-server";
import { visiblePosts, PR_CATEGORIES, prCategoryLabel, type PrPost, type PrCategory } from "@/lib/pr-room";

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

export default async function PrRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const config = await getPrRoom();
  const allPosts = visiblePosts(config);
  const countOf = (c: PrCategory) => allPosts.filter((p) => p.category === c).length;
  // 탭 순서는 보도자료 → 공지사항. 주소에 탭이 없으면 첫 탭(보도자료)을 열되,
  // 보도자료가 아직 없으면 빈 화면 대신 공지사항을 보여준다.
  const requested = PR_CATEGORIES.find((c) => c.value === tab)?.value;
  const activeTab: PrCategory = requested ?? (countOf("press") > 0 ? "press" : "notice");
  const posts = allPosts.filter((p) => p.category === activeTab);

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

      {/* ── 분류 탭 (공지사항 · 보도자료) — 링크 기반이라 JS 없이 동작하고 URL로 공유 가능 ── */}
      <section className="bg-[#FAFAF8] pt-10">
        <div className="px-[15px] md:px-[70px]">
          <nav aria-label="게시판 분류" className="flex border-b border-gray-200">
            {PR_CATEGORIES.map((c) => {
              const active = c.value === activeTab;
              return (
                <Link
                  key={c.value}
                  href={`/pr?tab=${c.value}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex items-center gap-1.5 min-h-[44px] px-5 md:px-7 text-[15px] font-semibold transition-colors ${
                    active ? "text-[#303236]" : "text-gray-400 hover:text-[#303236]"
                  }`}
                >
                  {c.label}
                  <span className={`text-[11px] font-medium ${active ? "text-[#E5541B]" : "text-gray-300"}`}>{countOf(c.value)}</span>
                  {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#303236]" />}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      {/* ── 게시판 ── */}
      <section className="bg-[#FAFAF8] pt-8 md:pt-10 pb-16 min-h-[40vh]">
        <div className="px-[15px] md:px-[70px]">
          {posts.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-gray-400 text-sm">아직 등록된 {prCategoryLabel(activeTab)}이(가) 없습니다.</p>
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
                          // 흰 알약 + 진한 원형 화살표 — 밝은·어두운 사진 모두에서 또렷하고 단정하게
                          <span className="absolute top-3 right-3 inline-flex items-center gap-2 bg-white text-[#303236] text-[12px] font-semibold tracking-tight pl-3.5 pr-1.5 py-1.5 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
                            바로가기
                            <span className="grid place-items-center w-6 h-6 rounded-full bg-[#303236] text-white transition-colors group-hover:bg-[#E5541B]">
                              <svg className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                              </svg>
                            </span>
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
