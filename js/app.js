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
  window.addEventListener('beforeunload', (e) => { if (PPP.dirty) { e.preventDefault(); e.returnValue = ''; } });

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
    document.getElementById('orgName').textContent = PPP.store.db.settings.orgName;
  };
  PPP.syncAnonToggle = () => {
    const on = PPP.prefs.get().anonymous;
    const b = document.getElementById('anonToggle');
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('span').textContent = on ? '익명 모드 켜짐' : '익명 모드 꺼짐';
  };

  document.addEventListener('DOMContentLoaded', () => {
    PPP.store.init();
    if (!PPP.store.available) PPP.toast('브라우저 저장소를 사용할 수 없습니다. 사생활 보호 모드이거나 저장이 차단되어 있으면 데이터가 저장되지 않습니다.', 'error');
    applyFont();
    PPP.renderUserSelect();
    PPP.syncAnonToggle();

    document.getElementById('fontDown').onclick = () => { PPP.prefs.set({ fontStep: Math.max(0, PPP.prefs.get().fontStep - 1) }); applyFont(); };
    document.getElementById('fontReset').onclick = () => { PPP.prefs.set({ fontStep: 2 }); applyFont(); };
    document.getElementById('fontUp').onclick = () => { PPP.prefs.set({ fontStep: Math.min(FONT_STEPS.length - 1, PPP.prefs.get().fontStep + 1) }); applyFont(); };
    document.getElementById('anonToggle').onclick = () => {
      if (PPP.dirty) { PPP.toast('저장 후 익명 모드를 변경하세요.', 'warn'); return; }
      PPP.prefs.set({ anonymous: !PPP.prefs.get().anonymous }); PPP.syncAnonToggle(); router.render();
    };
    document.getElementById('currentUser').onchange = (e) => { PPP.prefs.set({ currentUser: e.target.value }); PPP.toast(e.target.value ? `현재 사용자: ${e.target.value}` : '현재 사용자를 선택하세요.', e.target.value ? 'ok' : 'warn'); };
    if (!PPP.prefs.get().currentUser) setTimeout(() => PPP.toast('상단에서 현재 사용자(담당자)를 선택하면 수정 이력에 이름이 남습니다.', 'warn'), 600);

    // 표의 행 클릭 이동 (링크·버튼 클릭은 제외)
    document.getElementById('view').addEventListener('click', (e) => {
      const tr = e.target.closest('tr.clickable');
      if (tr && !e.target.closest('a,button,input,select,label')) location.hash = tr.dataset.href;
    });

    router.render();
  });
})();
