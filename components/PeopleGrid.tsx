"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { DEFAULT_PEOPLE, type Person } from "@/data/people";
import MateZone from "@/components/MateZone";
import type { MateZoneConfig } from "@/data/mate-zone";
import { ikSrc } from "@/lib/imageSrc";

export default function PeopleGrid({ items, mateZone }: { items?: Person[]; mateZone?: MateZoneConfig }) {
  const people: Person[] = items && items.length ? items : DEFAULT_PEOPLE;

  const [isMount, setIsMount] = useState(false);
  const [current, setCurrent] = useState(0);
  const [listOpen, setListOpen] = useState(false);

  const total = people.length;
  const hasMultiple = total > 1;
  const person = people[current] ?? people[0];

  // 페이지 로드 시 랜덤한 사람을 표시
  useEffect(() => {
    if (!isMount && total > 0) {
      const randomIndex = Math.floor(Math.random() * total);
      setCurrent(randomIndex);
      setIsMount(true);
    }
  }, [isMount, total]);

  // 글 전환 시 본문 상단으로 스크롤(블로그처럼 한 편씩 읽는 경험)
  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(total - 1, index)); // 경계 클램프(순환 안 함)
    setCurrent(next);
    setListOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const hasPrev = current > 0;
  const hasNext = current < total - 1;

  const hasWorkMoments = person.workMoments.photos.length > 0 || !!person.workMoments.video;
  const hasQna = person.qna.some((qa) => qa.q.trim());
  const hasProducts = person.products.some((p) => p.name.trim());
  const ig = person.instagram;
  const hasIgEmbed = !!ig?.embed?.trim();
  const igBarImage = ig ? (ig.image?.trim() || ig.photos[0] || ig.reels[0] || person.image_url || "") : "";
  const hasInstagram = !!ig && (hasIgEmbed || !!ig.handle.trim());

  return (
    <section className="bg-[#FAFAF8]">
      <h1 className="sr-only">워크업 메이트 — 일하는 사람들의 이야기</h1>
      {/* ── 히어로 (최상단) ── */}
      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden bg-[#303236]">
        {person.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ikSrc(person.image_url, 1920)} alt={person.job} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#303236,#101a30)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-[15px] md:px-[70px]">
          <span className="text-[#E5541B] text-[12px] md:text-[13px] font-bold tracking-wider mb-3">WORKUP MATE</span>
          <h2 className="text-white text-[26px] md:text-[42px] font-bold leading-tight mb-4 max-w-[600px]">
            {person.quote.split("\n").map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </h2>
          <p className="text-white/80 text-[13px] md:text-[15px]">
            {person.job} {person.job && person.years && <span className="mx-1.5 text-white/40">|</span>} {person.years}
          </p>
        </div>
      </div>

      <div className="px-[15px] md:px-[70px]">
        {/* 목록 바 — 히어로 아래, 글이 2편 이상일 때만 */}
        {hasMultiple && (
          <div className="pt-6">
            <div className="flex items-center justify-between border-y border-gray-200 py-3">
              <span className="text-[12px] text-gray-500">
                MATE 이야기 · 총 <span className="font-semibold text-[#303236]">{total}</span>편 중{" "}
                <span className="font-semibold text-[#E5541B]">{current + 1}</span>편째
              </span>
              <button
                onClick={() => setListOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#303236] hover:text-[#E5541B] transition-colors min-h-[44px] px-2"
                aria-expanded={listOpen}
                aria-controls="mate-list"
              >
                {listOpen ? "목록 닫기 ▲" : "전체 목록 보기 ▼"}
              </button>
            </div>

            {listOpen && (
              <ul id="mate-list" className="mt-3 border border-gray-200 bg-white divide-y divide-gray-100">
                {people.map((p, i) => {
                  const isActive = i === current;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => goTo(i)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors min-h-[44px] ${
                          isActive ? "bg-[#FAFAF8]" : "hover:bg-gray-50"
                        }`}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className={`text-[11px] font-bold mt-0.5 ${isActive ? "text-[#E5541B]" : "text-gray-300"}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1">
                          <span className="block text-[12px] text-[#E5541B] font-semibold mb-0.5">{p.job}</span>
                          <span className="block text-[14px] text-[#303236] font-medium leading-snug">
                            {p.quote.split("\n")[0]}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── WORK MOMENTS ── */}
        {hasWorkMoments && (
          <div className="py-12 md:py-16 border-b border-gray-200">
            <div className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-10 items-start">
              <div>
                <h3 className="text-[13px] font-bold tracking-wider text-[#303236] mb-3">WORK MOMENTS</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">현장의 순간과<br />일상의 취미까지</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {person.workMoments.photos.map((url, i) => (
                  <div key={i} className="aspect-[3/4] overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ikSrc(url, 600)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {person.workMoments.video && (
                  <div className="relative aspect-[3/4] overflow-hidden bg-black">
                    <video src={person.workMoments.video} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-[#303236] ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── INTERVIEW ── */}
        {hasQna && (
          <div className="py-12 md:py-16 border-b border-gray-200">
            <div className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-10">
              <div>
                <h3 className="text-[13px] font-bold tracking-wider text-[#303236] mb-3">INTERVIEW</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">그들이 들려주는<br />이야기</p>
              </div>
              <InterviewAccordion qna={person.qna} />
            </div>
          </div>
        )}

        {/* ── WEAR THIS ── */}
        {hasProducts && (
          <div className="py-12 md:py-16 border-b border-gray-200">
            <div className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-10 items-start">
              <div>
                <h3 className="text-[13px] font-bold tracking-wider text-[#303236] mb-3">WEAR THIS</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">현장과 일상에서<br />착용한 제품</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {person.products.filter((p) => p.name.trim()).slice(0, 3).map((product, i) => (
                  <Link key={i} href={product.href} className="group block">
                    <div className="aspect-square bg-gray-100 overflow-hidden mb-3">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ikSrc(product.image_url, 600)} alt={product.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                      ) : null}
                    </div>
                    <p className="text-[14px] font-semibold text-[#303236] mb-1">{product.name}</p>
                    <span className="text-[12px] text-gray-500 group-hover:text-[#E5541B] transition-colors">자세히 보기 →</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INSTAGRAM ── */}
        {hasInstagram && ig && (
          <div className="py-12 md:py-16">
            {hasIgEmbed ? (
              // 위젯 임베드가 있으면 실시간 피드 표시(왼쪽 계정 정보 / 오른쪽 피드)
              <div className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-10 items-start">
                <div>
                  <h3 className="text-[13px] font-bold tracking-wider text-[#303236] mb-3">INSTAGRAM</h3>
                  <p className="text-[14px] font-semibold text-[#303236] mb-2">{ig.handle}</p>
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    {ig.description.split("\n").map((line, i) => (
                      <span key={i}>{line}{i < ig.description.split("\n").length - 1 && <br />}</span>
                    ))}
                  </p>
                </div>
                <InstagramEmbed html={ig.embed!} />
              </div>
            ) : (
              // 인스타그램 바 — 대표 이미지 1장 + 계정 정보 + 바로가기 (전체를 클릭 시 프로필 이동)
              <a
                href={ig.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col sm:flex-row sm:items-center border border-gray-200 bg-white hover:border-[#E5541B] transition-colors overflow-hidden"
              >
                {igBarImage && (
                  <div className="w-full sm:w-44 h-44 sm:h-32 flex-shrink-0 overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ikSrc(igBarImage, 400)} alt={ig.handle} className="w-full h-full object-cover transition-transform" />
                  </div>
                )}
                <div className="flex-1 px-5 py-5 sm:py-0 min-w-0">
                  <p className="text-[11px] font-bold tracking-wider text-[#303236] mb-1">INSTAGRAM</p>
                  <p className="text-[17px] font-semibold text-[#303236] mb-1 truncate">{ig.handle}</p>
                  <p className="text-[13px] text-gray-500 truncate">{ig.description.replace(/\n/g, " ")}</p>
                </div>
                <span className="px-5 pb-5 sm:pb-0 sm:pr-6 text-[13px] font-semibold text-[#303236] group-hover:text-[#E5541B] transition-colors whitespace-nowrap">
                  인스타그램 바로가기 →
                </span>
              </a>
            )}
          </div>
        )}

        {/* 이전 / 다음 이야기 — 해당 방향에 글이 있을 때만 버튼 노출 */}
        {hasPrev || hasNext ? (
          <div className="pb-10 flex gap-3">
            {hasPrev && (
              <button
                onClick={() => goTo(current - 1)}
                className="flex-1 flex flex-col items-start border border-gray-200 bg-white px-5 py-4 text-left hover:border-[#E5541B] transition-colors min-h-[44px]"
              >
                <span className="text-[11px] text-gray-400 mb-1">← 이전 이야기</span>
                <span className="text-[13px] font-medium text-[#303236] line-clamp-1">
                  {people[current - 1].job}
                </span>
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => goTo(current + 1)}
                className="flex-1 flex flex-col items-end border border-gray-200 bg-white px-5 py-4 text-right hover:border-[#E5541B] transition-colors min-h-[44px]"
              >
                <span className="text-[11px] text-gray-400 mb-1">다음 이야기 →</span>
                <span className="text-[13px] font-medium text-[#303236] line-clamp-1">
                  {people[current + 1].job}
                </span>
              </button>
            )}
          </div>
        ) : (
          <p className="pb-10 text-center text-[13px] text-gray-400">
            더 많은 이야기가 곧 추가됩니다.
          </p>
        )}

        {/* MATE ZONE — 같은 페이지 흐름 안의 릴스 영역(릴스 없으면 자동 숨김) */}
        {mateZone && <MateZone config={mateZone} />}
      </div>

      {/* 데스크톱 우하단 고정 CTA — 글을 읽는 내내 매장 방문 유도(모바일은 전역 하단바 '매장' 탭이 담당) */}
      <Link
        href="/store"
        className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2 bg-[#E5541B] text-white text-[14px] font-semibold px-6 py-3.5 rounded-full shadow-[0_4px_20px_rgba(229,84,27,0.35)] hover:bg-[#303236] transition-colors"
      >
        가까운 매장 찾기 →
      </Link>
    </section>
  );
}

// 외부 인스타그램 위젯 임베드 코드를 삽입한다.
// innerHTML로 넣은 <script>는 브라우저가 실행하지 않으므로, 스크립트를 새로 만들어 재실행한다.
// (SnapWidget·LightWidget 같은 iframe 위젯과 Behold 같은 script 위젯 모두 지원)
// 인스타 embed.js가 전역에 심는 객체
declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const IG_EMBED_SRC = "https://www.instagram.com/embed.js";

// 임베드 하단에서 잘라낼 높이(px).
// 인스타 임베드 하단은 "Instagram에서 더 보기" 링크 → 좋아요/댓글 아이콘 줄 → 좋아요 수 → 댓글 달기 순이다.
// 링크까지는 남기고(인스타 유입 유도) 그 아래 영역만 잘라낸다.
const IG_CROP_BOTTOM_PX = 115;

function InstagramEmbed({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  // 화면에 가까워질 때까지 인스타 외부 리소스를 불러오지 않는다
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !near) return;
    el.innerHTML = html;

    // 인스타는 로드 후 iframe의 height "속성"에 자연 높이를 써 넣는다.
    // 그 값을 기준으로 style.height를 덮어써 하단을 잘라낸다(iframe은 넘치는 부분이 잘림).
    // 속성이 아니라 style을 건드리므로 값이 계속 줄어드는 되먹임이 생기지 않는다.
    const cropAll = () => {
      el.querySelectorAll<HTMLIFrameElement>("iframe.instagram-media").forEach((f) => {
        const natural = Number(f.getAttribute("height")) || 0;
        if (natural > IG_CROP_BOTTOM_PX + 200) {
          f.style.setProperty("height", `${natural - IG_CROP_BOTTOM_PX}px`, "important");
        }
      });
    };
    const cropObserver = new MutationObserver(cropAll);
    cropObserver.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["height"] });

    // 게시물을 여러 개 붙여넣으면 embed.js도 여러 번 들어온다.
    // 중복 로드하면 두 번째부터는 변환(process)이 실행되지 않으므로,
    // 인스타 스크립트는 걷어내고 아래에서 한 번만 로드한 뒤 직접 process()를 호출한다.
    let hasInstagram = false;
    el.querySelectorAll("script").forEach((old) => {
      if ((old.getAttribute("src") ?? "").includes("instagram.com/embed.js")) {
        hasInstagram = true;
        old.remove();
        return;
      }
      // 그 외 위젯(Behold 등) 스크립트는 innerHTML로는 실행되지 않으므로 새로 만들어 재실행
      const s = document.createElement("script");
      for (const attr of Array.from(old.attributes)) s.setAttribute(attr.name, attr.value);
      s.text = old.textContent ?? "";
      old.replaceWith(s);
    });

    // 캡션(본문 글)까지 포함된 임베드는 카드가 너무 길어진다.
    // data-instgrm-captioned 를 떼면 인스타 공식 동작으로 캡션 없이 사진 위주로 로딩된다.
    el.querySelectorAll("[data-instgrm-captioned]").forEach((bq) => {
      bq.removeAttribute("data-instgrm-captioned");
    });

    // 스크립트를 안 붙이고 blockquote만 넣은 경우도 처리
    if (!hasInstagram && !el.querySelector(".instagram-media")) {
      return () => cropObserver.disconnect();
    }

    const process = () => { window.instgrm?.Embeds.process(); cropAll(); };

    if (window.instgrm) {
      process();
      return () => cropObserver.disconnect();
    }

    let script = document.querySelector<HTMLScriptElement>(`script[data-ig-embed="1"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = IG_EMBED_SRC;
      script.async = true;
      script.dataset.igEmbed = "1";
      document.body.appendChild(script);
    }
    script.addEventListener("load", process, { once: true });

    return () => cropObserver.disconnect();
  }, [html, near]);
  // 인스타 임베드는 블록 요소라 기본적으로 세로로 쌓인다.
  // 폭이 되는 만큼 가로로 나란히 배치하고(모바일은 1열), 임베드에 박힌 인라인 스타일
  // (margin / min-width:326px / max-width:540px)은 !important로 눌러 셀에 맞춘다.
  return (
    <div
      ref={ref}
      className="grid items-start gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]
                 [&_iframe]:!m-0 [&_iframe]:!w-full [&_iframe]:!min-w-0 [&_iframe]:!max-w-[540px]
                 [&_blockquote]:!m-0 [&_blockquote]:!w-full [&_blockquote]:!min-w-0
                 [&_.instagram-media-registered]:!hidden"
    />
  );
}

function InterviewAccordion({ qna }: { qna: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const items = qna.filter((item) => item.q.trim());

  return (
    <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-4 text-left min-h-[44px]"
              aria-expanded={isOpen}
            >
              <span className="text-[15px] md:text-[17px] font-bold text-[#303236]">
                <span className="text-[#E5541B] mr-2">Q{i + 1}.</span>
                {item.q}
              </span>
              <span className="text-[18px] text-gray-400 flex-shrink-0">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && item.a.trim() && (
              <div className="pb-5 pr-8">
                <p className="text-[14px] text-gray-600 leading-loose whitespace-pre-line">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
