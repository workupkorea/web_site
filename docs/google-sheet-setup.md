# 문의 → 구글시트 + 담당자 이메일 연동 (Apps Script 웹앱)

가맹·창업 / 입점·제휴 / 고객 1:1 문의가 접수되면 **구글시트에 한 줄씩 누적**되고,
설정 시 **담당자 이메일로도 자동 발송**됩니다. 둘 다 **Apps Script 웹앱 하나**로 처리합니다(별도 메일 서비스 불필요).

대상 시트: https://docs.google.com/spreadsheets/d/1-kJNKYOBv9Z3SdI9AtrCM0HORQBMT4J88HnqvbAom_E/edit

> ⚠️ "구글시트에 수집이 안 된다"의 90%는 **(1) Vercel 환경변수 `GOOGLE_SHEET_WEBHOOK_URL` 미설정** 또는 **(2) 웹앱 액세스 권한이 '모든 사용자'가 아님** 입니다.
> 관리자 **문의 관리 → 알림 설정 → 테스트 전송** 버튼으로 즉시 원인을 확인할 수 있습니다.

---

## 1) 탭(시트) 구성 — 1개도, 유형별 여러 개도 OK
- **1개 탭**만 두면 모든 문의가 그 탭에 쌓입니다.
- **유형별로 나누고 싶으면** 탭 이름에 키워드를 넣어 두세요. 아래 코드가 자동으로 알맞은 탭에 기록합니다(없으면 새 탭을 만듭니다).
  - 가맹·창업 → 이름에 `가맹` 또는 `franchise` 포함 탭
  - 입점·제휴 → 이름에 `제휴`·`입점` 또는 `partnership` 포함 탭
  - 고객 1:1 → 이름에 `고객`·`1:1` 또는 `support` 포함 탭 (없으면 `고객문의(support)` 자동 생성)
  - → 지금처럼 **가맹(franchise)`, `제휴(partnership)` 2개 탭이면 정상 동작합니다.**

각 탭 첫 행 헤더(권장):

| 접수시각 | 유형 | 이름 | 연락처 | 지역/품목/구분 | 브랜드 | 링크 | 내용 |
|---|---|---|---|---|---|---|---|

## 2) Apps Script 코드 붙여넣기
1. 구글시트 상단 **확장 프로그램 → Apps Script**
2. 기존 코드를 지우고 아래를 붙여넣고 **저장(💾)**:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) {}

  var type = d.type || 'franchise';
  var typeLabel = d.type_label ||
    (type === 'wholesale' ? '입점·제휴' : type === 'support' ? '고객 1:1' : '가맹·창업');
  var name = d.name || d.manager || '';
  var extra = d.region || d.category || d.subject || '';   // 지역 / 취급품목 / 문의구분

  // 유형에 맞는 탭 선택(없으면 자동 생성) + 헤더 자동 추가
  var sheet = pickSheet(ss, type);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['접수시각','유형','이름','연락처','지역/품목/구분','브랜드','링크','내용']);
  }
  sheet.appendRow([
    d.submitted_at || new Date(),
    typeLabel, name, d.phone || '', extra, d.brand || '', d.link || '', d.message || ''
  ]);

  // 담당자 이메일 발송 (notify_email 이 있을 때만)
  if (d.notify_email) {
    try {
      // 제목: [워크업] 문의제목 / 담당자명 (사이트가 mail_subject로 내려줌, 없으면 직접 조합)
      var subject = d.mail_subject ||
        ('[워크업] ' + (d.title || typeLabel) + ' / ' + (name || '이름없음'));
      // 본문: 표(HTML) + 표를 못 보는 환경용 일반 텍스트
      var when = d.submitted_at
        ? Utilities.formatDate(new Date(d.submitted_at), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '';
      var rows = [['유형', typeLabel], ['문의 제목', d.title || ''], ['이름', name], ['연락처', d.phone || '']];
      if (extra)   rows.push(['지역/품목/구분', extra]);
      if (d.brand) rows.push(['브랜드', d.brand]);
      if (d.link)  rows.push(['링크', d.link]);
      // 첨부파일: 합계 20MB 이하면 메일에 직접 첨부, 못 붙이면 다운로드 링크(7일 유효)로 대체
      var files = d.attachments || [], blobs = [], totalSize = 0, fetchErr = '';
      files.forEach(function (f) { totalSize += f.size || 0; });
      if (files.length && totalSize <= 20 * 1024 * 1024) {
        files.forEach(function (f) {
          try { blobs.push(UrlFetchApp.fetch(f.url).getBlob().setName(f.name)); }
          catch (fe) { fetchErr = String(fe); }
        });
      }
      var allAttached = files.length > 0 && blobs.length === files.length;
      if (files.length) {
        rows.push(['첨부파일', allAttached ? files.length + '개 (메일에 첨부됨)'
          : (totalSize > 20 * 1024 * 1024 ? '용량이 커서 링크로 대체 (7일 유효)' : '첨부 실패, 링크로 대체 (7일 유효)')]);
        if (!allAttached) files.forEach(function (f) { rows.push(['└ ' + f.name, { link: f.url, text: '다운로드' }]); });
      }
      rows.push(['내용', d.message || '']);
      rows.push(['접수시각', when]);
      var esc = function (v) {
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      };
      var cell = function (v) {
        return (v && typeof v === 'object') ? '<a href="' + esc(v.link) + '">' + esc(v.text) + '</a>' : esc(v);
      };
      var html = '<table style="border-collapse:collapse;table-layout:fixed;width:640px;max-width:100%;font-size:14px">' +
        rows.map(function (r) {
          return '<tr><th style="width:130px;background:#f3f4f6;border:1px solid #d1d5db;padding:8px 12px;text-align:left;vertical-align:top;word-break:break-all">' +
            esc(r[0]) + '</th><td style="border:1px solid #d1d5db;padding:8px 12px;word-break:break-all">' + cell(r[1]) + '</td></tr>';
        }).join('') + '</table>';
      var text = rows.map(function (r) { return r[0] + ': ' + (r[1] && r[1].link ? r[1].link : r[1]); }).join('\n');
      MailApp.sendEmail(d.notify_email, subject, text, { htmlBody: html, attachments: blobs });
    } catch (mailErr) { /* 메일 실패는 무시(시트 기록은 유지) */ }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 유형에 맞는 탭을 이름 키워드로 찾고, 없으면 새 탭을 만든다.
function pickSheet(ss, type) {
  var keys = type === 'wholesale' ? ['partnership', '제휴', '입점']
           : type === 'support'   ? ['support', '고객', '1:1']
           :                        ['franchise', '가맹', '창업'];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var nm = sheets[i].getName().toLowerCase();
    for (var j = 0; j < keys.length; j++) {
      if (nm.indexOf(keys[j].toLowerCase()) !== -1) return sheets[i];
    }
  }
  var newName = type === 'wholesale' ? '제휴(partnership)'
              : type === 'support'   ? '고객문의(support)'
              :                        '가맹(franchise)';
  return ss.insertSheet(newName);
}
```

## 3) 웹앱으로 배포
1. 오른쪽 위 **배포 → 새 배포**
2. ⚙️(유형 선택) → **웹 앱**
3. 설정:
   - 실행 계정: **나(본인)**
   - 액세스 권한: **모든 사용자**  ← 중요 (이게 있어야 사이트가 호출 가능)
4. **배포** → **권한 승인**(본인 구글 계정)
   - 이때 "Gmail 발송" 권한 동의가 함께 뜹니다 — 이메일 발송 기능에 필요하니 **허용**하세요.
5. **웹 앱 URL 복사** (형식: `https://script.google.com/macros/s/XXXXX/exec`)

## 4) 사이트에 URL 등록
- **Vercel** → 프로젝트 → Settings → Environment Variables →
  - Name: `GOOGLE_SHEET_WEBHOOK_URL`
  - Value: 복사한 `…/exec` URL
  - Production·Preview 모두 체크 → 저장 → **재배포**
- (로컬 테스트 시) `.env.local` 에도 `GOOGLE_SHEET_WEBHOOK_URL=...`

## 5) 담당자 이메일 켜기
- 관리자 **문의 관리 → 알림 설정** 탭에서
  - "문의 접수 시 담당자 이메일로 발송" 체크
  - 담당자 이메일 입력 → 저장
- **테스트 전송** 버튼으로 시트 행 + 메일 도착을 즉시 확인하세요.

---

### ⚠️ 테스트에서 "HTTP 401" + docs.google.com HTML 이 나올 때 (가장 흔함)
URL은 맞지만 **웹앱 액세스 권한이 '모든 사용자'가 아니어서** 구글이 로그인 페이지를 돌려준 것입니다. 다음으로 고칩니다:
1. Apps Script 편집기 → 오른쪽 위 **배포 → 배포 관리**
2. 현재 배포의 **연필(편집)** 클릭
3. **액세스 권한 → "모든 사용자"** 로 변경 *(주의: "Google 계정이 있는 모든 사용자"가 아니라 그냥 "모든 사용자")*
4. **버전: 새 버전** 선택 → **배포**
5. (URL은 그대로 유지됩니다) 관리자 **알림 설정 → 테스트 전송** 다시 → "전송 성공" 확인

### 참고 / 문제 해결
- **수집이 안 될 때**: 알림 설정 → 테스트 전송 결과를 보세요.
  - "미설정" → Vercel에 `GOOGLE_SHEET_WEBHOOK_URL` 등록 후 재배포.
  - "HTTP 401/403" → 위 ⚠️ 항목(액세스 권한 '모든 사용자').
  - "HTTP 302/200인데 행이 없음" → 코드 수정 후 **새 버전 배포** 누락, 또는 탭 키워드 불일치.
- 시트/메일 전송이 실패해도 **문의 접수(Supabase 저장)는 정상 처리**됩니다. 보조 누적/알림용입니다.
- **코드를 수정하면 반드시** "배포 → 배포 관리 → 편집(연필) → 새 버전 → 배포" 로 재배포해야 반영됩니다.
- 이메일은 본인 구글 계정으로 발송됩니다(일반 Gmail 1일 약 100통, Workspace 약 1,500통 한도).
