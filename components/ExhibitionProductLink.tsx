"use client";

import type { ReactNode } from "react";
import { trackExhibitionProductClick } from "@/lib/track";

export default function ExhibitionProductLink({
  name, href, trackingPath, className, children,
}: {
  name: string;
  href: string;
  trackingPath?: string;
  className: string;
  children: ReactNode;
}) {
  const track = () => {
    if (trackingPath) trackExhibitionProductClick(name, href, trackingPath);
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name} 스마트스토어에서 보기`}
      className={className}
      onClick={track}
      onAuxClick={(event) => { if (event.button === 1) track(); }}
    >
      {children}
    </a>
  );
}
