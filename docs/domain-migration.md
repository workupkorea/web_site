# 도메인 이전 프로세스 — workupkorea.com

## 상황

- 현재: Vercel 기본 주소(`*.vercel.app`)로 운영 중
- 목표: 이미 구매 완료된 `workupkorea.com`을 Vercel 프로젝트에 연결
- 코드베이스는 이미 이전을 염두에 두고 설계되어 있음
  - `lib/site.ts`가 `NEXT_PUBLIC_SITE_URL` 환경변수를 최우선으로 읽어 `metadataBase`, `app/sitemap.ts`, `app/robots.ts`가 전부 이 값을 참조
  - 즉 **코드 수정 없이 Vercel 환경변수 설정만으로 전환 가능**한 구조

## 영향 범위

| 항목 | 영향 |
|---|---|
| 코드 변경 | 없음 (`lib/site.ts` 구조 그대로 사용) |
| SEO | metadataBase/OG/sitemap/robots가 새 도메인으로 자동 전환됨. 검색엔진 재등록 필요 |
| 보안 헤더 | `next.config.ts`의 HSTS preload 미적용 주석 — 도메인 연결 후 preload 등록 검토 대상 |
| 오프라인 자료 | 매장 배너·명함·POP·SNS 프로필 링크 등에 vercel.app 주소가 노출되어 있다면 교체 필요 (이 프로젝트 핵심 목표인 오프라인 방문 유도와 직결) |
| 이메일/서치어드바이저/카카오 채널 | 별도 결정 필요 (아래 "보류 항목" 참고) |

## 실행 단계

### 1단계 — 사전 준비 (도메인 연결 전)
- [ ] 도메인 등록기관(가비아/후이즈/Route53 등) 로그인 정보 확보
- [ ] Vercel 프로젝트 오너/관리자 권한 확인
- [ ] apex(`workupkorea.com`)와 `www.workupkorea.com` 중 정식 URL(primary)을 무엇으로 할지 결정 — 보통 apex를 primary로 하고 www는 리다이렉트

### 2단계 — Vercel에 도메인 추가
- [ ] Vercel 프로젝트 → Settings → Domains → `workupkorea.com` 추가
- [ ] `www.workupkorea.com`도 함께 추가 (Vercel이 자동으로 primary 쪽으로 리다이렉트 구성)
- [ ] Vercel이 안내하는 DNS 레코드 확인 (일반적으로 apex는 A 레코드, www는 CNAME)

### 3단계 — 등록기관 DNS 설정
- [ ] 등록기관 DNS 관리 화면에서 Vercel이 안내한 레코드값 입력
- [ ] 기존에 다른 용도(메일 등)로 쓰던 레코드가 있는지 먼저 확인 후 덮어쓰지 않도록 주의
- [ ] DNS 전파 대기 (수 분~48시간, 보통 1시간 이내)

### 4단계 — 환경변수 반영
- [ ] Vercel 프로젝트 → Settings → Environment Variables
- [ ] `NEXT_PUBLIC_SITE_URL=https://workupkorea.com` 추가 (Production 환경)
- [ ] 재배포(redeploy) 트리거 — 환경변수는 재배포해야 반영됨

### 5단계 — 검증
- [ ] `https://workupkorea.com` 접속 및 SSL 인증서 자동 발급 확인 (Vercel이 자동 처리)
- [ ] `www.workupkorea.com` → primary 도메인 301 리다이렉트 확인
- [ ] `/sitemap.xml`, `/robots.txt`에 새 도메인이 정상 반영됐는지 확인
- [ ] 카카오톡 공유/문자 공유 시 OG 미리보기 이미지·타이틀 정상 노출 확인 (모바일에서 실제 공유 테스트)
- [ ] 모바일에서 매장 찾기 → 길찾기 → 전화/카톡 문의 CTA 플로우 정상 작동 확인
- [ ] 관리자 페이지(`/admin`) 접근 정상 확인

### 6단계 — SEO 사후 조치
- [ ] 구글 서치콘솔에 `workupkorea.com` 속성 신규 등록, 새 sitemap 제출
- [ ] 네이버 서치어드바이저에 신규 사이트 등록, 사이트 검증 및 sitemap 제출
- [ ] 기존 `*.vercel.app` 주소가 외부(SNS 프로필, 명함, 매장 배너, 블로그 등)에 노출된 곳이 있는지 전수 점검 후 새 도메인으로 교체
- [ ] (선택) HSTS preload 등록: 도메인이 안정적으로 연결된 후 [hstspreload.org](https://hstspreload.org)에 제출 → 승인되면 `next.config.ts`의 `Strict-Transport-Security` 값에 `preload` 지시어 추가

## 보류 항목 (추가 확인 필요)

- **도메인 이메일**(`info@workupkorea.com` 등) 사용 여부 — 필요 시 MX 레코드 설정 별도 작업
- **카카오톡 채널/비즈니스 채널** 연동 링크에 도메인이 참조되는지 점검
- 위 두 가지는 아직 결정되지 않아 이번 실행 단계에서는 제외했습니다. 필요하면 알려주세요.

## 롤백 방법

문제 발생 시 Vercel Domains 설정에서 `workupkorea.com` 연결을 해제하면 기존 `*.vercel.app` 주소로 즉시 복귀 가능. `NEXT_PUBLIC_SITE_URL` 환경변수도 함께 제거하면 `lib/site.ts`가 자동으로 Vercel 기본 주소를 fallback으로 사용.
