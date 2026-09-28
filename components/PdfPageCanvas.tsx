"use client";
import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

const MAX_DPR = 2; // 고해상도 화면에서도 캔버스 메모리가 과하게 커지지 않게 제한

// PDF 페이지에서 그릴 영역. 인쇄용 펼침면 PDF는 한 페이지에 2쪽이 붙어 있어 좌/우 반쪽씩 나눠 그린다.
export type PdfHalf = "full" | "left" | "right";

// 캔버스 크기를 정하고 렌더를 시작한다. width는 "보여줄 한 쪽"의 가로 폭(CSS px)이다.
function startRender(page: PDFPageProxy, canvas: HTMLCanvasElement, width: number, half: PdfHalf, dpr: number): RenderTask {
  const ctx = canvas.getContext("2d")!;
  const base = page.getViewport({ scale: 1 });
  const fullWidth = half === "full" ? width : width * 2;
  const viewport = page.getViewport({ scale: (fullWidth / base.width) * dpr });
  const visibleW = half === "full" ? viewport.width : viewport.width / 2;
  canvas.width = Math.floor(visibleW);
  canvas.height = Math.floor(viewport.height);
  return page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    // 오른쪽 반쪽은 원본을 왼쪽으로 절반만큼 밀어 그린다
    transform: half === "right" ? [1, 0, 0, 1, -visibleW, 0] : undefined,
  });
}

// 썸네일 스트립용 — 한 쪽을 작게 그려 JPEG data URL로 돌려준다.
export async function renderPdfThumb(doc: PDFDocumentProxy, pageNumber: number, half: PdfHalf, width: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const canvas = document.createElement("canvas");
  await startRender(page, canvas, width, half, 1).promise;
  return canvas.toDataURL("image/jpeg", 0.7);
}

// PDF 한 쪽을 <canvas>에 그린다. 문서(PDFDocumentProxy)는 부모가 한 번만 로드해 넘겨준다.
// width는 "보여줄 한 쪽"의 가로 폭이다(반쪽이면 원본 페이지 폭의 절반에 해당).
// react-pdf를 import하지 않으므로 SSR에서 안전하다(pdf.js 평가는 부모의 동적 import에서만 일어남).
export default function PdfPageCanvas({ doc, pageNumber, width, half = "full" }: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  half?: PdfHalf;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (width <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        task = startRender(page, canvas, width, half, dpr);
        await task.promise;
      } catch (e) {
        // 렌더 취소(페이지 넘김·리사이즈)는 정상 흐름이므로 무시
        if ((e as { name?: string })?.name !== "RenderingCancelledException") {
          console.error(`[PdfPageCanvas] p.${pageNumber}(${half}) 렌더 실패`, e);
        }
      }
    })();

    return () => { cancelled = true; task?.cancel(); };
  }, [doc, pageNumber, width, half]);

  return (
    <canvas ref={canvasRef}
      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", backgroundColor: "#f5f0eb" }} />
  );
}
