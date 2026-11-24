const form = document.querySelector('#apply');
const entryIntro = document.querySelector('#entry-intro');
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
const isInstantPreview = document.body.classList.contains('instant-preview');
const submitLabel = submit.textContent;
const soldOutMessage = document.querySelector('#preview-sold-out');
const drawUrl = '/goldenbell/api/v2/draw';
const scratchTicket = document.querySelector('#scratch-ticket');
const scratchSurface = document.querySelector('#scratch-surface');
const scratchOutcome = document.querySelector('#scratch-outcome');
const scratchCover = document.querySelector('#scratch-cover');
const scratchContext = scratchCover?.getContext('2d', {willReadFrequently: true});
const scratchProgressRow = document.querySelector('#scratch-progress-row');
const scratchProgress = document.querySelector('#scratch-progress');
const scratchPercent = document.querySelector('#scratch-percent');
const scratchAnnouncement = document.querySelector('#scratch-announcement');
const scratchInstructions = document.querySelector('#scratch-instructions');
const SCRATCH_TARGET = 55;
const SCRATCH_RESULT_HOLD = 2000;
let pendingReveal;
let scratchPointer;
let lastScratchPoint;
let lastCoverageCheck = 0;
let scratchPass = 0;
let scratchChecking = false;
let drawId;
const MAX_VISIBLE_STORES = 30;
const DEFAULT_STORE_HINT = '지역명을 입력하면 근처 지점을 고를 수 있어요.';

/* ---------- 경품 카드 애니메이션 ---------- */
const coffeeFill = document.querySelector('.coffee-fill');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (coffeeFill && 'IntersectionObserver' in window) {
  const prizes = coffeeFill.closest('.prizes');
  const track = coffeeFill.querySelector('.coffee-fill-track');
  const cupsPerRow = 10;
  const rows = track.childElementCount / cupsPerRow;
  const rowTime = 16000 / rows;
  const nextRowStart = 30;
  let visible = false;
  let frame;
  let lastTime;
  let elapsed = 0;
  let rowHeight;

  function animate(now) {
    if (lastTime !== undefined) elapsed += now - lastTime;
    lastTime = now;
    const completedRows = Math.floor(elapsed / rowTime);
    if (completedRows > 0) {
      // Move rows that left the viewport to the bottom, preserving the visible sequence.
      const movedCups = (completedRows % rows) * cupsPerRow;
      if (movedCups) {
        const outgoing = Array.from(track.children).slice(0, movedCups);
        outgoing.forEach(cup => cup.classList.remove('is-generated'));
        track.append(...outgoing);
      }
      elapsed %= rowTime;
    }
    const generated = 1 + Math.floor(elapsed / rowTime * cupsPerRow);
    for (let index = 0; index < generated; index++) {
      track.children[nextRowStart + index].classList.add('is-generated');
    }
    track.style.setProperty('--coffee-offset', `${-rowHeight * elapsed / rowTime}px`);
    frame = requestAnimationFrame(animate);
  }

  function updateMotion() {
    const playing = visible && !document.hidden && !reducedMotion.matches;
    prizes.classList.toggle('motion-playing', playing);
    if (playing) {
      if (frame === undefined) {
        rowHeight = track.children[cupsPerRow].getBoundingClientRect().top - track.firstElementChild.getBoundingClientRect().top;
        frame = requestAnimationFrame(animate);
      }
      return;
    }
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    lastTime = undefined;
    if (reducedMotion.matches) track.style.removeProperty('--coffee-offset');
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .15;
    updateMotion();
  }, {threshold: .15});
  observer.observe(coffeeFill);
  document.addEventListener('visibilitychange', updateMotion);
  reducedMotion.addEventListener?.('change', updateMotion);
}

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
if (activityToggle) {
  activityToggle.addEventListener('click', () => { paused = !paused; updateActivityControl(); });
  renderActivity();
  updateActivityControl();
  setInterval(() => {
    if (paused || document.hidden) return;
    storeIndex = (storeIndex + 1 + randomIndex(exampleStores.length - 1)) % exampleStores.length;
    people = 2 + randomIndex(2);
    renderActivity();
  }, 6500);
}

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
  consent: () => consent.checked ? '' : (isInstantPreview ? '테스트 응모 안내를 확인해 주세요.' : '개인정보 수집·이용에 동의해 주세요.')
};
const fieldFocus = {name: nameInput, phone: phoneInput, store: region, receipt, consent};
for (const key of ['name', 'phone']) {
  fieldFocus[key].addEventListener('blur', () => {
    const error = checks[key]();
    if (fieldFocus[key].value && error) setError(key, error);
  });
  fieldFocus[key].addEventListener('input', () => setError(key, ''));
}
consent.addEventListener('change', () => setError('consent', ''));

if (!isInstantPreview) {
  let phoneCheckTimer;
  let phoneCheckRequest;
  phoneInput.addEventListener('input', () => {
    clearTimeout(phoneCheckTimer);
    phoneCheckRequest?.abort();
    if (!phoneInput.value || checks.phone()) return;
    const phone = phoneInput.value;
    phoneCheckTimer = setTimeout(async () => {
      const request = new AbortController();
      phoneCheckRequest = request;
      try {
        const response = await fetch('/goldenbell/api/entries/check-phone', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({phone}), signal: request.signal
        });
        if (response.status !== 409) return;
        const result = await response.json();
        if (!request.signal.aborted && phoneInput.value === phone && !form.hidden) setError('phone', result.error);
      } catch { /* 응모 접수 시 다시 확인한다. */ }
    }, 250);
  });
}

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
const formatReceiptCode = code => 'GB-' + code;
function showSuccess(detail, storeName) {
  document.querySelector('#result').textContent = detail;
  if (isInstantPreview) showVisit(storeName);
  else entryIntro.hidden = true;
  form.hidden = true;
  success.hidden = false;
  success.focus();
}

function revealScratchResult() {
  if (!pendingReveal) return;
  const {outcome, storeName} = pendingReveal;
  pendingReveal = undefined;
  scratchPointer = undefined;
  scratchTicket.hidden = true;
  const won = outcome === 'won';
  success.dataset.draw = outcome;
  document.querySelector('#success-title').textContent = won ? '아메리카노에 당첨됐어요!' : '다음 기회에!';
  document.querySelector('#preview-delivery').hidden = !won;
  showSuccess(won ? '메가커피 아메리카노 1잔 · 테스트 당첨' : '이번 응모는 미당첨이에요. 참여해 주셔서 감사합니다.', storeName);
}

function openScratchTicket(outcome, storeName) {
  pendingReveal = {outcome, storeName};
  form.hidden = true;
  scratchTicket.hidden = false;
  lastCoverageCheck = 0;
  scratchPass = 0;
  scratchChecking = false;
  scratchSurface.removeAttribute('aria-disabled');
  scratchOutcome.textContent = '';
  scratchAnnouncement.textContent = '';
  scratchProgressRow.hidden = false;
  scratchProgress.value = 0;
  scratchPercent.textContent = '0%';
  scratchInstructions.textContent = '손가락이나 마우스로 복권을 긁어주세요.';
  if (!scratchContext) {
    scratchInstructions.textContent = '복권 영역을 여러 번 누르면 긁을 수 있어요.';
    scratchTicket.focus();
    return;
  }

  const {width, height} = scratchCover;
  const foil = scratchContext.createRadialGradient(width * .52, height * .4, 12, width * .52, height * .4, width * .65);
  foil.addColorStop(0, '#d9d6d0');
  foil.addColorStop(1, '#a6a39e');
  scratchContext.globalCompositeOperation = 'source-over';
  scratchContext.fillStyle = foil;
  scratchContext.fillRect(0, 0, width, height);
  scratchContext.fillStyle = '#53483a28';
  scratchContext.beginPath();
  for (let y = 8; y < height; y += 10) {
    for (let x = 8; x < width; x += 10) {
      scratchContext.moveTo(x + 1, y);
      scratchContext.arc(x, y, 1, 0, Math.PI * 2);
    }
  }
  scratchContext.fill();
  scratchContext.fillStyle = '#332a24';
  scratchContext.font = '700 21px system-ui, sans-serif';
  scratchContext.textAlign = 'center';
  scratchContext.textBaseline = 'middle';
  scratchContext.fillText('긁어서 열기', width / 2, height / 2);
  scratchContext.globalCompositeOperation = 'destination-out';
  scratchContext.lineWidth = 42;
  scratchContext.lineCap = 'round';
  scratchContext.fillStyle = '#000';
  scratchContext.strokeStyle = '#000';
  scratchTicket.focus();
}

function scratchPoint(event) {
  const rect = scratchCover.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * scratchCover.width / rect.width,
    y: (event.clientY - rect.top) * scratchCover.height / rect.height,
  };
}

function updateScratchProgress(percent, finishedGesture) {
  scratchProgress.value = percent;
  scratchPercent.textContent = `${percent}%`;
  if (!finishedGesture || percent < SCRATCH_TARGET || scratchChecking) return;
  scratchChecking = true;
  const won = pendingReveal.outcome === 'won';
  scratchOutcome.textContent = won ? '아메리카노 당첨!' : '다음 기회에!';
  scratchSurface.setAttribute('aria-disabled', 'true');
  scratchInstructions.textContent = '복권을 열었어요.';
  scratchProgressRow.hidden = true;
  scratchAnnouncement.textContent = won ? '당첨됐어요! 메가커피 아메리카노 1잔' : '이번에는 미당첨이에요. 다음 기회에!';
  window.setTimeout(revealScratchResult, SCRATCH_RESULT_HOLD);
}

function checkScratchCoverage(finishedGesture) {
  const {width, height} = scratchCover;
  const {data} = scratchContext.getImageData(0, 0, width, height);
  let sampled = 0;
  let cleared = 0;
  for (let y = 4; y < height; y += 8) {
    for (let x = 4; x < width; x += 8) {
      sampled++;
      if (data[(y * width + x) * 4 + 3] < 32) cleared++;
    }
  }
  updateScratchProgress(Math.floor(cleared / sampled * 100), finishedGesture);
}

function scratchNextBand() {
  if (!pendingReveal || scratchChecking || scratchPointer !== undefined) return;
  if (!scratchContext) {
    updateScratchProgress(Math.min(scratchProgress.value + 16, 100), true);
    return;
  }
  const bands = 6;
  const y = (scratchPass++ % bands + .5) * scratchCover.height / bands;
  scratchContext.beginPath();
  scratchContext.moveTo(0, y);
  scratchContext.lineTo(scratchCover.width, y);
  scratchContext.stroke();
  checkScratchCoverage(true);
}

scratchSurface?.addEventListener('keydown', event => {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  if (!event.repeat) scratchNextBand();
});
scratchSurface?.addEventListener('click', event => {
  if (!scratchContext || event.detail === 0) scratchNextBand();
});
if (scratchContext) {
  scratchCover.addEventListener('pointerdown', event => {
    if (!pendingReveal || scratchChecking || scratchPointer !== undefined || event.button !== 0) return;
    scratchPointer = event.pointerId;
    scratchCover.setPointerCapture(scratchPointer);
    lastScratchPoint = scratchPoint(event);
    scratchContext.beginPath();
    scratchContext.arc(lastScratchPoint.x, lastScratchPoint.y, scratchContext.lineWidth / 2, 0, Math.PI * 2);
    scratchContext.fill();
  });
  scratchCover.addEventListener('pointermove', event => {
    if (event.pointerId !== scratchPointer) return;
    const point = scratchPoint(event);
    scratchContext.beginPath();
    scratchContext.moveTo(lastScratchPoint.x, lastScratchPoint.y);
    scratchContext.lineTo(point.x, point.y);
    scratchContext.stroke();
    lastScratchPoint = point;
    if (event.timeStamp - lastCoverageCheck >= 100) {
      lastCoverageCheck = event.timeStamp;
      checkScratchCoverage(false);
    }
  });
  scratchCover.addEventListener('lostpointercapture', event => {
    if (event.pointerId !== scratchPointer) return;
    scratchPointer = undefined;
    checkScratchCoverage(true);
  });
}

function showSoldOut(moveFocus) {
  form.hidden = true;
  soldOutMessage.hidden = false;
  if (moveFocus) soldOutMessage.focus();
}

async function checkPreviewAvailability() {
  try {
    const response = await fetch(drawUrl);
    if (response.ok && (await response.json()).soldOut && !submit.disabled && scratchTicket.hidden && success.hidden) {
      showSoldOut(form.contains(document.activeElement));
    }
  } catch { /* Submit checks availability again. */ }
}

if (isInstantPreview) checkPreviewAvailability();

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled || form.hidden) return;
  showMessage('');
  let firstInvalid;
  for (const key of Object.keys(checks)) {
    const text = checks[key]();
    setError(key, text);
    if (text && !firstInvalid) firstInvalid = fieldFocus[key];
  }
  if (firstInvalid) { firstInvalid.focus(); return; }
  submit.disabled = true;
  submit.textContent = isInstantPreview ? '복권 준비 중…' : '접수 중…';
  try {
    let upload = await shrink(receipt.files[0]);
    if (upload.size > MAX_UPLOAD) upload = await shrink(upload, 1600, 0.7, true); // 그래도 크면 한 번 더 줄인다
    if (upload.size > MAX_UPLOAD) { setError('receipt', '사진이 너무 커요. 다른 사진을 선택해 주세요.'); return; }
    const data = new FormData(form);
    data.set('receipt', upload, upload.name);
    if (isInstantPreview) {
      drawId ??= crypto.randomUUID();
      const response = await fetch(drawUrl, {method: 'POST', headers: {'X-Draw-Id': drawId}, body: data});
      const result = await response.json();
      if (response.status === 409) {
        setError('phone', result.error);
        phoneInput.focus();
        return;
      }
      if (!response.ok) { showMessage(result.error || '복권을 준비하지 못했어요.'); return; }
      if (result.outcome === 'sold-out') { showSoldOut(true); return; }
      openScratchTicket(result.outcome, store.value);
      return;
    }
    const response = await fetch('/goldenbell/api/entries', {method: 'POST', body: data});
    const result = await response.json();
    if (response.status === 409 && (result.field === 'phone' || result.field === 'receipt')) {
      setError(result.field, result.error);
      fieldFocus[result.field].focus();
      return;
    }
    if (!response.ok) { showMessage(result.error || '응모를 완료하지 못했어요.'); return; }
    lookupPhone.value = String(data.get('phone'));
    showSuccess(formatReceiptCode(result.code));
  } catch {
    showMessage('연결을 확인한 뒤 다시 눌러주세요.');
  } finally {
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
});
document.querySelector('#again').addEventListener('click', () => {
  drawId = undefined;
  clearPhoto();
  receipt.value = '';
  success.hidden = true;
  entryIntro.hidden = false;
  form.hidden = false;
  receipt.focus();
  if (isInstantPreview) checkPreviewAvailability();
});

/* ---------- 내 응모 확인 ---------- */
const lookupForm = document.querySelector('#lookup');
const lookupPhone = document.querySelector('#lookup-phone');
const lookupList = document.querySelector('#lookup-list');
const statusText = {pending: '검수 중', approved: '승인', rejected: '반려'};
const lookupDate = new Intl.DateTimeFormat('ko-KR', {dateStyle: 'medium', timeZone: 'Asia/Seoul'});
lookupPhone?.addEventListener('input', () => {
  const digits = lookupPhone.value.replace(/\D/g, '').slice(0, 11);
  lookupPhone.value = digits.replace(/^(\d{3})(\d{1,4})?(\d{1,4})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
  setError('lookup', '');
});
lookupForm?.addEventListener('submit', async event => {
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
      code.textContent = '접수번호 ' + formatReceiptCode(entry.code);
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
for (const button of document.querySelectorAll('[data-lookup-open]')) {
  button.addEventListener('click', () => {
    lookupDialog.showModal();
    lookupPhone.focus();
    if (button.id === 'success-lookup-open') lookupForm.requestSubmit();
  });
}
document.querySelector('#lookup-close')?.addEventListener('click', () => lookupDialog.close());
lookupDialog?.addEventListener('click', event => { if (event.target === lookupDialog) lookupDialog.close(); });
