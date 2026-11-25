function mountReview(root) {
  const $ = selector => root.querySelector(selector);
  const adminApi = root.dataset.adminApi || '/goldenbell/api/admin';
  const search = $('#search');
  const filter = $('#filter');
  const storeFilter = $('#store-filter');
  const fromDate = $('#from');
  const toDate = $('#to');
  const groups = $('#groups');
  const toggleGroups = $('#toggle-groups');
  const adminMessage = $('#admin-message');
  const previous = $('#prev');
  const next = $('#next');
  const bulkBar = $('#bulk-bar');
  const bulkReason = $('#bulk-reason');
  const selectAll = $('#select-all');
  const lightbox = $('#lightbox');
  const storeStats = $('#store-stats');
  const winnerRows = $('#coupon-winners-rows');
  const winnerPrevious = $('#coupon-winners-prev');
  const winnerNext = $('#coupon-winners-next');
  const labels = {pending:'검수 대기',approved:'승인',rejected:'반려'};
  const dateFormat = new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'});
  const phoneLabel = value => value.replace(/^(010)(\d{4})(\d{4})$/, '$1-$2-$3');
  let page = 0;
  let loadVersion = 0;
  let winnerPage = 1;
  let winnerLoadVersion = 0;
  let timer;
  let reasons = [];
  const selected = new Set();

  const storeToggle = $('[aria-controls="store-stats"]');
  storeToggle?.addEventListener('click', () => {
    storeStats.hidden = !storeStats.hidden;
    storeToggle.setAttribute('aria-expanded', String(!storeStats.hidden));
  });

  function element(tag, value, className) {
    const result = document.createElement(tag);
    if (value) result.textContent = value;
    if (className) result.className = className;
    return result;
  }
  function filterParams() {
    return new URLSearchParams({q:search.value.trim(),status:filter.value,store:storeFilter.value,from:fromDate.value,to:toDate.value});
  }
  function say(text) { adminMessage.textContent = text; }
  async function request(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || 'failed');
    return data;
  }
  function reasonSelect(label) {
    const select = element('select');
    select.setAttribute('aria-label', label);
    select.append(new Option('반려 사유 선택', ''));
    for (const reason of reasons) select.append(new Option(reason, reason));
    return select;
  }

  /* ---------- 상단 요약 ---------- */
  function statBox(title, value, className) {
    const box = element('div', null, 'stat ' + (className || ''));
    box.append(element('small', title), element('strong', String(value)));
    return box;
  }
  function summaryTable(headers, rows, totalLabel = '합계') {
    const table = element('table', null, 'summary-table');
    const head = table.createTHead().insertRow();
    for (const header of headers) {
      const cell = element('th', header);
      cell.scope = 'col';
      head.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) { const tr = body.insertRow(); row.forEach(cell => tr.insertCell().textContent = cell); }
    // 합계 행
    const foot = table.createTFoot().insertRow();
    foot.insertCell().textContent = totalLabel;
    for (let i = 1; i < headers.length; i++) foot.insertCell().textContent = rows.reduce((sum, row) => sum + Number(row[i]), 0);
    return table;
  }
  function renderStoreStats(rows) {
    const headings = ['지점', '전체', '대기', '승인', '반려'];
    if (!storeStats.classList.contains('store-stats-grid')) {
      storeStats.replaceChildren(summaryTable(headings, rows));
      return;
    }
    if (!rows.length) {
      storeStats.replaceChildren(element('p', '응모 내역이 있는 지점이 없습니다.', 'hint'));
      return;
    }
    const split = Math.ceil(rows.length / 2);
    const lists = rows.length > 1 ? [rows.slice(0, split), rows.slice(split)] : [rows];
    storeStats.replaceChildren(...lists.map((list, index) => {
      const pane = element('div', null, 'store-stats-pane');
      pane.tabIndex = 0;
      pane.setAttribute('role', 'region');
      pane.setAttribute('aria-label', lists.length === 1 ? '지점별 응모 현황 표' : `지점별 응모 현황 표 ${index + 1}`);
      pane.append(summaryTable(headings, list, lists.length === 1 ? '합계' : '소계'));
      return pane;
    }));
  }
  async function loadSummary() {
    try {
      const data = await request(adminApi + '/summary');
      reasons = data.reasons;
      if (bulkReason.options.length === 1) for (const reason of reasons) bulkReason.append(new Option(reason, reason));
      $('#stats').replaceChildren(statBox('전체', data.total), statBox('검수 대기', data.pending, 'pending'), statBox('승인', data.approved, 'approved'),
        statBox('반려', data.rejected), statBox('중복 의심', data.duplicate, data.duplicate ? 'warn' : ''));
      const current = storeFilter.value;
      storeFilter.replaceChildren(new Option('전체 지점', ''), ...data.stores.map(row => new Option(row.store + ' (' + row.total + ')', row.store)));
      storeFilter.value = current;
      const rows = data.stores.map(row => [row.store, row.total, row.pending, row.approved, row.rejected]);
      renderStoreStats(rows);
    } catch { say('요약을 불러오지 못했어요.'); }
  }

  /* ---------- 선택·일괄 처리 ---------- */
  function updateBulkBar() {
    bulkBar.hidden = selected.size === 0;
    $('#bulk-count').textContent = selected.size + '건 선택';
    const boxes = [...groups.querySelectorAll('.pick')];
    selectAll.checked = boxes.length > 0 && boxes.every(box => box.checked);
  }
  function updateGroupDisclosure() {
    if (!toggleGroups) return;
    const entries = [...groups.querySelectorAll('.group')];
    toggleGroups.disabled = entries.length === 0;
    toggleGroups.textContent = entries.length && entries.every((entry) => entry.open) ? '모두 접기' : '모두 펼치기';
  }
  if (toggleGroups) {
    groups.addEventListener('toggle', updateGroupDisclosure, true);
    toggleGroups.addEventListener('click', () => {
      const entries = [...groups.querySelectorAll('.group')];
      const open = entries.some((entry) => !entry.open);
      for (const entry of entries) entry.open = open;
      updateGroupDisclosure();
    });
  }
  async function review(ids, status, reason) {
    try {
      await request(adminApi + '/entries/bulk', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,status,reason})});
      ids.forEach(id => selected.delete(id));
      await Promise.all([loadGroups(), loadSummary(), loadCouponWinners()]);
    } catch (error) { say(error.message === 'failed' ? '검수 상태를 변경하지 못했어요. 다시 시도해 주세요.' : error.message); }
  }
  $('#bulk-approve').addEventListener('click', () => review([...selected], 'approved'));
  $('#bulk-reject').addEventListener('click', () => {
    if (!bulkReason.value) { say('일괄 반려는 사유를 먼저 선택해 주세요.'); bulkReason.focus(); return; }
    review([...selected], 'rejected', bulkReason.value);
  });
  $('#bulk-clear').addEventListener('click', () => { selected.clear(); groups.querySelectorAll('.pick').forEach(box => box.checked = false); updateBulkBar(); });
  selectAll.addEventListener('change', () => {
    groups.querySelectorAll('.pick').forEach(box => { box.checked = selectAll.checked; selected[selectAll.checked ? 'add' : 'delete'](box.value); });
    updateBulkBar();
  });

  /* ---------- 목록 ---------- */
  function renderRecord(record) {
    const article = element('article', null, 'record');
    const pick = element('input', null, 'pick');
    pick.type = 'checkbox';
    pick.value = record.id;
    pick.checked = selected.has(record.id);
    pick.setAttribute('aria-label', '선택');
    pick.addEventListener('change', () => { selected[pick.checked ? 'add' : 'delete'](record.id); updateBulkBar(); });

    const thumb = element('button', null, 'thumb');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', '영수증 크게 보기');
    const image = element('img');
    image.loading = 'lazy';
    image.alt = '영수증 사진';
    image.src = adminApi + '/receipts/' + record.id;
    thumb.append(image);
    thumb.addEventListener('click', () => { $('#lightbox-img').src = image.src; lightbox.showModal(); });

    const info = element('div', null, 'record-info');
    info.append(element('p', record.store + ' · ' + dateFormat.format(new Date(record.created_at))));
    const statusLine = element('p', record.name + ' · ' + labels[record.status] + ' · ' + record.id.slice(0, 8).toUpperCase());
    if (record.reject_reason) statusLine.append(element('span', record.reject_reason, 'reason-tag'));
    info.append(statusLine);
    if (record.outcome) {
      const result = record.outcome === 'won' ? '아메리카노 당첨' : '아메리카노 미당첨';
      const eligible = record.outcome === 'won' && record.status === 'approved';
      info.append(element('p', result + (eligible ? ' · 쿠폰 발송 대상' : '')));
    }
    if (record.dupes.length) {
      const warn = element('p', '다른 번호로 같은 사진이 접수됐어요. ', 'duplicate');
      for (const dupe of record.dupes) {
        const link = element('button', dupe.name + ' ' + phoneLabel(dupe.phone), 'link-button');
        link.type = 'button';
        link.addEventListener('click', () => {
          search.value = dupe.phone;
          filter.value = storeFilter.value = fromDate.value = toDate.value = '';
          reload();
          search.focus();
          search.scrollIntoView({block:'center'});
        });
        warn.append(link);
      }
      info.append(warn);
    }

    const actions = element('div', null, 'record-actions');
    const reason = reasonSelect('반려 사유');
    reason.value = record.reject_reason || '';
    for (const status of Object.keys(labels)) {
      const button = element('button', labels[status], status === record.status ? 'status-current' : '');
      button.type = 'button';
      button.disabled = status === record.status;
      button.addEventListener('click', () => {
        if (status === 'rejected' && !reason.value) { say('반려 사유를 먼저 선택해 주세요.'); reason.focus(); return; }
        review([record.id], status, status === 'rejected' ? reason.value : undefined);
      });
      actions.append(button);
      if (status === 'rejected') actions.append(reason);
    }
    article.append(pick, thumb, info, actions);
    return article;
  }
  function chip(text, kind) { return element('span', text, 'chip ' + kind); }
  function renderGroup(group, openPhones) {
    const details = element('details', null, 'group');
    details.dataset.phone = group.phone;
    details.open = openPhones.has(group.phone);
    const title = element('summary');
    const who = element('span', null, 'group-who');
    who.append(element('strong', group.name), element('span', phoneLabel(group.phone)));
    const chips = element('span', null, 'group-chips');
    chips.append(chip('구매 ' + group.total, 'total'), chip('대기 ' + group.pending, 'pending'), chip('승인 ' + group.approved, 'approved'), chip('반려 ' + group.rejected, 'rejected'));
    title.append(who);
    if ($('#group-list-head')) {
      const stores = element('span', null, 'group-stores');
      for (const store of new Set(group.records.map(({ store }) => store).filter(Boolean))) {
        stores.append(chip(store, 'store-chip'));
      }
      if (!stores.childElementCount) stores.textContent = '—';
      title.append(stores);
    }
    title.append(chips);
    details.append(title, ...group.records.map(renderRecord));
    return details;
  }
  async function loadGroups() {
    const version = ++loadVersion;
    const query = filterParams();
    query.set('page', page);
    try {
      const data = await request(adminApi + '/groups?' + query);
      if (version !== loadVersion) return;
      if (!data.groups.length && page > 0) { page--; return loadGroups(); }
      const openPhones = new Set(Array.from(groups.querySelectorAll('details.group[open]'), item => item.dataset.phone));
      groups.replaceChildren(...data.groups.map(group => renderGroup(group, openPhones)));
      const listHead = $('#group-list-head');
      if (listHead) listHead.hidden = data.groups.length === 0;
      updateGroupDisclosure();
      say(data.groups.length ? '' : '조건에 맞는 응모가 없어요.');
      previous.disabled = page === 0;
      next.disabled = !data.more;
      $('#page-label').textContent = String(page + 1);
      updateBulkBar();
    } catch {
      if (version === loadVersion) say('응모 내역을 불러오지 못했어요.');
    }
  }
  async function loadCouponWinners() {
    if (!winnerRows) return;
    const version = ++winnerLoadVersion;
    const query = filterParams();
    query.set('page', winnerPage);
    const message = $('#coupon-winners-message');
    const table = $('#coupon-winners-table');
    const pager = $('#coupon-winners-pager');
    try {
      const data = await request(adminApi + '/coupon-winners?' + query);
      if (version !== winnerLoadVersion) return;
      winnerPage = data.page;
      winnerRows.replaceChildren(...data.entries.map(entry => {
        const row = element('tr');
        for (const text of [entry.name, phoneLabel(entry.phone), entry.store, dateFormat.format(new Date(entry.created_at))]) {
          row.append(element('td', text));
        }
        row.insertCell().append(chip(labels[entry.status], entry.status));
        row.insertCell().textContent = entry.status === 'approved' ? '발송 대상' : '—';
        return row;
      }));
      message.textContent = data.total ? `당첨 ${data.total}건 · 발송 대상 ${data.eligible}건` : '조건에 맞는 당첨 내역이 없어요.';
      table.hidden = data.total === 0;
      pager.hidden = data.pages <= 1;
      winnerPrevious.disabled = winnerPage === 1;
      winnerNext.disabled = winnerPage === data.pages;
      $('#coupon-winners-page').textContent = `${winnerPage} / ${data.pages}`;
    } catch {
      if (version !== winnerLoadVersion) return;
      message.textContent = '당첨자 목록을 불러오지 못했어요.';
      table.hidden = true;
      pager.hidden = true;
    }
  }
  function reload() {
    page = 0;
    winnerPage = 1;
    loadGroups();
    loadCouponWinners();
  }
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(reload, 200); });
  for (const control of [filter, storeFilter, fromDate, toDate]) control.addEventListener('change', reload);
  previous.addEventListener('click', () => { if (page > 0) { page--; loadGroups(); } });
  next.addEventListener('click', () => { page++; loadGroups(); });
  winnerPrevious?.addEventListener('click', () => { if (winnerPage > 1) { winnerPage--; loadCouponWinners(); } });
  winnerNext?.addEventListener('click', () => { winnerPage++; loadCouponWinners(); });
  // 엑셀 다운로드 — 현재 검색·필터 조건 그대로
  $('#export').addEventListener('click', () => { location.href = adminApi + '/export?' + filterParams(); });
  $('#coupon-export')?.addEventListener('click', () => { location.href = adminApi + '/coupon-export?' + filterParams(); });
  $('#lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  loadSummary().then(() => Promise.all([loadGroups(), loadCouponWinners()]));
}

if (!customElements.get('goldenbell-review')) {
  customElements.define('goldenbell-review', class extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      mountReview(this);
    }
  });
}
