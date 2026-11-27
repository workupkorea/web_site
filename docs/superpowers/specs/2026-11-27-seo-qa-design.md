# 워크업 SEO 전면 개선 + QA 후속 — 점검 결과와 구현 계획

- 작성일: 2026-11-27
- 상태: 로컬 구현·검증 완료 (커밋·push·배포 없음). DB 변경 1건 — 6장 참고

## 1. 점검 방법과 한계

| 항목 | 방법 |
|---|---|
| 메타데이터·상태코드·sitemap | 운영 사이트(www.workupkorea.com) GET 요청, sitemap 169개 전수 |
| DB | Supabase 읽기 전용 조회 |
| 깨진 이미지 | 판매중 상품 322건, 사이트 설정, 주요 테이블, 공개 19개 페이지의 이미지 3,628개 HEAD 요청 |
| 모바일 | 이미 실행 중이던 로컬 서버(localhost:3000, 미커밋 변경 포함), 375px 에뮬레이션 15개 페이지 |

미실시: Lighthouse(미설치, PageSpeed API는 일일 할당량 초과 429), 실기기 확인, 전 페이지 이미지 잘림 육안 확인, Rich Results Test, 회귀 테스트.

## 2. QA 후속 점검 결과

| 항목 | 결과 |
|---|---|
| `tel:0000000000` | 공통 헤더·푸터가 아니라 `app/brands/[id]/page.tsx:181` 하단 CTA. PDF 카탈로그 없는 브랜드(kenta, k-workers 등)에 노출. PC·모바일 동일 코드 |
| 고객센터 번호 | 푸터 설정(DB)·/support 모두 070-8877-3088. /support는 `tel:07088773088` 정상. 푸터는 링크가 아닌 텍스트. 실제 착신 여부는 사람이 확인 필요 |
| 추가 발견: `/stores` | 404 링크. `app/brands/[id]/page.tsx:176`, `components/BrandsPageClient.tsx:130` (/brands에 노출 중) → `/store` |
| 네이버 공식몰 `workup_offcial` | 200, 제목 "워크업 workup". 정상 주소 → 수정하지 않음 |
| `/brands/k-workers` vs `/brands/k-wokers` | 200("카탈로그 준비 중") vs 404+noindex. 정상 |
| Soft 404 | 상품·매장·브랜드·PR·기획전 잘못된 URL은 404. 예외: `/ih-mobile/zzzz`가 200이고 noindex 없음. 전용 404 화면 없음(제목이 사이트 기본값) |
| 깨진 이미지 | 3,628개 중 0개 |
| 모바일 | 15개 페이지 가로 넘침 0, 깨진 이미지 0, 하단 메뉴 6개 항목 정상. 문제: 헤더 문의 링크 높이 18px(44px 미만), /store 검색 안내문 잘림, 하단 "매장" 아이콘이 장바구니 모양 |

### 브랜드명 불일치 (DB `products.brand`, 판매중 기준) — 공식 표기 필요

| 현재 값 | 건수 | 비고 |
|---|---|---|
| DETRO.IT / DETROIT | 13 / 10 | 혼용 |
| BLACK ARMOR / BALCK ARMOR | 71 / 4 | 오타. 메뉴 표기는 BLACKARMOR |
| BLACK SMITH / BLACKSMITH | 40 / 1 | 혼용 |
| MADDOG | 2 | brands 테이블은 MAD DOG |
| K-WORKS | 6 | K-WORKERS와 같은 브랜드인지 확인 필요 |

저장소에 브랜드 표기 가이드라인 문서가 없다.

## 3. SEO 점검 결과 (중요도 순)

1. **sitemap 169개 중 154개(매장 상세 전부)가 404.** 활성 매장 154곳 전부 `page_active=false`인데 sitemap은 이 값을 보지 않음. /store/1(포천점), /store/2(전주김제점)는 실제 운영 매장이며 페이지만 비노출.
2. **PRODUCTS 메뉴 비공개 → /products와 상품 상세 전부 noindex**, sitemap 제외 (판매중 322건).
3. 상품 tagline·meta_desc가 1,043건 전부 비어 있어 자동 생성이 없으면 설명이 비게 됨.
4. 매장 설명 154건 전부 비어 있고 이미지 있는 매장은 1곳.
5. 하위 페이지 다수의 og:title·og:image가 홈 값으로 나가고 og:url 없음. /pr, /studio는 og:image 없음.
6. canonical 없음: /arrival, /franchise, /brands/[id], /store/[id], /pr/[id], /p/[id], /group-order, /team-order.
7. sitemap 누락: 보도자료 상세, 브랜드 상세·카탈로그, /magazine, /franchise, 기획전.
8. /group-order, /team-order는 의도적 noindex(코드 주석: 정식 공개 전).
9. /arrival은 발주 사이트 삽입용 단독 화면(H1 없음, 카드가 button). 상품별 링크 대상이 없음.
10. 상품 JSON-LD의 반품 정책(14일)·배송 정보는 근거 확인이 안 된 값. 정적 데이터의 "실제 사용 후기"가 운영 상품 페이지(lightweight-windproof-jacket)에 노출 중 — 실제 후기인지 확인 필요.
11. 성능: 히어로가 PC·모바일 `<img>`를 둘 다 로드, 홈 이미지 70개 중 59개 즉시 로드, 외부 폰트 CSS 3개. /people 인스타 iframe 지연 로딩 미지정.

## 4. 구현 계획

| 단계 | 내용 | 주요 파일 |
|---|---|---|
| 0 | 변경 전 기준값 저장(HTML 메타, Lighthouse PC/모바일) | scratchpad |
| 1 우선 QA | 브랜드 전화 링크를 푸터 설정 번호로, `/stores`→`/store`, 푸터 번호 tel 링크화, 헤더 터치 영역, 검색 안내문, 매장 아이콘 | brands/[id]/page, BrandsPageClient, Footer, Header, StoreLocator, BottomNav |
| 2 sitemap·404 | page_active 필터, 누락 URL 추가(공개 상태 반영), 전용 not-found(매장 찾기 CTA), ih-mobile noindex·404 | sitemap.ts, not-found.tsx |
| 3 메타데이터 | 공통 생성 함수로 title·description·canonical·OG·Twitter, H1 보강 | lib/seo.ts(신규), 공개 page.tsx |
| 4 상품·매장 | 상품 설명 자동 생성, ARRIVAL 링크(결정 3), 매장 제목(지역+지점+작업복)·설명 자동 생성, 영업시간 구조화, BreadcrumbList, 근거 없는 LD 필드 제거 | products/[id], store/[id], lib/seo.ts |
| 5 카테고리 | `/category/workwear`(작업복·워크웨어 통합), `/category/safety-shoes`, `/category/winter-workwear`. 상품 목록·설명·매장 찾기·공식몰. 상품 있는 페이지만 색인 | app/category/[slug] |
| 6 성능·접근성 | 히어로 `<picture>`, 지연 로딩, 장식 이미지 ALT 구분 | HeroCarousel 등 |
| 7 검증 | 전후 메타 비교, robots/sitemap 전수, 404, JSON-LD, 신규 상품·매장 자동 반영, Lighthouse, 이벤트·관리자 회귀 | — |

- 새 라이브러리 없음. Lighthouse는 검증 도구로만 1회 실행(npx 내려받기).
- 디자인 유지. 장바구니·결제 요소 추가 없음.
- 작업 트리의 미커밋 변경(메이트·골든벨·프로모션)은 건드리지 않고 커밋을 분리한다.
- push·운영 배포는 별도 승인 후.
- 위험: sitemap·noindex 변경은 색인에 직접 영향. 이미지 전송 방식 변경(ImageKit 파라미터)은 하지 않으며, 필요해지면 사전 고지.

## 5. 결정 필요

| # | 질문 | 권장 |
|---|---|---|
| 1 | 매장 상세 페이지 154곳을 공개할까? (관리자 일괄 변경) 비공개 유지 시 매장 SEO 효과 없음 | 공개. 단 자동 설명 적용 후 |
| 2 | PRODUCTS 메뉴는 숨긴 채 검색 노출만 허용할까? | 허용(메뉴 노출과 색인 설정 분리) |
| 3 | ARRIVAL·단체복(group-order)을 검색에 공개할까? | 단체복 공개, ARRIVAL은 내부용이면 noindex |
| 4 | 브랜드 공식 표기, K-WORKS 동일 여부, DB 일괄 수정 허용 | 표기표 확정 후 수정 |
| 5 | 070-8877-3088 실제 착신 확인, 상품 후기의 진위 | 후기가 샘플이면 제거 |

## 6. 결정 사항과 구현 결과 (2026-11-27)

### 결정
1. 매장 상세 페이지는 비공개 유지
2. 상품은 비공개 유지(내부 정책)
3. 단체복(/group-order)만 검색 공개. ARRIVAL·team-order·가이드는 noindex
4. DETRO.IT / DETROIT 혼용 허용. BLACK ARMOR 오타는 수정
5. 070-8877-3088은 실제 착신 번호

### 전후 비교 (로컬 서버 기준)

| 항목 | 전 | 후 |
|---|---|---|
| sitemap URL | 169 (운영 기준 154개 404) | 43 (전부 200, noindex 0, canonical·H1·OG 정상, 제목·설명 중복 0) |
| 하위 페이지 og:title | 홈 값 | 페이지별 값, og:url 포함 |
| canonical 없는 공개 페이지 | brands/[id], franchise, group-order 등 | sitemap 대상 0 |
| `tel:0000000000`, `/stores` | 있음 | 없음. 푸터 번호 `tel:07088773088` |
| 헤더 문의 링크 높이(375px) | 18px | 44px (헤더 높이 57px) |
| 잘못된 /ih-mobile 토큰 | 200 | 404 + noindex |
| 404 화면 | 전용 화면 없음 | 매장 찾기 버튼 포함 |
| 상품 JSON-LD | 반품·배송·재고 값 포함 | 제거, BreadcrumbList 추가 |
| 히어로 이미지 | PC·모바일 동시 로드 | `<picture>`로 한 장만 |
| 인스타 임베드(/people) | 즉시 로드 | 화면 근처에서 로드 |

- `/franchise`는 canonical을 `/partnership/franchise`로 지정하고 sitemap에서 제외.
- 카탈로그 없는 브랜드 상세("준비 중")는 noindex. 카탈로그 있는 브랜드는 `/brands/{slug}/catalog`가 정본.
- 매장 메타데이터·영업시간 자동 생성: 활성 154곳 중 시·군·구 추출 147곳, 영업시간 해석 150곳(빈 값 3, 24시간 1은 생략). 매장 페이지가 비공개라 실제 화면 렌더링은 미확인.

### DB 변경
`products.brand` "BALCK ARMOR" → "BLACK ARMOR" 4건 (ae30c5b4d3eccf13c154ce20, b098ce68d310d2f0c154ce20, b098c77cb860-c9d1c5c5c154ce20, b354be14b808c774c5b4b4dcd32cce20_long). 잔여 0건. 되돌리려면 이 4건의 brand를 "BALCK ARMOR"로 복원.

### 검증
`tsc` 통과, `next build` 통과, 변경 파일 eslint 오류 1건(`HeroCarousel.tsx` 슬라이드 링크 이동, 변경 전부터 존재).

### 하지 않은 것
- 상품 카테고리 페이지, ARRIVAL 카드 링크: 상품 비공개 정책과 충돌
- 매장 교통 안내: DB에 항목 없음
- Lighthouse, Rich Results Test, 실기기, 이벤트·관리자 기능 수동 회귀, 상품·매장 실제 신규 등록 테스트
- (추가 반영) 정적 샘플 "실제 사용 후기" 데이터와 상품 상세의 해당 섹션 제거 — 사용자 요청
