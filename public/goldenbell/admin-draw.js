// 골든벨 당첨기 · 제외번호 (프로모션 관리자 화면)
const MAX_UPLOAD = 1024 * 1024;

function mountDraw(root) {
  const api = root.dataset.drawApi;
  const url = (path, params = {}) => {
    const query = new URLSearchParams({...params, ...(root.dataset.event ? {event: root.dataset.event} : {})});
    return api + path + (query.size ? '?' + query : '');
  };
  const part = (selector, scope = root) => scope.querySelector(`[data-role="${selector}"]`);
  const cards = [...root.querySelectorAll('.draw-card')];
  const messages = [...root.querySelectorAll('[data-role="message"]')];
  const dialogs = [...root.querySelectorAll('.draw-dialog')];
  const view = root.querySelector('[data-view="draw"]');
  // 추첨은 팝업이 아니라 상단 아래의 검수 화면을 대신해 보여준다.
  function showDraw(on) {
    view.hidden = !on;
    root.parentElement.classList.toggle('draw-open', on);
    for (const opener of document.querySelectorAll('[data-draw-open="draw"]')) opener.setAttribute('aria-pressed', String(on));
  }
  const tabs = [...view.querySelectorAll('[data-tab]')];
  function selectMachine(prize) {
    for (const card of cards) card.hidden = card.dataset.prize !== prize;
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.tab === prize));
  }
  for (const tab of tabs) tab.addEventListener('click', () => selectMachine(tab.dataset.tab));
  selectMachine(tabs[0].dataset.tab);
  const excludeForm = part('exclude-form');
  const uploadFile = part('upload-file');
  const dateFormat = new Intl.DateTimeFormat('ko-KR', {dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul'});
  const phoneLabel = value => value.replace(/^(010)(\d{4})(\d{4})$/, '$1-$2-$3');
  const count = value => value.toLocaleString('ko-KR');
  let data;
  let busy = false;

  function say(text, error = false) {
    for (const message of messages) {
      message.textContent = text;
      message.classList.toggle('error', error);
    }
  }
  async function request(path = '', body) {
    return read(await fetch(url(path), body && {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}));
  }
  async function read(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(result.error || '처리하지 못했어요. 다시 시도해 주세요.');
    return result;
  }
  function button(label, onClick) {
    const result = document.createElement('button');
    result.type = 'button';
    result.textContent = label;
    result.addEventListener('click', onClick);
    return result;
  }
  function table(headers, rows, empty) {
    if (!rows.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = empty;
      return hint;
    }
    const result = document.createElement('table');
    result.className = 'summary-table';
    const head = result.createTHead().insertRow();
    for (const text of headers) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = text;
      head.append(cell);
    }
    const body = result.createTBody();
    for (const {cells, className} of rows) {
      const row = body.insertRow();
      if (className) row.className = className;
      for (const value of cells) row.insertCell().append(value);
    }
    return result;
  }
  const selectedRound = card => data.rounds.find(item => item.prize === card.dataset.prize
    && (item.prize === 'gold' || item.round === Number(part('round', card).value)));

  function renderResults(result) {
    const heading = text => Object.assign(document.createElement('h3'), {textContent: text});
    const rows = list => list.map(([label, value]) => ({cells: [label, count(value)]}));
    const {statuses} = result;
    const prizes = {coffee: '중복제외 주간', gold: '전체 대상'};
    part('results').replaceChildren(
      heading(`${result.name}${result.test ? ' (테스트 데이터)' : ''} · ${result.start} ~ ${result.end}`),
      heading('응모 현황'),
      table(['전체 응모', '참여 인원', '승인', '검수 대기', '반려'], [{cells: [result.total, result.people, statuses.approved || 0, statuses.pending || 0, statuses.rejected || 0].map(count)}], ''),
      heading('지점별'), table(['지점', '응모'], rows(result.stores), '응모 내역이 없어요.'),
      heading('일별'), table(['날짜', '응모'], rows(result.days), '응모 내역이 없어요.'),
      heading(`당첨자 ${count(result.winners.length)}명`),
      table(['당첨기', '회차', '이름', '휴대폰 번호', '방문 매장'], result.winners.map(row => ({
        cells: [prizes[row.prize], row.round ? row.round + '주차' : '전체', row.name, phoneLabel(row.phone), row.store],
      })), '아직 당첨자가 없어요.'),
    );
  }
  function stat(label, value) {
    const box = document.createElement('div');
    box.append(Object.assign(document.createElement('dt'), {textContent: label}), Object.assign(document.createElement('dd'), {textContent: value}));
    return box;
  }
  function notice(card, text) {
    Object.assign(part('notice', card), {textContent: text, hidden: !text});
  }
  function renderCard(card) {
    const round = selectedRound(card);
    if (!round) {
      part('info', card).replaceChildren();
      notice(card, '이벤트의 시작일과 종료일을 설정해 주세요.');
      part('run', card).disabled = part('export', card).disabled = true;
      return;
    }
    part('info', card).replaceChildren(
      stat('당첨', `${count(round.drawn)} / ${count(round.quota)}명`),
      stat('남은 후보', `${count(round.candidates)}명`),
      stat('검수 대기', `${count(round.pending)}건`),
    );
    notice(card, [
      !round.open && '응모 기간이 끝난 다음 날부터 추첨할 수 있어요.',
      round.pending && '검수 대기 건은 추첨에서 빠져요.',
    ].filter(Boolean).join(' '));
    const quota = part('quota', card);
    if (document.activeElement !== quota) quota.value = round.quota;
    const run = part('run', card);
    run.disabled = busy || !round.open || !round.remaining || !round.candidates;
    run.textContent = !round.remaining ? '추첨 완료' : round.drawn ? `부족한 ${count(round.remaining)}명 추가 추첨` : '추첨하기';
    part('export', card).disabled = !round.drawn;
    // 새로 뽑힌 사람(대체 당첨 포함)이 위에, 취소한 내역은 아래에 보인다.
    const winners = data.winners.filter(row => row.prize === round.prize && row.round === round.round)
      .reverse().sort((a, b) => Number(Boolean(a.canceled_at)) - Number(Boolean(b.canceled_at)));
    part('winners', card).replaceChildren(table(['이름', '휴대폰 번호', '방문 매장', '관리'], winners.map(row => ({
      className: row.canceled_at ? 'canceled' : row.excluded ? 'flagged' : '',
      cells: [row.excluded ? row.name + ' (제외번호)' : row.name, phoneLabel(row.phone), row.store,
        row.canceled_at ? '취소됨' : button('취소', () => {
          if (!confirm(`${row.name} ${phoneLabel(row.phone)} 당첨을 취소할까요?\n바로 다른 당첨자 1명을 다시 뽑아요. 취소한 번호는 같은 당첨기에서 다시 뽑지 않아요.`)) return;
          act(() => request('/cancel', {id: row.id}), ({replacement}) => replacement
            ? `${row.name} 당첨을 취소하고 ${replacement.name} ${phoneLabel(replacement.phone)} 님을 새로 뽑았어요.`
            : '당첨을 취소했어요. 대신 뽑을 후보가 없어 자리가 비어 있어요.');
        })],
    })), '아직 당첨자가 없어요.'));
  }
  function render() {
    cards.forEach(renderCard);
    part('excluded').replaceChildren(table(['휴대폰 번호', '메모', '등록일', '관리'], data.excluded.map(row => ({
      cells: [phoneLabel(row.phone), row.memo || '—', dateFormat.format(new Date(row.created_at)),
        button('삭제', () => {
          if (!confirm(`${phoneLabel(row.phone)} 번호를 제외 목록에서 삭제할까요?`)) return;
          act(() => request('/excluded/remove', {phone: row.phone}), () => '제외번호를 삭제했어요.');
        })],
    })), '등록한 제외번호가 없어요.'));
  }
  async function load() {
    data = await request();
    for (const card of cards) {
      const select = part('round', card);
      if (select.options.length) continue;
      const rounds = data.rounds.filter(item => item.prize === card.dataset.prize);
      select.append(...rounds.map(item => new Option(`${item.label} (${item.from.slice(5)} ~ ${item.to.slice(5)})`, item.round)));
      // 추첨할 차례인 회차를 먼저 보여준다.
      select.value = (rounds.find(item => item.open && item.remaining) || rounds[0])?.round ?? '';
    }
    render();
  }
  // 변경 작업은 한 번에 하나씩 처리하고, 끝나면 최신 상태를 다시 읽는다.
  async function act(task, done) {
    if (busy) return;
    busy = true;
    cards.forEach(card => part('run', card).disabled = true);
    try {
      const result = await task();
      say(done(result));
    } catch (error) {
      say(error.message, true);
    }
    busy = false;
    try {
      await load();
    } catch (error) {
      say(error.message, true);
    }
  }

  for (const card of cards) {
    part('round', card).addEventListener('change', () => { if (data) renderCard(card); });
    part('run', card).addEventListener('click', () => {
      const round = selectedRound(card);
      const title = card.querySelector('h3').textContent;
      const pending = round.pending ? `\n검수 대기 ${count(round.pending)}건은 빠집니다.` : '';
      if (!confirm(`${title} ${round.label}: 최대 ${count(Math.min(round.remaining, round.candidates))}명을 추첨할까요?${pending}`)) return;
      act(() => request('', {prize: round.prize, round: round.round}),
        result => `${count(result.drawn)}명을 추첨했어요.` + (result.shortage ? ` 후보가 부족해 ${count(result.shortage)}명이 남았어요.` : ''));
    });
    part('quota-form', card).addEventListener('submit', event => {
      event.preventDefault();
      const input = part('quota', card);
      const quota = Number(input.value);
      input.blur();
      act(() => request('/quota', {prize: card.dataset.prize, quota}), () => `${card.querySelector('h3').textContent} 추첨 인원을 ${count(quota)}명으로 저장했어요.`);
    });
    part('export', card).addEventListener('click', () => {
      const {prize, round} = selectedRound(card);
      location.href = url('/export', {prize, round});
    });
  }
  excludeForm.addEventListener('submit', event => {
    event.preventDefault();
    const phones = part('exclude-phones');
    act(async () => {
      const result = await request('/excluded', {phones: phones.value, memo: part('exclude-memo').value});
      // 인식하지 못한 값은 입력칸에 남겨 바로 고칠 수 있게 한다.
      phones.value = result.invalid.join('\n');
      return result;
    }, result => `${count(result.added)}개 번호를 등록했어요.` + (result.invalid.length ? ` 확인이 필요한 ${count(result.invalid.length)}건은 입력칸에 남겼어요.` : ''));
  });
  part('upload').addEventListener('click', () => uploadFile.click());
  uploadFile.addEventListener('change', () => {
    const file = uploadFile.files[0];
    uploadFile.value = ''; // 같은 파일을 고쳐서 다시 고를 수 있게 비운다
    if (!file) return;
    if (file.size > MAX_UPLOAD) { say('1MB 이하 엑셀 파일을 올려주세요.', true); return; }
    act(async () => {
      return read(await fetch(url('/excluded/upload', {memo: part('exclude-memo').value}), {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file}));
    }, result => `엑셀에서 ${count(result.added)}개 번호를 등록했어요.` + (result.invalid.length ? ` 번호를 찾지 못한 행: ${result.invalid.slice(0, 10).join(', ')}${result.invalid.length > 10 ? ' 외' : ''}` : ''));
  });
  root.openDialog = name => {
    if (name === 'draw') {
      showDraw(view.hidden); // 상단 버튼을 다시 누르면 응모 목록으로 돌아간다
      if (view.hidden) return;
      view.focus({preventScroll: true});
    } else {
      dialogs.find(dialog => dialog.dataset.dialog === name).showModal();
    }
    // 팝업을 열 때마다 최신 검수·당첨 상태를 읽는다.
    act(async () => { if (name === 'results') renderResults(await request('/results')); }, () => '');
  };
  for (const dialog of dialogs) {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    // 추첨 화면에서 연 제외번호 팝업을 닫으면 후보 수를 다시 읽는다.
    dialog.addEventListener('close', () => { if (!view.hidden) act(async () => {}, () => ''); });
  }
  view.querySelector('[data-view-close]').addEventListener('click', () => showDraw(false));
  part('refresh').addEventListener('click', () => act(async () => {}, () => ''));
}

if (!customElements.get('goldenbell-draw')) {
  // 여는 버튼은 화면 상단(팝업 요소 바깥)에 있어서 문서에서 한 번만 받는다.
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-draw-open]');
    if (opener) document.querySelector('goldenbell-draw')?.openDialog?.(opener.dataset.drawOpen);
  });
  customElements.define('goldenbell-draw', class extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      mountDraw(this);
    }
  });
}
