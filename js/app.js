/* 앱 시작 · 라우터 · 상단 공통 컨트롤 */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const FONT_STEPS = [14, 15, 16, 18, 20, 22];

  PPP.dirty = false;
  PPP.trackDirty = (form) => {
    PPP.dirty = false;
    form.addEventListener('input', () => (PPP.dirty = true));
    form.addEventListener('change', () => (PPP.dirty = true));
  };
  window.addEventListener('beforeunload', (e) => {
    const unsynced = PPP.serverMode && PPP.ready && PPP.supa.ServerAdapter.hasUnsaved();
    if (PPP.dirty || unsynced) { e.preventDefault(); e.returnValue = ''; }
  });

  const routes = [
    [/^\/?$/, (r, m, q) => PPP.views.dashboard(r, q), 'dashboard'],
    [/^\/participants$/, (r, m, q) => PPP.views.participantList(r, q), 'participants'],
    [/^\/participants\/new$/, (r) => PPP.views.participantForm(r), 'participants'],
    [/^\/p\/([\w]+)\/edit$/, (r, m) => PPP.views.participantForm(r, m[1]), 'participants'],
    [/^\/p\/([\w]+)\/doc\/(\w+)\/([\w]+)$/, (r, m) => PPP.views.docEdit(r, m[1], m[2], m[3]), 'participants'],
    [/^\/p\/([\w]+)\/print\/(\w+)\/([\w]+)$/, (r, m) => PPP.views.printView(r, m[1], m[2], m[3]), 'participants'],
    [/^\/p\/([\w]+)\/record\/([\w]+)$/, (r, m) => PPP.views.recordForm(r, m[1], m[2]), 'participants'],
    [/^\/p\/([\w]+)(?:\/(overview|forms|records|history))?$/, (r, m) => PPP.views.participantDetail(r, m[1], m[2]), 'participants'],
    [/^\/records$/, (r, m, q) => PPP.views.recordsPage(r, q), 'records'],
    [/^\/data$/, (r) => PPP.views.dataPage(r), 'data'],
    [/^\/settings$/, (r) => PPP.views.settingsPage(r), 'settings'],
  ];

  let lastHash = location.hash;
  const router = {
    render() {
      if (!PPP.ready) return;
      const raw = (location.hash || '#/').slice(1);
      const [path, qs] = raw.split('?');
      const params = new URLSearchParams(qs || '');
      const root = document.getElementById('view');
      PPP.charts && PPP.charts.hideTip();
      PPP.dirty = false;
      let nav = '';
      const hit = routes.find(([re]) => re.test(path));
      try {
        if (hit) { hit[1](root, path.match(hit[0]), params); nav = hit[2]; }
        else PPP.views.notFound(root);
      } catch (e) {
        console.error(e);
        root.innerHTML = `<div class="notice notice-error" role="alert"><strong>화면을 표시하는 중 오류가 발생했습니다.</strong><br>${PPP.esc(e.message)}<br>데이터는 그대로 보존됩니다. 문제가 반복되면 백업 후 관리자에게 알려주세요.</div>`;
      }
      document.querySelectorAll('.nav a').forEach((a) => {
        const on = a.dataset.nav === nav;
        a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      document.body.classList.toggle('print-mode', path.includes('/print/'));
      const h1 = root.querySelector('h1');
      document.title = `${h1 ? h1.textContent.trim() + ' · ' : ''}평생과정설계`;
      lastHash = location.hash;
    },
  };
  PPP.router = router;

  window.addEventListener('hashchange', async () => {
    if (PPP.dirty && location.hash !== lastHash) {
      const target = location.hash;
      history.replaceState(null, '', lastHash || '#/');
      const ok = await PPP.confirmDialog('저장하지 않은 내용이 있습니다. 이 화면을 떠나면 입력한 내용이 사라집니다.', { title: '저장하지 않고 이동', ok: '이동', danger: true });
      if (!ok) return;
      PPP.dirty = false;
      location.hash = target;
      return;
    }
    router.render();
    const main = document.getElementById('view');
    if (!location.hash.includes('/print/')) window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  });

  /* ---------- 상단 컨트롤 ---------- */
  function applyFont() {
    const step = Math.max(0, Math.min(FONT_STEPS.length - 1, PPP.prefs.get().fontStep));
    document.documentElement.style.fontSize = FONT_STEPS[step] + 'px';
    document.getElementById('fontLevel').textContent = `${Math.round((FONT_STEPS[step] / 16) * 100)}%`;
  }
  PPP.renderUserSelect = () => {
    const sel = document.getElementById('currentUser');
    const cur = PPP.prefs.get().currentUser;
    sel.innerHTML = '<option value="">선택하세요</option>' + PPP.store.db.settings.staff.map((s) => `<option ${s === cur ? 'selected' : ''}>${PPP.esc(s)}</option>`).join('');
    document.getElementById('brandOrg').textContent = PPP.store.db.settings.orgName;
  };
  PPP.syncAnonToggle = () => {
    const on = PPP.prefs.get().anonymous;
    const b = document.getElementById('anonToggle');
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('span').textContent = on ? '익명 모드 켜짐' : '익명 모드 꺼짐';
  };

  /* ---------- 서버 모드: 로그인·동기화 ---------- */
  const esc = (v) => PPP.esc(v);
  function showGate(html) {
    document.body.classList.add('gate');
    document.getElementById('view').innerHTML = html;
  }

  function renderLogin(message) {
    showGate(`<div class="login-wrap"><form id="loginForm" class="card login-card" novalidate>
      <div class="login-brand"><span class="brand-mark" aria-hidden="true">P</span><div><h1>평생과정설계 기록관리</h1><p class="sub">직원 계정으로 로그인하세요.</p></div></div>
      ${message ? `<div class="notice notice-warn" role="alert">${esc(message)}</div>` : ''}
      <div id="loginError" class="error-summary" role="alert" tabindex="-1" hidden></div>
      <div class="field"><label for="loginEmail" class="flabel">이메일</label><input type="email" id="loginEmail" name="email" autocomplete="username" required maxlength="200"></div>
      <div class="field"><label for="loginPw" class="flabel">비밀번호</label><input type="password" id="loginPw" name="password" autocomplete="current-password" required maxlength="200"></div>
      <button class="btn btn-primary login-btn" type="submit">로그인</button>
      <p class="fhint">공용 PC에서는 사용 후 반드시 로그아웃하세요. 브라우저를 닫거나 ${esc(PPP.CONFIG.idleMinutes || 30)}분 동안 사용하지 않으면 자동으로 로그아웃됩니다. 계정은 관리자가 발급합니다.</p>
    </form></div>`);
    const form = document.getElementById('loginForm');
    const err = document.getElementById('loginError');
    form.email.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.email.value.trim(), pw = form.password.value;
      if (!email || !pw) { err.hidden = false; err.textContent = '이메일과 비밀번호를 입력하세요.'; err.focus(); return; }
      const btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = '로그인 중…';
      try {
        await PPP.supa.auth.signIn(email, pw);
        await startServer();
      } catch (ex) {
        err.hidden = false; err.textContent = ex.message; err.focus();
        btn.disabled = false; btn.textContent = '로그인';
        form.password.value = '';
      }
    };
  }

  function renderPending(profile) {
    showGate(`<div class="login-wrap"><div class="card login-card">
      <h1>계정 승인 대기</h1>
      <p>${esc(profile ? profile.display_name : '')} 계정은 아직 활성화되지 않았습니다. 관리자에게 계정 활성화를 요청하세요.</p>
      <p class="fhint">보안을 위해 활성화된 직원 계정만 이용자 정보를 볼 수 있습니다.</p>
      <button class="btn" id="pendingLogout">로그아웃</button></div></div>`);
    document.getElementById('pendingLogout').onclick = () => logout();
  }

  async function logout(message) {
    if (PPP.ready && PPP.supa.ServerAdapter.hasUnsaved()) {
      const ok = await PPP.confirmDialog('서버에 아직 저장되지 않은 변경이 있습니다. 로그아웃하면 이 변경은 사라집니다.', { title: '로그아웃', ok: '로그아웃', danger: true });
      if (!ok) return;
    }
    await PPP.supa.auth.signOut();
    PPP.ready = false;
    try { if (message) sessionStorage.setItem('ppp.logoutMsg', message); } catch (e) { /* 무시 */ }
    location.replace(location.pathname + location.search);
  }
  PPP.logout = logout;
  PPP.onSessionExpired = () => { if (PPP.ready) { PPP.ready = false; logout('로그인이 만료되었습니다. 다시 로그인하세요.'); } };

  PPP.syncStatus = () => {
    const el = document.getElementById('syncStatus');
    if (!el || !PPP.serverMode) return;
    const a = PPP.supa.ServerAdapter;
    let state = 'ok', text = '서버에 저장됨';
    if (a.pending) { state = 'busy'; text = '저장 중…'; }
    else if (a.failed.size) { state = 'error'; text = `저장 실패 ${a.failed.size}건`; }
    el.dataset.state = state;
    el.querySelector('.sync-text').textContent = text;
    el.title = a.failed.size ? [...a.failed.values()].slice(0, 3).join('\n') : text;
  };

  async function reloadFromServer() {
    const a = PPP.supa.ServerAdapter;
    if (a.hasUnsaved() && !(await PPP.confirmDialog('서버에 저장되지 않은 변경이 있습니다. 서버 데이터로 다시 불러오면 이 변경은 사라집니다.', { title: '서버에서 다시 불러오기', ok: '다시 불러오기', danger: true }))) return;
    try {
      const db = await a.loadAll();
      PPP.store.init(db);
      PPP.renderUserSelect();
      PPP.syncStatus();
      router.render();
      PPP.toast('서버에서 최신 데이터를 불러왔습니다.');
    } catch (e) { PPP.toast(e.message, 'error'); }
  }

  let idleTimer;
  function watchIdle() {
    let last = Date.now();
    ['mousemove', 'keydown', 'pointerdown', 'scroll'].forEach((ev) => window.addEventListener(ev, () => (last = Date.now()), { passive: true }));
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (PPP.ready && Date.now() - last > (PPP.CONFIG.idleMinutes || 30) * 60000 && !PPP.supa.ServerAdapter.pending) {
        PPP.ready = false;
        PPP.supa.auth.signOut().then(() => { try { sessionStorage.setItem('ppp.logoutMsg', '오랫동안 사용하지 않아 자동으로 로그아웃되었습니다.'); } catch (e) { /* 무시 */ } location.replace(location.pathname + location.search); });
      }
    }, 30000);
  }

  async function startServer() {
    showGate('<div class="login-wrap"><div class="card login-card" role="status"><p>서버에서 데이터를 불러오는 중입니다…</p></div></div>');
    const a = PPP.supa.ServerAdapter;
    const profile = await a.loadProfile();
    if (!profile || !profile.active) { renderPending(profile); return; }
    PPP.store.adapter = a;
    PPP.store.init(await a.loadAll());
    document.body.classList.remove('gate');
    document.getElementById('serverUser').textContent = `${profile.display_name}${profile.role === 'admin' ? ' (관리자)' : ''}`;
    startApp();
    watchIdle();
  }

  /* ---------- 공통 시작 ---------- */
  function startApp() {
    PPP.ready = true;
    document.body.classList.toggle('server-mode', !!PPP.serverMode);
    PPP.renderUserSelect();
    PPP.syncStatus();
    router.render();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    applyFont();
    PPP.syncAnonToggle();
    document.getElementById('fontDown').onclick = () => { PPP.prefs.set({ fontStep: Math.max(0, PPP.prefs.get().fontStep - 1) }); applyFont(); };
    document.getElementById('fontReset').onclick = () => { PPP.prefs.set({ fontStep: 2 }); applyFont(); };
    document.getElementById('fontUp').onclick = () => { PPP.prefs.set({ fontStep: Math.min(FONT_STEPS.length - 1, PPP.prefs.get().fontStep + 1) }); applyFont(); };
    document.getElementById('anonToggle').onclick = () => {
      if (PPP.dirty) { PPP.toast('저장 후 익명 모드를 변경하세요.', 'warn'); return; }
      PPP.prefs.set({ anonymous: !PPP.prefs.get().anonymous }); PPP.syncAnonToggle(); router.render();
    };
    document.getElementById('currentUser').onchange = (e) => { PPP.prefs.set({ currentUser: e.target.value }); PPP.toast(e.target.value ? `현재 사용자: ${e.target.value}` : '현재 사용자를 선택하세요.', e.target.value ? 'ok' : 'warn'); };
    document.getElementById('logoutBtn').onclick = () => logout();
    document.getElementById('reloadBtn').onclick = () => reloadFromServer();

    // 표의 행 클릭 이동 (링크·버튼 클릭은 제외)
    document.getElementById('view').addEventListener('click', (e) => {
      const tr = e.target.closest('tr.clickable');
      if (tr && !e.target.closest('a,button,input,select,label')) location.hash = tr.dataset.href;
    });

    if (PPP.serverMode) {
      document.body.classList.add('server-mode');
      let msg = '';
      try { msg = sessionStorage.getItem('ppp.logoutMsg') || ''; sessionStorage.removeItem('ppp.logoutMsg'); } catch (e) { /* 무시 */ }
      if (!PPP.supa.auth.restore()) { renderLogin(msg); return; }
      try { await startServer(); } catch (e) {
        console.error(e);
        await PPP.supa.auth.signOut();
        renderLogin(e.message);
      }
      return;
    }

    PPP.store.init();
    if (!PPP.store.available) PPP.toast('브라우저 저장소를 사용할 수 없습니다. 사생활 보호 모드이거나 저장이 차단되어 있으면 데이터가 저장되지 않습니다.', 'error');
    startApp();
    if (!PPP.prefs.get().currentUser) setTimeout(() => PPP.toast('상단에서 현재 사용자(담당자)를 선택하면 수정 이력에 이름이 남습니다.', 'warn'), 600);
  });
})();
