# WORKUP 전단 스튜디오

- 접속: `/admin/print-studio` (기존 관리자 로그인 필요)
- 관리자 메뉴: 지점 및 상품관리 → 전단 스튜디오
- 상단 **서버 저장**: 사진·배치·문구·CMYK·재단선을 포함한 원본을 Supabase 비공개 저장소에 보관
- **내 전단**: 같은 계정으로 다른 PC에서 작업 열기
- **작업 저장 / 불러오기**: 기존 단일 HTML 작업 JSON 파일과 호환
- **사진 → W주문 상품 검색**: 기존 암호화 계정 연동을 사용해 조회 시점의 상품명·판매가·확대 사진 읽기
- **저장된 상품 자료**: 2026-11-13에 확보한 상품 정보 21,666개와 이미지 65개 사용

## 기존 편집 기능

12개 레이아웃, 칸 합치기·나누기, 줄별 칸 수·높이, 개별 상단 영역 편집, WORKUP 로고, Pretendard, 사진 확대·전체 적용, 상품 번호, 전체·부분 색상, 접었을 때 작게 표시되는 CMYK 피커, 재단선, CMYK PDF와 브라우저 인쇄를 유지한다. 자동 여백 자르기는 추가하지 않았다.

## 저장 구조

`supabase/migrations/20261113_print_studio.sql`을 1회 적용한다. `print_studio_projects`는 기존 관리자 세션을 확인한 서버에서만 접근하고, 객체는 `print-studio-private` 버킷에 보관한다. 원본은 서명된 업로드 URL로 직접 올리므로 Vercel 함수 요청 크기 제한을 피한다. 계정별 조회와 revision 비교로 다른 계정 접근 및 동시 편집 덮어쓰기를 방지한다.

비공개 상품 자료는 이 공개 저장소에 커밋하지 않는다. 초기 상품 자료와 사진은 같은 버킷의 `shared/` 아래 있으며, 인증된 `/api/admin/print-studio/catalog` 라우트로만 읽는다. 폰트는 Pretendard 공식 배포의 버전을 고정한 CDN을 사용하고 CMYK PDF를 만들 때 파일 안에 포함한다.

기존 환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WJUMUN_CRED_KEY`와 기존 W주문 연동 설정을 사용한다. 비밀번호나 서비스 키를 브라우저로 전달하지 않는다. 별도 크롬 확장 기능은 필요 없다.

## 검증

```sh
node scripts/verify-print-studio.cjs
npx tsc --noEmit --incremental false
npm run build
```

관리자 계정으로 전단을 연 뒤 W주문 검색 → 상품 넣기 → 서버 저장 → 내 전단에서 다시 열기 → CMYK PDF 저장 순서로 점검한다. 로그아웃 상태에서 editor/projects/products/catalog/image API가 401을 반환하는지도 확인한다. 기존 JSON 원본은 별도로 보관할 수 있다.

## 이번 작업 검증 결과

- TypeScript 타입 검사 및 전단 편집기 기능 검사 통과
- W주문 상품 실조회 및 확대 사진 HTTP 응답 확인
- 실제 Supabase 서명 업로드·다운로드와 원본 저장·불러오기 통과
- 다른 계정 접근(404), 미로그인(401), 외부 출처 요청(403), 오래된 revision(409) 검증 통과
- 전체 Next.js 빌드는 실행 환경의 디렉터리 생성 권한 오류로 미완료
- 로컬 브라우저 미리보기 연결 제한으로 화면 최종 점검은 배포 후 필요
- 공개 GitHub 저장소 업로드가 자동 승인 검토에서 거절돼 미배포 상태
