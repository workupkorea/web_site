const form = document.querySelector('#apply');
const activity = document.querySelector('#activity-text');
const activityToggle = document.querySelector('#activity-toggle');
const phoneInput = document.querySelector('#phone');
const region = document.querySelector('#region');
const store = document.querySelector('#store');
const storeList = document.querySelector('#store-list');
const storeStatus = document.querySelector('#store-status');
const receipt = document.querySelector('#receipt');
const preview = document.querySelector('#preview');
const message = document.querySelector('#message');
const submit = document.querySelector('#submit');
const success = document.querySelector('#success');
const MAX_VISIBLE_STORES = 30;
const DEFAULT_STORE_HINT = '지역명을 입력하면 근처 지점을 고를 수 있어요.';

/* ---------- 응모 현황 롤링 (테스트 예시 데이터) ---------- */
const exampleStores = ['성수점','롯데몰 청량리점','송파 문정점','인천 송도점','파주문산점'];
const randomIndex = length => Math.floor(Math.random() * length);
let storeIndex = randomIndex(exampleStores.length);
let people = 2 + randomIndex(2);
let paused = false; // 폰의 '동작 줄이기' 설정과 무관하게 롤링 시작 (일시정지 버튼 제공)
function renderActivity() {
  activity.textContent = exampleStores[storeIndex] + '에서 ' + people + '명이 응모했습니다.';
  activity.classList.remove('roll');
  void activity.offsetWidth;
  activity.classList.add('roll');
}
function updateActivityControl() {
  activityToggle.hidden = false;
  activityToggle.textContent = paused ? '▶' : 'Ⅱ';
  activityToggle.setAttribute('aria-label', paused ? '응모 현황 롤링 재생' : '응모 현황 롤링 일시정지');
}
activityToggle.addEventListener('click', () => { paused = !paused; updateActivityControl(); });
renderActivity();
updateActivityControl();
setInterval(() => {
  if (paused || document.hidden) return;
  storeIndex = (storeIndex + 1 + randomIndex(exampleStores.length - 1)) % exampleStores.length;
  people = 2 + randomIndex(2);
  renderActivity();
}, 6500);

/* ---------- 휴대폰 번호 자동 하이픈 ---------- */
phoneInput.addEventListener('input', () => {
  const digits = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  phoneInput.value = digits.replace(/^(\d{3})(\d{1,4})?(\d{1,4})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
});

/* ---------- 방문 매장: 지역명 입력 → 지점 선택 ---------- */
let allStores = [];
let storesLoaded = false;
const squash = value => value.replace(/\s+/g, '').toLowerCase();

/* ---------- 영문 자판으로 친 한글 변환 (예: wpwn → 제주) ---------- */
const KEY_JAMO = {
  q:'ㅂ',w:'ㅈ',e:'ㄷ',r:'ㄱ',t:'ㅅ',y:'ㅛ',u:'ㅕ',i:'ㅑ',o:'ㅐ',p:'ㅔ',
  a:'ㅁ',s:'ㄴ',d:'ㅇ',f:'ㄹ',g:'ㅎ',h:'ㅗ',j:'ㅓ',k:'ㅏ',l:'ㅣ',
  z:'ㅋ',x:'ㅌ',c:'ㅊ',v:'ㅍ',b:'ㅠ',n:'ㅜ',m:'ㅡ',
  Q:'ㅃ',W:'ㅉ',E:'ㄸ',R:'ㄲ',T:'ㅆ',O:'ㅒ',P:'ㅖ'
};
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VOWEL_MIX = {'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
const FINAL_MIX = {'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
function keysToHangul(text) {
  let out = '', cho = '', jung = '', jong = '';
  const flush = () => {
    if (cho && jung) out += String.fromCharCode(0xAC00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong));
    else out += cho + jung;
    cho = jung = jong = '';
  };
  for (const ch of text) {
    const jamo = KEY_JAMO[ch] ?? KEY_JAMO[ch.toLowerCase()];
    if (!jamo) { flush(); out += ch; continue; }
    if (JUNG.includes(jamo)) {
      if (jong) { // 받침은 다음 글자의 초성으로 넘어간다
        const pair = Object.entries(FINAL_MIX).find(([, value]) => value === jong);
        const keep = pair ? pair[0][0] : '';
        const move = pair ? pair[0][1] : jong;
        jong = keep; flush(); cho = move; jung = jamo; continue;
      }
      if (jung) {
        const mixed = VOWEL_MIX[jung + jamo];
        if (mixed) { jung = mixed; continue; }
        flush();
      }
      jung = jamo; continue;
    }
    if (!jung) { if (cho) flush(); cho = jamo; continue; }
    if (!cho) { flush(); cho = jamo; continue; }
    if (!jong) { if (JONG.includes(jamo)) { jong = jamo; continue; } flush(); cho = jamo; continue; }
    const mixed = FINAL_MIX[jong + jamo];
    if (mixed) { jong = mixed; continue; }
    flush(); cho = jamo;
  }
  flush();
  return out;
}

function setStoreStatus(text) { storeStatus.textContent = text; }
function selectStore(name) {
  store.value = name;
  for (const input of storeList.querySelectorAll('input')) {
    input.checked = input.value === name;
    input.closest('.store-option').classList.toggle('selected', input.checked);
  }
  setStoreStatus(name ? name + ' 선택됨' : DEFAULT_STORE_HINT);
}
function storeOption(item) {
  const label = document.createElement('label');
  label.className = 'store-option';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'store-pick';
  input.value = item.name;
  input.checked = item.name === store.value;
  input.addEventListener('change', () => {
    // 선택하면 방문 매장 칸에 이름을 채우고 목록을 닫는다
    showMessage('');
    setError('store', '');
    region.value = item.name;
    selectStore(item.name);
    storeList.hidden = true;
  });
  const text = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = item.name;
  text.append(title);
  label.append(input, text);
  label.classList.toggle('selected', input.checked);
  return label;
}
function renderStores() {
  const raw = region.value.trim();
  const query = squash(raw);
  storeList.replaceChildren();
  if (!query) {
    storeList.hidden = true;
    if (!store.value) setStoreStatus(storesLoaded ? DEFAULT_STORE_HINT : '매장 목록을 불러오는 중이에요…');
    return;
  }
  // 영문 자판으로 친 한글(wpwn → 제주)도 함께 검색한다
  const converted = /[a-z]/i.test(raw) ? squash(keysToHangul(raw)) : '';
  const queries = converted && converted !== query ? [query, converted] : [query];
  const matches = allStores.filter(item => {
    const target = squash(item.name + item.address);
    return queries.some(text => target.includes(text));
  });
  const shown = queries.length > 1 && matches.length ? '‘' + raw + '’ → ‘' + converted + '’' : '‘' + raw + '’';
  if (!matches.length) {
    storeList.hidden = true;
    setStoreStatus('‘' + raw + '’ 지역의 매장을 찾지 못했어요. 다른 지역명으로 입력해 보세요.');
    return;
  }
  storeList.append(...matches.slice(0, MAX_VISIBLE_STORES).map(storeOption));
  storeList.hidden = false;
  const extra = matches.length - MAX_VISIBLE_STORES;
  setStoreStatus((queries.length > 1 ? shown + '(으)로 검색했어요. ' : '') + matches.length + '개 지점이 있어요. 방문한 지점을 선택해 주세요.' + (extra > 0 ? ' (지역을 더 자세히 입력하면 좁혀져요)' : ''));
}
region.addEventListener('input', () => {
  // 선택한 뒤 입력을 고치면 선택을 풀고 다시 검색한다
  if (store.value && region.value !== store.value) store.value = '';
  setError('store', '');
  renderStores();
});
// 선택된 상태에서 칸을 누르면 전체 선택 → 바로 다시 입력 가능
region.addEventListener('focus', () => { if (store.value) region.select(); });
region.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });

async function loadStores() {
  try {
    const response = await fetch('/goldenbell/api/stores');
    if (!response.ok) throw Error('Load failed');
    allStores = (await response.json()).stores || [];
    storesLoaded = true;
    // ?store=성수점 링크로 들어오면 해당 지점을 미리 선택
    const preferred = new URLSearchParams(location.search).get('store')?.trim().slice(0, 60);
    if (preferred) {
      const found = allStores.find(item => item.name === preferred) || allStores.find(item => item.name.includes(preferred));
      region.value = found ? found.name : preferred;
      if (found) store.value = found.name;
    }
    renderStores();
    if (store.value) { region.value = store.value; selectStore(store.value); storeList.hidden = true; }
  } catch {
    setStoreStatus('매장 목록을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
  }
}
loadStores();

/* ---------- 입력 검증 (항목별 즉시 안내) ---------- */
const nameInput = document.querySelector('#name');
const consent = document.querySelector('#consent');
function setError(id, text) {
  const el = document.querySelector('#' + id + '-error');
  el.textContent = text;
  el.hidden = !text;
}
const checks = {
  name: () => nameInput.value.trim() ? '' : '이름을 입력해 주세요.',
  phone: () => /^010\d{8}$/.test(phoneInput.value.replace(/\D/g, '')) ? '' : '010으로 시작하는 휴대폰 번호를 확인해 주세요.',
  store: () => store.value ? '' : '방문 매장을 선택해 주세요. 지역명을 입력하면 지점이 나타나요.',
  receipt: () => receipt.files[0] ? '' : '영수증 사진을 첨부해 주세요.',
  consent: () => consent.checked ? '' : '개인정보 수집·이용에 동의해 주세요.'
};
const fieldFocus = {name: nameInput, phone: phoneInput, store: region, receipt, consent};
for (const key of ['name', 'phone']) {
  fieldFocus[key].addEventListener('blur', () => { if (fieldFocus[key].value) setError(key, checks[key]()); });
  fieldFocus[key].addEventListener('input', () => setError(key, ''));
}
consent.addEventListener('change', () => setError('consent', ''));

/* ---------- 영수증 (큰 사진은 올리기 전에 줄인다) ---------- */
const MAX_UPLOAD = 4 * 1024 * 1024; // 서버 함수 요청 한도(4.5MB) 안쪽
const MAX_RAW = 30 * 1024 * 1024;
const RESIZE_ABOVE = 1.5 * 1024 * 1024;
const MAX_EDGE = 2000;
let photoUrl;
function showMessage(value) { message.textContent = value; message.hidden = !value; }
function clearPhoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = undefined;
  preview.removeAttribute('src');
  preview.hidden = true;
}
async function shrink(file, maxEdge = MAX_EDGE, quality = 0.85, force = false) {
  if (!force && file.size <= RESIZE_ABOVE) return file;
  try {
    const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob && blob.size < file.size ? new File([blob], 'receipt.jpg', {type: 'image/jpeg'}) : file;
  } catch { return file; }
}
receipt.addEventListener('change', () => {
  clearPhoto();
  showMessage('');
  setError('receipt', '');
  const file = receipt.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_RAW) {
    receipt.value = '';
    setError('receipt', 'JPG·PNG·WEBP 사진을 선택해 주세요. (30MB 이하)');
    return;
  }
  photoUrl = URL.createObjectURL(file);
  preview.src = photoUrl;
  preview.hidden = false;
});

/* ---------- 응모 완료: 매장 방문 유도 (길찾기·전화) ---------- */
function showVisit(storeName) {
  const item = allStores.find(entry => entry.name === storeName);
  const box = document.querySelector('#visit');
  box.hidden = !item;
  if (!item) return;
  document.querySelector('#visit-name').textContent = item.name;
  document.querySelector('#visit-address').textContent = item.address;
  const hours = document.querySelector('#visit-hours');
  hours.textContent = item.hours ? '운영시간 ' + item.hours : '';
  hours.hidden = !item.hours;
  const route = document.querySelector('#visit-route');
  // 카카오맵 길찾기: 좌표는 위도,경도 순서. 좌표가 없으면 주소 검색으로 대체
  route.href = item.lat && item.lng
    ? 'https://map.kakao.com/link/to/' + encodeURIComponent(item.name) + ',' + item.lat + ',' + item.lng
    : 'https://map.kakao.com/link/search/' + encodeURIComponent(item.address);
  const call = document.querySelector('#visit-call');
  const digits = (item.phone || '').replace(/[^\d+]/g, '');
  call.hidden = !digits;
  if (digits) call.href = 'tel:' + digits;
}

/* ---------- 제출 ---------- */
form.addEventListener('submit', async event => {
  event.preventDefault();
  showMessage('');
  let firstInvalid;
  for (const key of Object.keys(checks)) {
    const text = checks[key]();
    setError(key, text);
    if (text && !firstInvalid) firstInvalid = fieldFocus[key];
  }
  if (firstInvalid) { firstInvalid.focus(); return; }
  submit.disabled = true;
  submit.textContent = '접수 중…';
  try {
    let upload = await shrink(receipt.files[0]);
    if (upload.size > MAX_UPLOAD) upload = await shrink(upload, 1600, 0.7, true); // 그래도 크면 한 번 더 줄인다
    if (upload.size > MAX_UPLOAD) { setError('receipt', '사진이 너무 커요. 다른 사진을 선택해 주세요.'); return; }
    const data = new FormData(form);
    data.set('receipt', upload, upload.name);
    const response = await fetch('/goldenbell/api/entries', {method: 'POST', body: data});
    const result = await response.json();
    if (!response.ok) { showMessage(result.error || '응모를 완료하지 못했어요.'); return; }
    form.hidden = true;
    success.hidden = false;
    document.querySelector('#result').textContent = result.store + ' · 접수번호 ' + result.code;
    showVisit(result.store);
    success.focus();
  } catch {
    showMessage('연결을 확인한 뒤 다시 눌러주세요.');
  } finally {
    submit.disabled = false;
    submit.textContent = '응모하기';
  }
});
document.querySelector('#again').addEventListener('click', () => {
  clearPhoto();
  receipt.value = '';
  success.hidden = true;
  form.hidden = false;
  receipt.focus();
});

/* ---------- 내 응모 확인 ---------- */
const lookupForm = document.querySelector('#lookup');
const lookupPhone = document.querySelector('#lookup-phone');
const lookupList = document.querySelector('#lookup-list');
const statusText = {pending: '검수 중', approved: '승인', rejected: '반려'};
const lookupDate = new Intl.DateTimeFormat('ko-KR', {dateStyle: 'medium', timeZone: 'Asia/Seoul'});
lookupPhone.addEventListener('input', () => {
  const digits = lookupPhone.value.replace(/\D/g, '').slice(0, 11);
  lookupPhone.value = digits.replace(/^(\d{3})(\d{1,4})?(\d{1,4})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
  setError('lookup', '');
});
lookupForm.addEventListener('submit', async event => {
  event.preventDefault();
  lookupList.replaceChildren();
  if (!/^010\d{8}$/.test(lookupPhone.value.replace(/\D/g, ''))) { setError('lookup', '010으로 시작하는 휴대폰 번호를 확인해 주세요.'); return; }
  setError('lookup', '');
  try {
    const response = await fetch('/goldenbell/api/entries/lookup', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({phone: lookupPhone.value})});
    const data = await response.json();
    if (!response.ok) { setError('lookup', data.error || '조회하지 못했어요.'); return; }
    if (!data.entries.length) { setError('lookup', '이 번호로 접수된 응모가 없어요.'); return; }
    lookupList.append(...data.entries.map(entry => {
      const li = document.createElement('li');
      li.className = 'lookup-item ' + entry.status;
      const head = document.createElement('div');
      head.className = 'lookup-head';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = statusText[entry.status];
      const code = document.createElement('small');
      code.textContent = '접수번호 ' + entry.code;
      head.append(badge, code);
      const meta = document.createElement('p');
      meta.className = 'lookup-meta';
      const part = (label, value) => {
        const span = document.createElement('span');
        span.textContent = label + ': ' + value;
        return span;
      };
      meta.append(part('응모일자', lookupDate.format(new Date(entry.created_at))), part('응모지점', entry.store));
      li.append(head, meta);
      if (entry.reason) {
        const reason = document.createElement('small');
        reason.className = 'lookup-reason';
        reason.textContent = '반려 사유: ' + entry.reason;
        li.append(reason);
      }
      return li;
    }));
  } catch { setError('lookup', '연결을 확인한 뒤 다시 눌러주세요.'); }
});

/* ---------- 개인정보 동의 팝업 ---------- */
const consentDialog = document.querySelector('#consent-dialog');
document.querySelector('#consent-open').addEventListener('click', () => consentDialog.showModal());
document.querySelector('#consent-close').addEventListener('click', () => consentDialog.close());
document.querySelector('#consent-agree').addEventListener('click', () => { consent.checked = true; setError('consent', ''); consentDialog.close(); });
consentDialog.addEventListener('click', event => { if (event.target === consentDialog) consentDialog.close(); });

/* ---------- 내 응모 확인 팝업 ---------- */
const lookupDialog = document.querySelector('#lookup-dialog');
document.querySelector('#lookup-open').addEventListener('click', () => { lookupDialog.showModal(); lookupPhone.focus(); });
document.querySelector('#lookup-close').addEventListener('click', () => lookupDialog.close());
lookupDialog.addEventListener('click', event => { if (event.target === lookupDialog) lookupDialog.close(); });
