"use client";

import { createElement, memo } from "react";
import Script from "next/script";

export default memo(function ReviewPanels({ html }: { html: string }) {
  return (
    <>
      <Script src="/goldenbell/admin.js" strategy="afterInteractive" />
      {createElement("goldenbell-review", {
        className: "goldenbell-review promotion-review",
        dangerouslySetInnerHTML: { __html: html },
      })}
    </>
  );
});
