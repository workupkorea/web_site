// pdf.js 공통 옵션 — 모든 PDF 뷰어가 같은 값을 쓴다.
// 참조가 바뀌면 react-pdf가 문서를 다시 로드하므로 모듈 상수로 고정한다.
//
// wasmUrl: JPEG2000(JPXDecode) 이미지 디코더(openjpeg.wasm) 등을 찾는 경로.
//   이게 없으면 JPEG2000 이미지가 조용히 빠져 "글자만 있고 사진이 없는" 페이지가 된다.
//   public/pdfjs/wasm/ 파일은 node_modules/pdfjs-dist/wasm/ 에서 복사한 것이며,
//   react-pdf(pdfjs-dist) 버전을 올릴 때 함께 다시 복사해야 한다. (public/pdf.worker.min.mjs와 동일)
export const PDF_OPTIONS = {
  wasmUrl: "/pdfjs/wasm/",
} as const;

export const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
