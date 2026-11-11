"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { MagazineImage } from "@/lib/home-magazine";

// 매거진 공용 이미지 — PC/모바일 이미지를 <picture>로 분기한다.
// 이미지 서버 변환이 없으므로(ikSrc no-op) 업로드 시 리사이즈된 파일을 그대로 쓴다.
// priority: 첫 화면(커버)만 true — 나머지는 lazy 로드.
//
// random=true 면 방문할 때마다 무작위로 노출한다. PC 후보(url + more)와 모바일 후보(mobileUrl + mobileMore)는
// 각자 따로 뽑고, 모바일 후보가 없으면 PC 사진을 잘라서 쓴다.
// 홈이 캐시된 페이지라 서버에서 뽑으면 모두에게 같은 사진이 고정되므로 브라우저에서 뽑는다.
// (서버 렌더·첫 페인트는 항상 대표 사진 → 하이드레이션 후 후보 중 하나로 교체)
const MOBILE_MEDIA = "(max-width: 767px)";

type Picked = { pc: MagazineImage; mobile?: MagazineImage };

const pickRandom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function resolve(image: MagazineImage): Picked {
  const mainMobile = image.mobileUrl ? { url: image.mobileUrl, alt: image.alt, position: image.mobilePosition } : undefined;
  if (!image.random) return { pc: image, mobile: mainMobile };
  const pcPool = [image, ...(image.more ?? [])].filter((i) => i.url);
  const mobilePool = [...(mainMobile ? [mainMobile] : []), ...(image.mobileMore ?? [])].filter((i) => i.url);
  return {
    pc: pcPool.length > 1 ? pickRandom(pcPool) : image,
    mobile: mobilePool.length > 0 ? pickRandom(mobilePool) : undefined,
  };
}

// ── 롤링(커버용) ──
// 후보가 2장 이상이면 일정 간격으로 크로스페이드하며 순서대로 넘긴다. 첫 장은 대표 사진.
// 다음 사진은 미리 내려받은 뒤에만 전환(깜빡임·빈 화면 방지). 탭이 숨겨졌거나 '동작 줄이기' 설정이면 멈춘다.
const ROLL_INTERVAL_MS = 5000;
const FADE_MS = 1200;

function buildPools(image: MagazineImage) {
  const mainMobile = image.mobileUrl ? { url: image.mobileUrl, alt: image.alt, position: image.mobilePosition } : undefined;
  const pc = [image, ...(image.more ?? [])].filter((i) => i.url);
  const mobile = [...(mainMobile ? [mainMobile] : []), ...(image.mobileMore ?? [])].filter((i) => i.url);
  return { pc, mobile };
}

function RollingImg({ image, className, priority }: { image: MagazineImage; className: string; priority: boolean }) {
  const { pc: pcPool, mobile: mobilePool } = buildPools(image);
  const count = Math.max(pcPool.length, mobilePool.length);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState<number[]>([0]); // 한 번이라도 보여준(내려받은) 슬라이드

  const pcAt = (i: number) => pcPool[i % pcPool.length] ?? image;
  const mobileAt = (i: number) => (mobilePool.length ? mobilePool[i % mobilePool.length] : undefined);

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let current = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const next = (current + 1) % count;
      const urls = [pcAt(next).url, mobileAt(next)?.url].filter(Boolean) as string[];
      // 다음 사진을 다 내려받은 뒤에만 전환
      Promise.all(
        urls.map((u) => new Promise<void>((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = u; })),
      ).then(() => {
        if (cancelled) return;
        current = next;
        setLoaded((l) => (l.includes(next) ? l : [...l, next]));
        setIdx(next);
      });
    }, ROLL_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, image]);

  return (
    <>
      {loaded.map((i) => {
        const pc = pcAt(i);
        const mobile = mobileAt(i);
        const active = i === idx;
        return (
          <picture
            key={i}
            aria-hidden={!active}
            className="absolute inset-0 block"
            style={{ opacity: active ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in-out` }}
          >
            {mobile && <source media={MOBILE_MEDIA} srcSet={mobile.url} />}
            <img
              src={pc.url}
              alt={active ? pc.alt : ""}
              loading={priority && i === 0 ? "eager" : "lazy"}
              fetchPriority={priority && i === 0 ? "high" : "auto"}
              decoding="async"
              className={`magazine-img object-cover ${className}`}
              style={
                {
                  "--pos": pc.position ?? "50% 50%",
                  "--pos-m": mobile?.position ?? image.mobilePosition ?? pc.position ?? "50% 50%",
                } as CSSProperties
              }
            />
          </picture>
        );
      })}
    </>
  );
}

export default function MagazineImg({
  image,
  className = "",
  priority = false,
  rolling = false,
}: {
  image: MagazineImage;
  className?: string;
  priority?: boolean;
  rolling?: boolean; // true + random 켜짐 + 후보 2장 이상 → 자동 롤링
}) {
  const pools = buildPools(image);
  if (rolling && image.random && Math.max(pools.pc.length, pools.mobile.length) > 1) {
    return <RollingImg image={image} className={className} priority={priority} />;
  }
  return <PickedImg image={image} className={className} priority={priority} />;
}

function PickedImg({
  image,
  className,
  priority,
}: {
  image: MagazineImage;
  className: string;
  priority: boolean;
}) {
  const [picked, setPicked] = useState<Picked>(() => resolve({ ...image, random: false }));

  useEffect(() => {
    setPicked(resolve(image)); // 첫 렌더 이후 무작위 선택 / 편집 중 props 변경 반영
  }, [image]);

  const { pc, mobile } = picked;
  return (
    <picture>
      {mobile && <source media={MOBILE_MEDIA} srcSet={mobile.url} />}
      <img
        src={pc.url}
        alt={pc.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={`magazine-img object-cover ${className}`}
        style={
          {
            "--pos": pc.position ?? "50% 50%",
            "--pos-m": mobile?.position ?? image.mobilePosition ?? pc.position ?? "50% 50%",
          } as CSSProperties
        }
      />
    </picture>
  );
}
