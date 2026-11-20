"use client";

import { useEffect, useState } from "react";

export default function MateActivityImage({ url, alt }: { url: string; alt: string }) {
  const [image, setImage] = useState<{ source: string; blob: string } | null>(null);

  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!token) return;
    const request = new AbortController();
    let blobUrl: string | undefined;
    async function load() {
      try {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (request.signal.aborted) return;
        blobUrl = URL.createObjectURL(blob);
        setImage({ source: url, blob: blobUrl });
      } catch {
        // Activity text and the response form remain usable if the image cannot load.
      }
    }
    void load();
    return () => {
      request.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  if (image?.source !== url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- The protected image is fetched as a browser blob.
  return <img src={image.blob} alt={alt} className="mt-3 max-h-[28rem] w-full rounded-lg bg-stone-50 object-contain" />;
}