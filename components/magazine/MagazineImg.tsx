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

export default function MagazineImg({
  image,
  className = "",
  priority = false,
}: {
  image: MagazineImage;
  className?: string;
  priority?: boolean;
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
