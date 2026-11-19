import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 강제 재배포 트리거 — 신발 카테고리 상품 404 이슈 확인용 (2026-07-15)

export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-pathname", request.nextUrl.pathname);
  return res;
}

export const proxyConfig = {
  // api/ 는 제외 — x-pathname은 페이지 렌더링(app/layout.tsx의 헤더 표시 여부)에만 쓰이고
  // API 라우트는 이 값을 쓰지 않는다. (골든벨 영수증 업로드 /goldenbell/api/ 도 같은 이유로 제외) 프록시를 거치면 요청 바디 크기가 제한되는데,
  // 이미지 업로드(/api/admin/upload) 같은 라우트가 큰 파일에서 "Failed to parse body as
  // FormData" 오류를 내던 원인이었다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|goldenbell/api/).*)"],
};
