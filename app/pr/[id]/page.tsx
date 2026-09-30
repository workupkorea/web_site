import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrRoom } from "@/lib/pr-room-server";
import { isHtmlBody } from "@/lib/pr-room";
import { getFooterConfig } from "@/lib/footer-server";
import { ikSrc } from "@/lib/imageSrc";
import NearestStoreCta from "@/components/NearestStoreCta";

// 본문(에디터 HTML) 렌더용 자식 요소 스타일 — prose 플러그인 없이 임의 변형자로 처리.
const BODY_PROSE =
  "text-[15px] text-gray-700 leading-[1.9] " +
  "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-[#303236] [&_h2]:mt-8 [&_h2]:mb-3 " +
  "[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#303236] [&_h3]:mt-6 [&_h3]:mb-2 " +
  "[&_p]:mb-4 [&_strong]:font-bold [&_b]:font-bold [&_u]:underline [&_em]:italic " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 " +
  "[&_a]:text-[#303236] [&_a]:underline [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto";

type Params = { params: Promise<{ id: string }> };

async function findPost(id: string) {
  const config = await getPrRoom();
  return config.posts.find((p) => p.id === id && p.is_visible) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const post = await findPost(id);
  if (!post) return { title: "공지사항 — WORKUP" };
  const desc = post.summary || post.body.slice(0, 120) || "워크업의 새로운 소식";
  return {
    title: `${post.title} — 공지사항`,
    description: desc,
    openGraph: {
      title: post.title,
      description: desc,
      images: post.image_url ? [{ url: post.image_url }] : undefined,
      type: "article",
    },
  };
}

export default async function PrPostDetailPage({ params }: Params) {
  const { id } = await params;
  const [post, footer] = await Promise.all([findPost(id), getFooterConfig()]);
  if (!post) notFound();

  return (
    <main className="bg-white">
      <article className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        {/* 뒤로가기 */}
        <Link href="/pr" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#303236] transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          공지사항 목록
        </Link>

        {/* 헤더 */}
        <header className="mb-7">
          {post.date && <p className="text-xs font-medium text-[#E5541B] tracking-wide mb-2">{post.date}</p>}
          <h1 className="text-2xl md:text-3xl font-bold text-[#303236] leading-snug">{post.title}</h1>
          {post.summary && <p className="mt-3 text-[15px] text-gray-500 leading-relaxed">{post.summary}</p>}
        </header>

        {/* 대표 이미지 */}
        {post.image_url && (
          <div className="mb-8 overflow-hidden rounded-lg bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ikSrc(post.image_url!, 1200)} alt={post.title} className="w-full h-auto object-contain" />
          </div>
        )}

        {/* 본문 — 에디터 HTML 은 그대로 렌더, 옛 평문은 줄바꿈 유지 */}
        {post.body && (
          isHtmlBody(post.body) ? (
            <div className={BODY_PROSE} dangerouslySetInnerHTML={{ __html: post.body }} />
          ) : (
            <div className="text-[15px] text-gray-700 leading-[1.9] whitespace-pre-line">{post.body}</div>
          )
        )}

        {/* 외부 원문 링크 (있을 경우) */}
        {post.link && (
          <a
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#303236] hover:underline"
          >
            원문·자세히 보기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}

        {/* ── 오프라인 전환 CTA (가까운 매장 전화번호 자동 표시) ── */}
        <NearestStoreCta fallbackPhone={footer.cs_phone} />
      </article>
    </main>
  );
}
