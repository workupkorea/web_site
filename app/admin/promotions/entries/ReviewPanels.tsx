"use client";

import { createElement, memo } from "react";
import Script from "next/script";

export default memo(function ReviewPanels({ html, eventId }: { html: string; eventId: string }) {
  return (
    <>
      <Script src="/goldenbell/admin.js" strategy="afterInteractive" />
      <Script src="/goldenbell/admin-draw.js" strategy="afterInteractive" />
      {createElement("goldenbell-review", {
        className: "goldenbell-review promotion-review",
        "data-event": eventId,
        dangerouslySetInnerHTML: { __html: html },
      })}
    </>
  );
});
