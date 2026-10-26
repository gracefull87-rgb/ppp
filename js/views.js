/* 화면(View) — 대시보드, 참여자, 서식, 기록, 데이터 관리, 설정 */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const esc = (v) => PPP.esc(v);
  const S = () => PPP.store;
  const anon = () => PPP.prefs.get().anonymous;
  const STATUS = { active: '진행 중', closing: '종결 검토 대기', closed: '종결', linked: '자조활동 연계' };
  const STAGE_COLORS = { 준비: '#2a78d6', 계획: '#eb6834', 실천: '#1baf7a', 평가: '#eda100', '자조활동 연계': '#6250d6', 종결: '#8a8f98' };

  PPP.displayName = (p) => {
    if (!p) return '';
    const real = p.name ? (anon() ? PPP.maskName(p.name) : p.name) : '';
    return [p.alias, real && `(${real})`].filter(Boolean).join(' ') || p.code;
  };

  const stageBadge = (stage) => `<span class="badge stage" style="--c:${STAGE_COLORS[stage] || '#8a8f98'}"><span class="dot"></span>${esc(stage)}</span>`;
  const statusBadge = (s) => `<span class="badge status-${s}">${esc(STATUS[s] || s)}</span>`;
  const progressBar = (pct, label) => `<div class="pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label || '진행률')}"><div style="width:${pct}%"></div></div><span class="pbar-num">${pct}%</span>`;
  const empty = (title, body, action) => `<div class="empty"><div class="empty-icon" aria-hidden="true">📋</div><h3>${esc(title)}</h3><p>${body}</p>${action || ''}</div>`;
  const staffOptions = (sel, withEmpty = true) => (withEmpty ? '<option value="">선택</option>' : '') + S().db.settings.staff.map((s) => `<option ${s === sel ? 'selected' : ''}>${esc(s)}</option>`).join('');
  const selectOpts = (list, sel) => '<option value="">선택</option>' + list.map((o) => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');

  function alertsFor(p) {
    const out = [];
    const pr = S().progress(p);
    if (!p.consent || !p.consent.guardian) out.push({ type: 'warn', text: '보호자 동의 미확인' });
    if (p.status === 'closing') out.push({ type: 'info', text: '종결 검토 대기' });
    if (p.status === 'active' && pr.months != null && pr.months >= PPP.SUPPORT_YEARS * 12) out.push({ type: 'info', text: `지원 ${PPP.SUPPORT_YEARS}년 경과 · 자조활동 연계 검토` });
    if (p.status === 'active' && p.steps.activity.done) {
      const evals = S().records(p.id).filter((r) => r.type === '활동평가');
      const last = evals[0] ? evals[0].date : p.steps.activity.date;
      if (last && PPP.daysBetween(last, PPP.today()) > 90) out.push({ type: 'warn', text: '활동평가 90일 경과' });
    }
    return out;
  }
  PPP.alertsFor = alertsFor;

  /* ======================= 대시보드 ======================= */
  function dashboard(root, params) {
    const all = S().participants();
    const mgr = params.get('m') || '';
    const list = all.filter((p) => !mgr || p.manager === mgr);
    if (!all.length) {
      root.innerHTML = `<div class="page-head"><h1>대시보드</h1></div>` + empty('등록된 참여자가 없습니다', `참여자를 등록하면 진행상황과 통계가 이곳에 표시됩니다.${PPP.serverMode ? '' : '<br>먼저 둘러보려면 가상 샘플 데이터를 불러올 수 있습니다.'}`,
        `<div class="btn-row center"><a class="btn btn-primary" href="#/participants/new">참여자 등록</a>${PPP.serverMode ? '' : '<button class="btn" id="seedBtn">가상 샘플 데이터 불러오기</button>'}</div>`);
      if (!PPP.serverMode) root.querySelector('#seedBtn').onclick = () => { S().seedSample(); PPP.toast('가상 샘플 데이터를 불러왔습니다.'); PPP.router.render(); };
      return;
    }
    const prog = list.map((p) => ({ p, pr: S().progress(p), alerts: alertsFor(p) }));
    const active = prog.filter((x) => x.p.status === 'active' || x.p.status === 'closing');
    const ym = PPP.today().slice(0, 7);
    const ids = new Set(list.map((p) => p.id));
    const recs = S().records().filter((r) => ids.has(r.participantId));
    const monthRecs = recs.filter((r) => String(r.date).startsWith(ym)).length;
    const avg = active.length ? Math.round(active.reduce((n, x) => n + x.pr.pct, 0) / active.length) : 0;
    const noConsent = prog.filter((x) => !x.p.consent.guardian && x.p.status !== 'closed').length;
    const closing = prog.filter((x) => x.p.status === 'closing').length;
    const overdue = prog.filter((x) => x.alerts.some((a) => a.text.startsWith('활동평가'))).length;
    const newThisMonth = list.filter((p) => String(p.createdAt).startsWith(ym)).length;

    const count = (arr, fn) => { const m = new Map(); arr.forEach((x) => { const k = fn(x) || '미입력'; m.set(k, (m.get(k) || 0) + 1); }); return m; };
    const toItems = (m, order) => (order ? order.filter((k) => m.has(k)).map((k) => ({ label: k, value: m.get(k) })).concat([...m].filter(([k]) => !order.includes(k)).map(([label, value]) => ({ label, value }))) : [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value));

    root.innerHTML = `
      <div class="page-head">
        <div><h1>대시보드</h1><p class="sub">기준일 ${PPP.today()} · 참여자 ${list.length}명${mgr ? ` (담당자: ${esc(mgr)})` : ''}</p></div>
        <div class="filters" role="group" aria-label="대시보드 필터">
          <label for="dashMgr">담당자</label>
          <select id="dashMgr"><option value="">전체</option>${S().db.settings.staff.map((s) => `<option ${s === mgr ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <a class="btn" href="#/participants/new">+ 참여자 등록</a>
        </div>
      </div>
      <section class="kpis" aria-label="주요 지표">
        ${kpi('진행 중 참여자', active.length, `전체 ${list.length}명 · 이번 달 신규 ${newThisMonth}명`)}
        ${kpi('평균 진행률', avg + '%', `필수 ${PPP.STEPS.filter((s) => !s.optional).length}단계 기준`)}
        ${kpi('이번 달 기록', monthRecs + '건', '상담·회의·활동·평가')}
        ${kpi('보호자 동의 미확인', noConsent + '명', noConsent ? '동의 확인 필요' : '모두 확인됨', noConsent ? 'warn' : 'good')}
        ${kpi('활동평가 지연', overdue + '명', '마지막 평가 후 90일 경과', overdue ? 'warn' : 'good')}
        ${kpi('종결 검토 대기', closing + '명', '담당자 검토 필요', closing ? 'info' : '')}
      </section>

      <section class="process-strip" aria-label="단계별 현황">
        ${['준비', '계획', '실천', '평가', '자조활동 연계', '종결'].map((st) => {
          const n = prog.filter((x) => x.pr.stage === st).length;
          return `<a class="ps-item" href="#/participants?stage=${encodeURIComponent(st)}" style="--c:${STAGE_COLORS[st]}"><span class="ps-name">${st}</span><span class="ps-num">${n}<small>명</small></span><span class="ps-desc">${esc((PPP.STAGES.find((s) => s.key === st) || {}).desc || (st === '종결' ? '종결 처리 완료' : '미래설계 지원 후 자조활동'))}</span></a>`;
        }).join('<span class="ps-arrow" aria-hidden="true">›</span>')}
      </section>

      <div class="grid-3">
        <section class="card"><h2 class="card-title">단계별 분포</h2><div id="chStage"></div></section>
        <section class="card"><h2 class="card-title">장애유형</h2><div id="chType"></div></section>
        <section class="card"><h2 class="card-title">연령대</h2><div id="chAge"></div></section>
        <section class="card"><h2 class="card-title">성별</h2><div id="chGender"></div></section>
        <section class="card"><h2 class="card-title">실천계획 영역 <span class="muted small">(단기목표 수)</span></h2><div id="chArea"></div></section>
        <section class="card"><h2 class="card-title">미래설계서비스 이용현황 <span class="muted small">(복수 선택)</span></h2><div id="chService"></div></section>
      </div>
      <div class="grid-2">
        <section class="card"><h2 class="card-title">세부 단계별 완료 인원 <span class="muted small">(진행 중 ${active.length}명 기준)</span></h2><div id="chSteps"></div></section>
        <section class="card"><h2 class="card-title">최근 6개월 기록 건수</h2><div id="chMonthly"></div>
          <h2 class="card-title mt">담당자별 참여자</h2><div id="chMgr"></div></section>
      </div>
      <section class="card">
        <div class="card-head"><h2 class="card-title">참여자별 진행상황</h2><a href="#/participants" class="link">전체 목록 →</a></div>
        <div class="table-wrap"><table class="dtable progress-table">
          <thead><tr><th scope="col">참여자 코드</th><th scope="col">참여자</th><th scope="col">담당자</th><th scope="col">현재 단계</th><th scope="col" class="w-steps">단계 진행</th><th scope="col">진행률</th><th scope="col">다음 단계</th><th scope="col">최근 기록</th><th scope="col">지원 경과</th><th scope="col">알림</th></tr></thead>
          <tbody>${prog.filter((x) => x.p.status !== 'closed').sort((a, b) => b.alerts.length - a.alerts.length || a.pr.pct - b.pr.pct).map((x) => progressRow(x)).join('')}</tbody>
        </table></div>
      </section>`;

    root.querySelector('#dashMgr').onchange = (e) => { location.hash = '#/' + (e.target.value ? '?m=' + encodeURIComponent(e.target.value) : ''); };

    const C = PPP.charts;
    C.donut(root.querySelector('#chStage'), { title: '단계별 분포', items: toItems(count(prog, (x) => x.pr.stage), Object.keys(STAGE_COLORS)), colorMap: STAGE_COLORS });
    C.donut(root.querySelector('#chType'), { title: '장애유형', items: toItems(count(list, (p) => p.disabilityType)) });
    C.donut(root.querySelector('#chAge'), { title: '연령대', items: toItems(count(list, (p) => PPP.ageBand(p.birthYear)), ['10대 이하', '20대', '30대', '40대', '50대 이상', '미입력']) });
    C.donut(root.querySelector('#chGender'), { title: '성별', items: toItems(count(list, (p) => p.gender), ['남', '여', '미입력']) });
    const areaMap = new Map();
    list.forEach((p) => { const d = S().documents(p.id, 'actionPlan')[0]; if (d) (d.data.plans || []).forEach((pl) => { const k = pl.area || '미지정'; areaMap.set(k, (areaMap.get(k) || 0) + 1); }); });
    C.donut(root.querySelector('#chArea'), { title: '실천계획 영역', items: toItems(areaMap, PPP.DOMAINS), unit: '건' });
    // 복수 선택 항목이라 합계가 100%가 되지 않으므로 원형이 아닌 막대로 표시
    C.hbar(root.querySelector('#chService'), { title: '미래설계서비스 이용현황', max: list.length || 1, items: PPP.SERVICE_TYPES.map((t) => ({ label: t.replace('평생과정설계 ', ''), value: list.filter((p) => (p.services || []).includes(t)).length }))
      .concat([{ label: '이용 없음', value: list.filter((p) => !(p.services || []).length).length }]) });
    C.hbar(root.querySelector('#chSteps'), { title: '세부 단계별 완료 인원', max: active.length || 1, items: PPP.STEPS.map((s) => ({ label: s.label, sub: s.stage + (s.optional ? '·선택' : ''), value: active.filter((x) => (x.p.steps[s.key] || {}).done).length, color: STAGE_COLORS[s.stage] })) });
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const k = `${d.getFullYear()}-${PPP.pad(d.getMonth() + 1)}`; months.push({ label: `${d.getMonth() + 1}월`, full: k, value: recs.filter((r) => String(r.date).startsWith(k)).length }); }
    C.columns(root.querySelector('#chMonthly'), { title: '최근 6개월 기록 건수', items: months });
    C.hbar(root.querySelector('#chMgr'), { title: '담당자별 참여자', items: toItems(count(list.filter((p) => p.status !== 'closed'), (p) => p.manager)) });
  }

  function kpi(label, value, sub, tone = '') {
    return `<div class="kpi ${tone ? 'kpi-' + tone : ''}"><div class="kpi-label">${tone === 'warn' ? '<span aria-hidden="true">⚠ </span>' : ''}${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-sub">${esc(sub)}</div></div>`;
  }

  function stageDots(p, pr) {
    return `<ol class="stage-dots" aria-label="단계 진행">${PPP.STAGES.map((st) => {
      const steps = PPP.STEPS.filter((s) => s.stage === st.key && !s.optional);
      const done = steps.filter((s) => p.steps[s.key].done).length;
      const state = done === steps.length ? 'done' : pr.stage === st.key ? 'current' : done ? 'partial' : '';
      return `<li class="${state}" title="${st.key}: ${done}/${steps.length}"><span class="sr-only">${st.key} ${done}/${steps.length}</span></li>`;
    }).join('')}</ol>`;
  }

  function progressRow({ p, pr, alerts }) {
    const months = pr.months != null ? `${Math.floor(pr.months / 12)}년 ${pr.months % 12}개월` : '-';
    return `<tr class="clickable" data-href="#/p/${p.id}">
      <td><a href="#/p/${p.id}">${esc(p.code)}</a></td><td>${esc(PPP.displayName(p))}</td><td>${esc(p.manager || '-')}</td>
      <td>${stageBadge(pr.stage)}</td><td>${stageDots(p, pr)}</td><td class="nowrap">${progressBar(pr.pct, p.code + ' 진행률')}</td>
      <td>${pr.next && p.status === 'active' ? esc(pr.next.label) : '-'}</td><td class="nowrap">${esc(S().lastRecordDate(p.id) || '-')}</td>
      <td class="nowrap">${months}${pr.months != null ? `<div class="mini-track" title="${PPP.SUPPORT_YEARS}년 중 ${pr.months}개월"><div style="width:${Math.min(100, (pr.months / (PPP.SUPPORT_YEARS * 12)) * 100)}%"></div></div>` : ''}</td>
      <td>${alerts.map((a) => `<span class="badge badge-${a.type}">${esc(a.text)}</span>`).join(' ') || '<span class="muted">-</span>'}</td></tr>`;
  }

  /* ======================= 참여자 목록 ======================= */
  function participantList(root, params) {
    const q = (params.get('q') || '').trim();
    const stage = params.get('stage') || '';
    const mgr = params.get('m') || '';
    const st = params.get('status') || '';
    const all = S().participants();
    const rows = all.map((p) => ({ p, pr: S().progress(p), alerts: alertsFor(p) })).filter(({ p, pr }) => {
      if (stage && pr.stage !== stage) return false;
      if (mgr && p.manager !== mgr) return false;
      if (st && p.status !== st) return false;
      if (q) {
        const hay = [p.code, p.alias, p.name, p.disabilityType, p.manager, p.memo].join(' ').toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => a.p.code.localeCompare(b.p.code));

    root.innerHTML = `
      <div class="page-head"><div><h1>이용자 관리</h1><p class="sub">전체 ${all.length}명 · 검색 결과 ${rows.length}명</p></div>
        <div class="btn-row"><a class="btn btn-primary" href="#/participants/new">+ 참여자 등록</a></div></div>
      <form class="searchbar card" id="searchForm" role="search">
        <div class="field"><label for="sq">검색어</label><input id="sq" name="q" type="search" value="${esc(q)}" placeholder="참여자 코드, 가명, 장애유형, 담당자"></div>
        <div class="field"><label for="sstage">단계</label><select id="sstage" name="stage"><option value="">전체</option>${['준비', '계획', '실천', '평가', '자조활동 연계', '종결'].map((x) => `<option ${x === stage ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="sstatus">상태</label><select id="sstatus" name="status"><option value="">전체</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="smgr">담당자</label><select id="smgr" name="m"><option value="">전체</option>${S().db.settings.staff.map((s) => `<option ${s === mgr ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="btn-row"><button class="btn btn-primary">검색</button><a class="btn" href="#/participants">초기화</a></div>
      </form>
      ${rows.length ? `<section class="card"><div class="table-wrap"><table class="dtable">
        <thead><tr><th scope="col">참여자 코드</th><th scope="col">참여자</th><th scope="col">성별</th><th scope="col">연령대</th><th scope="col">장애유형</th><th scope="col">담당자</th><th scope="col">상태</th><th scope="col">현재 단계</th><th scope="col">진행률</th><th scope="col">동의</th><th scope="col">알림</th></tr></thead>
        <tbody>${rows.map(({ p, pr, alerts }) => `<tr class="clickable" data-href="#/p/${p.id}">
          <td><a href="#/p/${p.id}">${esc(p.code)}</a></td><td>${esc(PPP.displayName(p))}</td><td>${esc(p.gender || '-')}</td><td>${esc(PPP.ageBand(p.birthYear))}</td>
          <td>${esc(p.disabilityType || '-')}</td><td>${esc(p.manager || '-')}</td><td>${statusBadge(p.status)}</td><td>${stageBadge(pr.stage)}</td>
          <td class="nowrap">${progressBar(pr.pct)}</td><td>${p.consent.guardian ? '<span class="badge badge-good">확인</span>' : '<span class="badge badge-warn">미확인</span>'}</td>
          <td>${alerts.filter((a) => !a.text.includes('동의')).map((a) => `<span class="badge badge-${a.type}">${esc(a.text)}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div></section>`
        : empty(all.length ? '검색 결과가 없습니다' : '등록된 참여자가 없습니다', all.length ? '검색어나 필터를 바꿔 보세요.' : '첫 참여자를 등록해 평생과정설계 기록을 시작하세요.', all.length ? '' : '<a class="btn btn-primary" href="#/participants/new">참여자 등록</a>')}`;

    root.querySelector('#searchForm').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const sp = new URLSearchParams();
      for (const [k, v] of fd) if (v) sp.set(k, v);
      location.hash = '#/participants' + (sp.toString() ? '?' + sp : '');
    };
  }

  /* ======================= 참여자 등록·수정 ======================= */
  function participantForm(root, id) {
    const p = id ? S().participant(id) : Object.assign(PPP.newParticipant(), { code: S().nextCode(), manager: PPP.prefs.get().currentUser || '', supportStart: PPP.today() });
    if (id && !p) return notFound(root);
    const c = p.consent || {};
    root.innerHTML = `
      <nav class="crumbs" aria-label="현재 위치"><a href="#/participants">이용자 관리</a> › ${id ? `<a href="#/p/${p.id}">${esc(p.code)}</a> › 정보 수정` : '참여자 등록'}</nav>
      <div class="page-head"><h1>${id ? '참여자 정보 수정' : '참여자 등록'}</h1></div>
      <div class="notice">개인정보 최소수집 원칙: 식별은 <strong>참여자 코드와 가명</strong>으로 합니다. 실명은 꼭 필요한 경우에만 입력하세요. <span class="req">*</span> 표시는 필수 항목입니다.</div>
      <form id="pForm" class="card form-uniform" novalidate>
        <div id="pErrors" class="error-summary" role="alert" tabindex="-1" hidden></div>
        <h2 class="section-title">기본 정보</h2>
        <div class="fgrid">
          <div class="field"><label for="code" class="flabel">참여자 코드 <span class="req">*</span></label><input type="text" id="code" name="code" value="${esc(p.code)}" required pattern="[A-Za-z0-9\\-]{3,30}" maxlength="30"><p class="fhint">자동 생성됩니다. 영문·숫자·하이픈만 사용.</p></div>
          <div class="field"><label for="alias" class="flabel">가명(별칭) <span class="req">*</span></label><input type="text" id="alias" name="alias" value="${esc(p.alias)}" required maxlength="30" placeholder="예) 하늘"></div>
          <div class="field"><label for="name" class="flabel">실명 <span class="badge badge-sens">민감</span></label><input type="text" id="name" name="name" value="${esc(p.name)}" maxlength="30" autocomplete="off"><p class="fhint">선택 입력. 익명 모드에서는 가려서 표시됩니다.</p></div>
          <div class="field"><fieldset class="optgroup"><legend class="flabel">성별</legend><div class="opts">${['남', '여'].map((g) => `<label class="opt"><input type="radio" name="gender" value="${g}" ${p.gender === g ? 'checked' : ''}> ${g}</label>`).join('')}</div></fieldset></div>
          <div class="field"><label for="birthYear" class="flabel">출생연도</label><input id="birthYear" name="birthYear" type="number" min="1920" max="${new Date().getFullYear()}" value="${esc(p.birthYear)}" placeholder="예) 1995"><p class="fhint">통계(연령대)에만 사용합니다. 생년월일 전체는 받지 않습니다.</p></div>
          <div class="field"><label for="disabilityType" class="flabel">장애유형</label><select id="disabilityType" name="disabilityType">${selectOpts(PPP.DISABILITY_TYPES, p.disabilityType)}</select></div>
          <div class="field"><label for="disabilitySeverity" class="flabel">장애정도</label><select id="disabilitySeverity" name="disabilitySeverity">${selectOpts(['심한 장애', '심하지 않은 장애'], p.disabilitySeverity)}</select></div>
          <div class="field"><label for="guardianRelation" class="flabel">주 보호자 관계</label><select id="guardianRelation" name="guardianRelation">${selectOpts(['모', '부', '형제자매', '배우자', '친인척', '후견인', '기타', '없음'], p.guardianRelation)}</select></div>
        </div>
        <h2 class="section-title">서비스 정보</h2>
        <div class="fgrid">
          <div class="field"><label for="manager" class="flabel">담당자 <span class="req">*</span></label><select id="manager" name="manager" required>${staffOptions(p.manager)}</select></div>
          <div class="field"><label for="supportStart" class="flabel">지원 시작일 <span class="req">*</span></label><input id="supportStart" name="supportStart" type="date" value="${esc(p.supportStart)}" required><p class="fhint">미래설계 지원 ${PPP.SUPPORT_YEARS}년(지원회의 1년, 실천 2년) 경과 알림 기준</p></div>
          <div class="field wide"><fieldset class="optgroup"><legend class="flabel">미래설계서비스이용현황 <span class="muted small">(복수 선택)</span></legend><div class="opts">${PPP.SERVICE_TYPES.map((g, i) => `<label class="opt"><input type="checkbox" name="services" value="${esc(g)}" ${(p.services || []).includes(g) ? 'checked' : ''}> ${i + 1}) ${esc(g)}</label>`).join('')}</div></fieldset></div>
        </div>
        <h2 class="section-title">보호자 동의 확인</h2>
        <div class="fgrid">
          <div class="field wide"><label class="opt big"><input type="checkbox" name="consentGuardian" ${c.guardian ? 'checked' : ''}> 개인정보 수집·이용 및 서비스 참여에 대한 <strong>보호자(또는 본인) 동의를 확인</strong>했습니다.</label></div>
          <div class="field"><label for="consentDate" class="flabel">동의 확인일</label><input id="consentDate" name="consentDate" type="date" value="${esc(c.date)}"></div>
          <div class="field"><label for="consentMethod" class="flabel">동의 방법</label><select id="consentMethod" name="consentMethod">${selectOpts(['서면', '전자서명', '구두(기록 보관)', '기타'], c.method)}</select></div>
          <div class="field"><label for="consentNote" class="flabel">비고</label><input type="text" id="consentNote" name="consentNote" value="${esc(c.note)}" maxlength="200"></div>
        </div>
        <div class="field wide"><label for="memo" class="flabel">메모</label><textarea id="memo" name="memo" rows="3" maxlength="2000">${esc(p.memo)}</textarea></div>
        <div class="form-actions"><a class="btn" href="${id ? '#/p/' + p.id : '#/participants'}">취소</a><button class="btn btn-primary" type="submit">${id ? '수정 저장' : '등록'}</button></div>
      </form>`;

    const form = root.querySelector('#pForm');
    PPP.trackDirty(form);
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = (k) => String(fd.get(k) || '').trim();
      const data = {
        code: v('code').toUpperCase(), alias: v('alias'), name: v('name'), gender: v('gender'), birthYear: v('birthYear'),
        disabilityType: v('disabilityType'), disabilitySeverity: v('disabilitySeverity'), guardianRelation: v('guardianRelation'),
        manager: v('manager'), supportStart: v('supportStart'), services: fd.getAll('services').filter((s) => PPP.SERVICE_TYPES.includes(s)), memo: v('memo'),
        consent: { guardian: fd.get('consentGuardian') === 'on', date: v('consentDate'), method: v('consentMethod'), note: v('consentNote') },
      };
      const errors = [];
      if (!/^[A-Za-z0-9-]{3,30}$/.test(data.code)) errors.push(['code', '참여자 코드는 영문·숫자·하이픈 3~30자로 입력하세요.']);
      else if (S().participants().some((x) => x.code === data.code && x.id !== p.id)) errors.push(['code', '이미 사용 중인 참여자 코드입니다.']);
      if (!data.alias) errors.push(['alias', '가명(별칭)을 입력하세요.']);
      if (!data.manager) errors.push(['manager', '담당자를 선택하세요.']);
      if (!PPP.isValidDate(data.supportStart)) errors.push(['supportStart', '지원 시작일을 입력하세요.']);
      if (data.birthYear && (Number(data.birthYear) < 1920 || Number(data.birthYear) > new Date().getFullYear())) errors.push(['birthYear', `출생연도는 1920~${new Date().getFullYear()} 사이로 입력하세요.`]);
      if (data.consent.guardian && !PPP.isValidDate(data.consent.date)) errors.push(['consentDate', '동의를 확인했다면 동의 확인일을 입력하세요.']);
      if (showErrors(form, root.querySelector('#pErrors'), errors)) return;
      const saved = S().saveParticipant(id ? Object.assign({ id }, data) : data);
      PPP.dirty = false;
      PPP.toast(id ? '참여자 정보를 수정했습니다.' : `참여자를 등록했습니다 (${saved.code}).`);
      location.hash = '#/p/' + saved.id;
    };
  }

  function showErrors(form, box, errors) {
    form.querySelectorAll('[aria-invalid]').forEach((el) => { el.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.ferr').forEach((el) => el.remove());
    if (!errors.length) { box.hidden = true; return false; }
    box.hidden = false;
    box.innerHTML = `<h2>입력 내용을 확인해 주세요 (${errors.length}건)</h2><ul>${errors.map(([k, m]) => `<li><a href="#" data-focus="${esc(k)}">${esc(m)}</a></li>`).join('')}</ul>`;
    errors.forEach(([k, m]) => {
      const el = form.querySelector(`[name="${k}"]`);
      if (el) {
        el.setAttribute('aria-invalid', 'true');
        const msg = document.createElement('p');
        msg.className = 'ferr';
        msg.textContent = m;
        (el.closest('.field') || el.parentNode).appendChild(msg);
      }
    });
    box.querySelectorAll('[data-focus]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const el = form.querySelector(`[name="${a.dataset.focus}"]`); if (el) el.focus(); }));
    box.focus();
    return true;
  }

  /* ======================= 참여자 상세 ======================= */
  function participantDetail(root, id, tab = 'overview') {
    const p = S().participant(id);
    if (!p) return notFound(root);
    const pr = S().progress(p);
    const alerts = alertsFor(p);
    const tabs = [['overview', '진행 단계'], ['forms', '서식'], ['records', '상담·회의·활동 기록'], ['history', '수정 이력']];
    root.innerHTML = `
      <nav class="crumbs" aria-label="현재 위치"><a href="#/participants">이용자 관리</a> › ${esc(p.code)}</nav>
      <div class="page-head">
        <div><h1>${esc(PPP.displayName(p))} <span class="code">${esc(p.code)}</span></h1>
          <p class="sub">${statusBadge(p.status)} ${stageBadge(pr.stage)} · 담당 ${esc(p.manager || '-')} · ${esc(p.gender || '-')} · ${esc(PPP.ageBand(p.birthYear))} · ${esc(p.disabilityType || '-')}${p.disabilitySeverity ? ` (${esc(p.disabilitySeverity)})` : ''}</p></div>
        <div class="btn-row"><a class="btn" href="#/p/${p.id}/edit">정보 수정</a><a class="btn btn-primary" href="#/p/${p.id}/record/new">+ 기록 작성</a></div>
      </div>
      ${!p.consent.guardian ? `<div class="notice notice-warn" role="note"><strong>보호자 동의 미확인</strong> — 서식 작성 전에 보호자(또는 본인) 동의를 확인하고 <a href="#/p/${p.id}/edit">정보 수정</a>에서 기록하세요.</div>` : ''}
      ${alerts.filter((a) => !a.text.includes('동의')).map((a) => `<div class="notice notice-${a.type}">${esc(a.text)}</div>`).join('')}
      <div class="summary-row">
        <div class="card mini"><div class="kpi-label">진행률</div>${progressBar(pr.pct)}<div class="kpi-sub">${pr.done}/${pr.total} 단계 완료</div></div>
        <div class="card mini"><div class="kpi-label">다음 단계</div><div class="mini-val">${pr.next && p.status === 'active' ? esc(pr.next.label) : '-'}</div><div class="kpi-sub">${pr.next ? esc(pr.next.desc) : ''}</div></div>
        <div class="card mini"><div class="kpi-label">지원 경과</div><div class="mini-val">${pr.months != null ? `${Math.floor(pr.months / 12)}년 ${pr.months % 12}개월` : '-'}</div><div class="kpi-sub">시작일 ${esc(p.supportStart || '-')} · 기준 ${PPP.SUPPORT_YEARS}년</div></div>
        <div class="card mini"><div class="kpi-label">보호자 동의</div><div class="mini-val">${p.consent.guardian ? '확인' : '미확인'}</div><div class="kpi-sub">${esc(p.consent.date || '')} ${esc(p.consent.method || '')}</div></div>
      </div>
      <div class="tabs" role="tablist" aria-label="참여자 상세">${tabs.map(([k, l]) => `<a role="tab" id="tab-${k}" aria-selected="${k === tab}" aria-controls="tabpanel" tabindex="${k === tab ? 0 : -1}" href="#/p/${p.id}/${k}" class="tab ${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>
      <div id="tabpanel" role="tabpanel" aria-labelledby="tab-${tab}"></div>`;
    const tablist = root.querySelector('.tabs');
    tablist.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const items = Array.from(tablist.querySelectorAll('[role=tab]'));
      const i = items.indexOf(document.activeElement);
      const n = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
      n.focus(); n.click();
    });
    const panel = root.querySelector('#tabpanel');
    if (tab === 'forms') tabForms(panel, p);
    else if (tab === 'records') tabRecords(panel, p);
    else if (tab === 'history') tabHistory(panel, p);
    else tabOverview(panel, p, pr);
  }

  function tabOverview(panel, p, pr) {
    panel.innerHTML = `
      <div class="stage-board">${PPP.STAGES.map((st) => `
        <section class="stage-col ${pr.stage === st.key ? 'current' : ''}" style="--c:${STAGE_COLORS[st.key]}" aria-labelledby="sc-${st.key}">
          <h3 id="sc-${st.key}" class="stage-col-title">${st.key}<small>${esc(st.desc)}</small></h3>
          <ul class="step-list">${PPP.STEPS.filter((s) => s.stage === st.key).map((s) => {
            const v = p.steps[s.key] || {};
            return `<li class="step ${v.done ? 'done' : ''} ${pr.next && pr.next.key === s.key ? 'next' : ''}">
              <label class="step-check"><input type="checkbox" data-step="${s.key}" ${v.done ? 'checked' : ''} ${p.status === 'closed' ? 'disabled' : ''}> <span class="step-label">${esc(s.label)}${s.optional ? ' <span class="muted small">(선택)</span>' : ''}</span></label>
              <div class="step-desc">${esc(s.desc)}</div>
              <label class="step-date"><span class="sr-only">${esc(s.label)} 완료일</span><input type="date" data-step-date="${s.key}" value="${esc(v.date)}" ${p.status === 'closed' ? 'disabled' : ''}></label>
            </li>`;
          }).join('')}</ul>
        </section>`).join('')}</div>
      <p class="fhint">단계 체크는 즉시 저장되며 수정 이력에 남습니다. 상담·회의·활동 기록을 작성하면 해당 단계가 자동으로 완료 처리됩니다. 실천·평가 단계는 매년 반복되며, 새 연도의 실천계획서를 작성한 뒤 필요 시 단계를 다시 해제할 수 있습니다.</p>
      <section class="card">
        <h2 class="card-title">상태 관리</h2>
        ${closingPanel(p)}
      </section>`;
    panel.querySelectorAll('[data-step]').forEach((cb) => (cb.onchange = () => {
      const k = cb.dataset.step;
      const dateEl = panel.querySelector(`[data-step-date="${k}"]`);
      if (cb.checked && !dateEl.value) dateEl.value = PPP.today();
      S().setStep(p.id, k, { done: cb.checked, date: cb.checked ? dateEl.value : '' });
      PPP.toast('단계를 저장했습니다.');
      PPP.router.render();
    }));
    panel.querySelectorAll('[data-step-date]').forEach((d) => (d.onchange = () => {
      if (d.value && !PPP.isValidDate(d.value)) { PPP.toast('날짜 형식이 올바르지 않습니다.', 'error'); return; }
      const k = d.dataset.stepDate;
      S().setStep(p.id, k, { done: !!d.value || p.steps[k].done, date: d.value });
      PPP.toast('완료일을 저장했습니다.');
      PPP.router.render();
    }));
    bindClosing(panel, p);
  }

  function closingPanel(p) {
    const c = p.closing || {};
    if (p.status === 'active') return `
      <div class="btn-row"><button class="btn" data-act="link">자조활동 연계로 전환</button><button class="btn btn-danger-outline" data-act="request">종결 요청</button></div>
      <form id="closeForm" class="closing-form" hidden novalidate>
        <div id="cErrors" class="error-summary" role="alert" tabindex="-1" hidden></div>
        <div class="field"><label for="cReason" class="flabel">종결 사유 <span class="req">*</span></label><textarea id="cReason" name="reason" rows="3" maxlength="1000" required></textarea></div>
        <label class="opt"><input type="checkbox" name="guardianConfirmed"> 보호자(또는 본인)에게 종결 의사를 확인했습니다. <span class="req">*</span></label>
        <p class="fhint">종결은 다른 담당자의 검토 승인 후 확정됩니다. (요청자: ${esc(S().user())})</p>
        <div class="btn-row"><button type="button" class="btn" data-act="cancelReq">취소</button><button class="btn btn-primary">종결 검토 요청</button></div>
      </form>`;
    if (p.status === 'closing') return `
      <dl class="dl"><dt>종결 사유</dt><dd>${esc(c.reason)}</dd><dt>요청</dt><dd>${esc(c.requestedBy)} · ${esc(c.requestedAt)}</dd><dt>보호자 확인</dt><dd>${c.guardianConfirmed ? '확인' : '미확인'}</dd></dl>
      <p class="fhint">현재 사용자: <strong>${esc(S().user())}</strong> — 요청자와 다른 담당자만 승인할 수 있습니다.</p>
      <div class="btn-row"><button class="btn" data-act="reject">반려 (진행 중으로)</button><button class="btn btn-primary" data-act="approve">검토 승인 · 종결</button></div>`;
    if (p.status === 'closed') return `
      <dl class="dl"><dt>종결 사유</dt><dd>${esc(c.reason)}</dd><dt>요청</dt><dd>${esc(c.requestedBy)} · ${esc(c.requestedAt)}</dd><dt>검토 승인</dt><dd>${esc(c.reviewedBy)} · ${esc(c.reviewedAt)}</dd></dl>
      <div class="btn-row"><button class="btn" data-act="reopen">재개 (진행 중으로)</button></div>`;
    return `<p>미래설계 자조활동으로 연계되었습니다.${(p.services || []).length ? ` (이용 서비스: ${esc(p.services.join(', '))})` : ''}</p><div class="btn-row"><button class="btn" data-act="reopen">진행 중으로 되돌리기</button><button class="btn btn-danger-outline" data-act="toRequest">종결 요청</button></div>`;
  }

  function bindClosing(panel, p) {
    const save = (patch, summary) => {
      const before = STATUS[p.status];
      Object.assign(p, patch, { updatedAt: new Date().toISOString() });
      S().addHistory({ participantId: p.id, entity: 'participant', action: '상태', summary, changes: [{ field: '상태', before, after: STATUS[p.status] }] });
      S().persist();
      PPP.toast(summary);
      PPP.router.render();
    };
    const form = panel.querySelector('#closeForm');
    panel.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
      const act = b.dataset.act;
      if (act === 'request' || act === 'toRequest') {
        if (act === 'toRequest') { p.status = 'active'; S().persist(); PPP.router.render(); setTimeout(() => { const r = document.querySelector('[data-act="request"]'); if (r) r.click(); }, 0); return; }
        form.hidden = false; form.querySelector('textarea').focus();
      } else if (act === 'cancelReq') form.hidden = true;
      else if (act === 'link') {
        if (await PPP.confirmDialog('미래설계 지원을 마치고 자조활동 연계 상태로 전환할까요?', { title: '자조활동 연계' })) save({ status: 'linked' }, '자조활동 연계로 전환');
      } else if (act === 'approve') {
        if (p.closing.requestedBy === S().user()) { PPP.toast('종결 요청자와 다른 담당자가 승인해야 합니다. 상단에서 현재 사용자를 변경하세요.', 'error'); return; }
        if (await PPP.confirmDialog('검토를 승인하고 종결 처리할까요?\n종결 후에는 단계 수정이 잠깁니다.', { title: '종결 승인', danger: true, ok: '종결' }))
          save({ status: 'closed', closing: Object.assign({}, p.closing, { reviewedBy: S().user(), reviewedAt: PPP.today() }) }, '종결 검토 승인');
      } else if (act === 'reject') save({ status: 'active', closing: null }, '종결 요청 반려');
      else if (act === 'reopen') {
        if (await PPP.confirmDialog('진행 중 상태로 되돌릴까요?', { title: '재개' })) save({ status: 'active', closing: null }, '진행 중으로 재개');
      }
    }));
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      const reason = form.reason.value.trim();
      const gc = form.guardianConfirmed.checked;
      const errs = [];
      if (!reason) errs.push(['reason', '종결 사유를 입력하세요.']);
      if (!gc) errs.push(['guardianConfirmed', '보호자 종결 의사 확인이 필요합니다.']);
      if (showErrors(form, form.querySelector('#cErrors'), errs)) return;
      save({ status: 'closing', closing: { reason, guardianConfirmed: gc, requestedBy: S().user(), requestedAt: PPP.today() } }, '종결 검토 요청');
    };
  }

  function tabForms(panel, p) {
    panel.innerHTML = PPP.FORM_ORDER.map((fk) => {
      const form = PPP.FORMS[fk];
      const docs = S().documents(p.id, fk);
      return `<section class="card">
        <div class="card-head"><h2 class="card-title">${esc(form.title)}${form.subtitle ? ` <span class="muted small">${esc(form.subtitle)}</span>` : ''}</h2>
          <a class="btn btn-sm btn-primary" href="#/p/${p.id}/doc/${fk}/new">+ 새로 작성</a></div>
        ${docs.length ? `<div class="table-wrap"><table class="dtable"><thead><tr>${form.yearly ? '<th scope="col">연도</th>' : ''}<th scope="col">작성일</th><th scope="col">작성률</th><th scope="col">최종 수정</th><th scope="col">관리</th></tr></thead><tbody>${docs.map((d) => `<tr>
          ${form.yearly ? `<td>${esc(d.data.year)}년</td>` : ''}<td>${esc(d.data.writtenAt || PPP.fmtDate(d.createdAt))}</td><td class="nowrap">${progressBar(PPP.formEngine.completion(form, d.data), '작성률')}</td>
          <td>${esc(PPP.fmtDateTime(d.updatedAt))} · ${esc(d.updatedBy)}</td>
          <td class="btn-row"><a class="btn btn-sm" href="#/p/${p.id}/doc/${fk}/${d.id}">열기·수정</a><a class="btn btn-sm" href="#/p/${p.id}/print/${fk}/${d.id}">PDF 출력</a><button class="btn btn-sm btn-danger-outline" data-del-doc="${d.id}">삭제</button></td></tr>`).join('')}</tbody></table></div>`
          : `<p class="muted">작성된 ${esc(form.title)}가 없습니다.</p>`}</section>`;
    }).join('');
    panel.querySelectorAll('[data-del-doc]').forEach((b) => (b.onclick = async () => {
      if (await PPP.confirmDialog('이 서식을 삭제할까요? 삭제 후에는 백업 파일로만 되돌릴 수 있습니다.', { title: '서식 삭제', danger: true, ok: '삭제' })) {
        S().deleteDocument(b.dataset.delDoc); PPP.toast('서식을 삭제했습니다.'); PPP.router.render();
      }
    }));
  }

  function tabRecords(panel, p) {
    const recs = S().records(p.id);
    panel.innerHTML = `<section class="card"><div class="card-head"><h2 class="card-title">상담·회의·활동 기록 (${recs.length}건)</h2><a class="btn btn-sm btn-primary" href="#/p/${p.id}/record/new">+ 기록 작성</a></div>
      ${recs.length ? recordTable(recs, false) : '<p class="muted">작성된 기록이 없습니다. 상담·회의·실천활동·활동평가 내용을 기록하세요.</p>'}</section>`;
    bindRecordDelete(panel);
  }

  function recordTable(recs, withParticipant) {
    return `<div class="table-wrap"><table class="dtable"><thead><tr><th scope="col">일자</th>${withParticipant ? '<th scope="col">참여자</th>' : ''}<th scope="col">유형</th><th scope="col">영역</th><th scope="col">주요 내용</th><th scope="col">달성도</th><th scope="col">작성</th><th scope="col">관리</th></tr></thead><tbody>${recs.map((r) => {
      const p = S().participant(r.participantId);
      return `<tr><td class="nowrap">${esc(r.date)}</td>${withParticipant ? `<td><a href="#/p/${r.participantId}/records">${esc(p ? p.code : '')}</a> ${esc(PPP.displayName(p))}</td>` : ''}<td><span class="badge">${esc(r.type)}</span></td><td>${esc(r.area || '-')}</td>
        <td class="clip">${esc(r.content)}</td><td>${r.achievement ? esc(r.achievement) + '/5' : '-'}</td><td class="nowrap">${esc(r.updatedBy || r.createdBy)}</td>
        <td class="btn-row"><a class="btn btn-sm" href="#/p/${r.participantId}/record/${r.id}">열기·수정</a><button class="btn btn-sm btn-danger-outline" data-del-rec="${r.id}">삭제</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function bindRecordDelete(panel) {
    panel.querySelectorAll('[data-del-rec]').forEach((b) => (b.onclick = async () => {
      if (await PPP.confirmDialog('이 기록을 삭제할까요? (완료 처리된 단계는 그대로 유지됩니다)', { title: '기록 삭제', danger: true, ok: '삭제' })) {
        S().deleteRecord(b.dataset.delRec); PPP.toast('기록을 삭제했습니다.'); PPP.router.render();
      }
    }));
  }

  function tabHistory(panel, p) {
    const hist = S().historyFor(p.id);
    panel.innerHTML = `<section class="card"><h2 class="card-title">수정 이력 (${hist.length}건)</h2>
      <p class="fhint">등록·수정·삭제·단계 변경·상태 변경이 자동으로 기록됩니다. 민감 항목은 값 대신 ‘변경됨’으로 남습니다.</p>
      ${hist.length ? `<ol class="timeline">${hist.map((h) => `<li><div class="tl-head"><span class="badge">${esc(h.action)}</span> <strong>${esc(h.summary)}</strong> <span class="muted small">${esc(PPP.fmtDateTime(h.at))} · ${esc(h.by)}</span></div>
        ${h.changes && h.changes.length ? `<details><summary>변경 내용 ${h.changes.length}건</summary><table class="dtable small"><thead><tr><th scope="col">항목</th><th scope="col">변경 전</th><th scope="col">변경 후</th></tr></thead><tbody>${h.changes.map((c) => `<tr><td>${esc(c.field)}</td><td>${esc(c.before)}</td><td>${esc(c.after)}</td></tr>`).join('')}</tbody></table></details>` : ''}</li>`).join('')}</ol>` : '<p class="muted">이력이 없습니다.</p>'}</section>`;
  }

  /* ======================= 서식 작성 ======================= */
  function docEdit(root, pid, formKey, docId) {
    const p = S().participant(pid);
    const form = PPP.FORMS[formKey];
    if (!p || !form) return notFound(root);
    const existing = docId !== 'new' ? S().document(docId) : null;
    if (docId !== 'new' && !existing) return notFound(root);
    let data = existing ? existing.data : { writtenAt: PPP.today() };
    if (!existing && form.yearly) data.year = new Date().getFullYear();
    if (!existing && formKey === 'selfIntro') Object.assign(data, { gender: p.gender, disabilityType: p.disabilityType, supporter: p.manager });
    // 새 실천계획서: 이전 연도 계획의 꿈·중장기목표를 불러와 이어 작성
    if (!existing && formKey === 'actionPlan') { const prev = S().documents(pid, 'actionPlan')[0]; if (prev) Object.assign(data, { dream: prev.data.dream, longGoal: prev.data.longGoal, important: prev.data.important, needs: prev.data.needs }); }
    if (!existing && formKey === 'yearStory') { const ap = S().documents(pid, 'actionPlan')[0]; if (ap) Object.assign(data, { dream: ap.data.dream, longGoal: ap.data.longGoal, plans: (ap.data.plans || []).map((x) => ({ area: x.area, goal: x.goal, plan: x.plan })) }); }

    root.innerHTML = `
      <nav class="crumbs" aria-label="현재 위치"><a href="#/participants">이용자 관리</a> › <a href="#/p/${p.id}/forms">${esc(p.code)}</a> › ${esc(form.title)}</nav>
      <div class="page-head sticky-head">
        <div><h1>${esc(form.title)}</h1><p class="sub">${form.subtitle ? esc(form.subtitle) + ' · ' : ''}${esc(PPP.displayName(p))} (${esc(p.code)})${existing ? ` · 최종 수정 ${esc(PPP.fmtDateTime(existing.updatedAt))} ${esc(existing.updatedBy)}` : ' · 새 문서'}</p></div>
        <div class="btn-row"><a class="btn" href="#/p/${p.id}/forms">목록</a>${existing ? `<a class="btn" href="#/p/${p.id}/print/${formKey}/${existing.id}">PDF 출력</a>` : ''}<button class="btn btn-primary" form="docForm">저장</button></div>
      </div>
      ${!p.consent.guardian ? '<div class="notice notice-warn">보호자 동의가 확인되지 않았습니다. 동의 확인 후 작성하는 것을 권장합니다.</div>' : ''}
      ${formKey === 'selfIntro' ? `<nav class="toc card" aria-label="서식 목차"><strong>바로가기</strong> ${form.fields.filter((f) => f.t === 'part' || f.t === 'domain').map((f, i) => `<a href="#" data-jump="${i}">${esc(f.label.replace(/[【】]/g, '').trim())}</a>`).join('')}</nav>` : ''}
      <form id="docForm" class="card form-doc" novalidate>
        <div id="dErrors" class="error-summary" role="alert" tabindex="-1" hidden></div>
        ${PPP.formEngine.renderEdit(form, data, { anonymous: anon() })}
        <div class="form-actions"><a class="btn" href="#/p/${p.id}/forms">취소</a><button class="btn btn-primary" type="submit">저장</button></div>
      </form>`;
    const el = root.querySelector('#docForm');
    PPP.formEngine.bindEdit(el, form);
    PPP.trackDirty(el);
    root.querySelectorAll('[data-jump]').forEach((a) => (a.onclick = (e) => {
      e.preventDefault();
      const heads = el.querySelectorAll('.f-part, .f-domain');
      const t = heads[Number(a.dataset.jump)];
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    }));
    // 익명 모드에서 민감 입력값은 포커스 전까지 가림
    el.querySelectorAll('[data-masked]').forEach((inp) => {
      const real = inp.value;
      inp.value = PPP.maskName(real);
      inp.dataset.real = real;
      inp.addEventListener('focus', () => { if (inp.dataset.masked) { inp.value = inp.dataset.real; delete inp.dataset.masked; } }, { once: true });
    });
    el.onsubmit = (e) => {
      e.preventDefault();
      el.querySelectorAll('[data-masked]').forEach((inp) => { inp.value = inp.dataset.real; delete inp.dataset.masked; });
      const newData = PPP.formEngine.collect(el, form);
      const errors = PPP.formEngine.validate(form, newData).map((x) => [x.key, x.message]);
      if (form.yearly && newData.year) {
        const dup = S().documents(pid, formKey).find((d) => String(d.data.year) === String(newData.year) && (!existing || d.id !== existing.id));
        if (dup) errors.push(['year', `${newData.year}년 ${form.title}가 이미 있습니다. 기존 문서를 수정하세요.`]);
      }
      if (showErrors(el, root.querySelector('#dErrors'), errors)) return;
      const saved = S().saveDocument({ id: existing && existing.id, participantId: pid, formKey, data: newData });
      PPP.dirty = false;
      PPP.toast(`${form.title}를 저장했습니다.`);
      if (!existing) location.hash = `#/p/${pid}/doc/${formKey}/${saved.id}`;
      else PPP.router.render();
    };
  }

  /* ======================= 출력(PDF) ======================= */
  function printView(root, pid, formKey, docId) {
    const p = S().participant(pid);
    const form = PPP.FORMS[formKey];
    const d = S().document(docId);
    if (!p || !form || !d) return notFound(root);
    const title = formKey === 'yearStory' ? `《 ${PPP.displayName(p)} 》의 행복한 미래 이야기` : form.title;
    root.innerHTML = `
      <div class="print-toolbar no-print">
        <a class="btn" href="#/p/${p.id}/doc/${formKey}/${d.id}">← 편집으로</a>
        <label class="opt"><input type="checkbox" id="pAnon" ${anon() ? 'checked' : ''}> 민감정보 가리기</label>
        <button class="btn btn-primary" id="doPrint">인쇄 / PDF로 저장</button>
        <span class="fhint">인쇄 창에서 대상을 ‘PDF로 저장’으로 선택하세요. 출력물은 개인정보 문서로 관리하세요.</span>
      </div>
      <article class="paper">
        <header class="paper-head">
          ${formKey === 'selfIntro' ? `<div class="paper-cover"><div class="cover-org">평생과정설계(PPP)지원사업</div><h1>${esc(form.title)}</h1><div class="cover-sub">${esc(form.subtitle)}</div>
            <ul class="cover-meta"><li>◾ 작성일 : ${esc(d.data.writtenAt || '')}</li><li>◾ 작성자 : ${esc(d.data.writer || '')}</li><li>◾ 지원자 : ${esc(d.data.supporter || '')}</li></ul></div>
            <p class="p-intro">${esc(form.intro)}</p><h2 class="paper-title">《 ${esc(PPP.displayName(p))} 》의 이야기</h2>`
          : `<h1 class="paper-title">${esc(title)}</h1>`}
          <div class="paper-meta">참여자 코드 ${esc(p.code)}${form.yearly ? ` · ${esc(d.data.year)}년` : ''} · 작성일 ${esc(d.data.writtenAt || '')} · ${esc(S().db.settings.orgName)}</div>
        </header>
        <div class="paper-body">${PPP.formEngine.renderPrint(Object.assign({}, form, { fields: formKey === 'selfIntro' ? form.fields.filter((f) => !['writtenAt', 'writer', 'supporter'].includes(f.k)) : form.fields }), d.data, { anonymous: anon() })}</div>
        <footer class="paper-foot">${esc(S().db.settings.orgName)} · 출력일 ${PPP.today()} · 출력자 ${esc(S().user())}</footer>
      </article>`;
    root.querySelector('#doPrint').onclick = () => window.print();
    root.querySelector('#pAnon').onchange = (e) => { PPP.prefs.set({ anonymous: e.target.checked }); PPP.syncAnonToggle(); PPP.router.render(); };
  }

  /* ======================= 기록 작성 ======================= */
  function recordForm(root, pid, rid) {
    const p = S().participant(pid);
    if (!p) return notFound(root);
    const r = rid !== 'new' ? S().record(rid) : null;
    if (rid !== 'new' && !r) return notFound(root);
    const pr = S().progress(p);
    const suggested = (PPP.RECORD_TYPES.find((t) => pr.next && t.step === pr.next.key) || {}).key || '';
    const v = r || { date: PPP.today(), type: suggested, area: '', attendees: '', content: '', result: '', nextPlan: '', achievement: '' };
    root.innerHTML = `
      <nav class="crumbs" aria-label="현재 위치"><a href="#/participants">이용자 관리</a> › <a href="#/p/${p.id}/records">${esc(p.code)}</a> › ${r ? '기록 수정' : '기록 작성'}</nav>
      <div class="page-head"><div><h1>${r ? '기록 수정' : '상담·회의·활동 기록'}</h1><p class="sub">${esc(PPP.displayName(p))} (${esc(p.code)}) · 다음 단계: ${pr.next ? esc(pr.next.label) : '-'}</p></div></div>
      <form id="rForm" class="card" novalidate>
        <div id="rErrors" class="error-summary" role="alert" tabindex="-1" hidden></div>
        <div class="fgrid">
          <div class="field"><label for="rdate" class="flabel">일자 <span class="req">*</span></label><input type="date" id="rdate" name="date" value="${esc(v.date)}" required max="${PPP.today()}"></div>
          <div class="field"><label for="rtype" class="flabel">유형 <span class="req">*</span></label><select id="rtype" name="type" required>${selectOpts(PPP.RECORD_TYPES.map((t) => t.key), v.type)}</select><p class="fhint" id="rtypeHint"></p></div>
          <div class="field"><label for="rarea" class="flabel">영역</label><select id="rarea" name="area">${selectOpts(PPP.DOMAINS, v.area)}</select></div>
          <div class="field"><label for="rach" class="flabel">달성도 (활동평가)</label><select id="rach" name="achievement">${selectOpts(['1', '2', '3', '4', '5'], v.achievement)}</select><p class="fhint">1 매우 미흡 ~ 5 매우 우수</p></div>
          <div class="field wide"><label for="ratt" class="flabel">참석자·협력자</label><input type="text" id="ratt" name="attendees" value="${esc(v.attendees)}" maxlength="300" placeholder="예) 당사자, 보호자, 담당자, 시민옹호인, 활동지원사"><p class="fhint">이름 대신 역할로 기록하는 것을 권장합니다.</p></div>
          <div class="field wide"><label for="rcontent" class="flabel">주요 내용 <span class="req">*</span></label><textarea id="rcontent" name="content" rows="6" maxlength="5000" required>${esc(v.content)}</textarea></div>
          <div class="field wide"><label for="rresult" class="flabel">결정사항·평가 결과</label><textarea id="rresult" name="result" rows="4" maxlength="3000">${esc(v.result)}</textarea></div>
          <div class="field wide"><label for="rnext" class="flabel">다음 계획·세부계획 조정</label><textarea id="rnext" name="nextPlan" rows="3" maxlength="3000">${esc(v.nextPlan)}</textarea></div>
        </div>
        <div class="form-actions"><a class="btn" href="#/p/${p.id}/records">취소</a><button class="btn btn-primary">저장</button></div>
      </form>`;
    const form = root.querySelector('#rForm');
    PPP.trackDirty(form);
    const hint = () => {
      const t = PPP.RECORD_TYPES.find((x) => x.key === form.type.value);
      const step = t && t.step && PPP.STEPS.find((s) => s.key === t.step);
      root.querySelector('#rtypeHint').textContent = step ? (p.steps[step.key].done ? `‘${step.label}’ 단계는 이미 완료되었습니다.` : `저장하면 ‘${step.label}’ 단계가 완료 처리됩니다.`) : '';
    };
    form.type.onchange = hint; hint();
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {};
      ['date', 'type', 'area', 'achievement', 'attendees', 'content', 'result', 'nextPlan'].forEach((k) => (data[k] = String(fd.get(k) || '').trim()));
      const errs = [];
      if (!PPP.isValidDate(data.date)) errs.push(['date', '일자를 입력하세요.']);
      else if (data.date > PPP.today()) errs.push(['date', '미래 날짜로 기록할 수 없습니다.']);
      if (!data.type) errs.push(['type', '유형을 선택하세요.']);
      if (!data.content) errs.push(['content', '주요 내용을 입력하세요.']);
      if (showErrors(form, root.querySelector('#rErrors'), errs)) return;
      S().saveRecord(Object.assign({ participantId: pid }, r ? { id: r.id } : {}, data));
      PPP.dirty = false;
      PPP.toast('기록을 저장했습니다.');
      location.hash = `#/p/${pid}/records`;
    };
  }

  /* ======================= 전체 기록 ======================= */
  function recordsPage(root, params) {
    const type = params.get('type') || '';
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    const recs = S().records().filter((r) => (!type || r.type === type) && (!from || r.date >= from) && (!to || r.date <= to));
    root.innerHTML = `<div class="page-head"><div><h1>상담·회의·활동 기록</h1><p class="sub">전체 참여자의 기록 ${recs.length}건</p></div></div>
      <form class="searchbar card" id="recFilter" role="search">
        <div class="field"><label for="ftype">유형</label><select id="ftype" name="type"><option value="">전체</option>${PPP.RECORD_TYPES.map((t) => `<option ${t.key === type ? 'selected' : ''}>${esc(t.key)}</option>`).join('')}</select></div>
        <div class="field"><label for="ffrom">시작일</label><input type="date" id="ffrom" name="from" value="${esc(from)}"></div>
        <div class="field"><label for="fto">종료일</label><input type="date" id="fto" name="to" value="${esc(to)}"></div>
        <div class="btn-row"><button class="btn btn-primary">조회</button><a class="btn" href="#/records">초기화</a></div>
      </form>
      <section class="card">${recs.length ? recordTable(recs, true) : '<p class="muted">조건에 맞는 기록이 없습니다.</p>'}</section>`;
    root.querySelector('#recFilter').onsubmit = (e) => {
      e.preventDefault();
      const sp = new URLSearchParams();
      for (const [k, v] of new FormData(e.target)) if (v) sp.set(k, v);
      location.hash = '#/records' + (sp.toString() ? '?' + sp : '');
    };
    bindRecordDelete(root);
  }

  /* ======================= 데이터 관리 ======================= */
  function dataPage(root) {
    const db = S().db;
    const server = PPP.serverMode;
    const admin = server && PPP.supa.isAdmin();
    const restoreCard = !server
      ? `<section class="card"><h2 class="card-title">복원</h2>
          <p class="fhint">백업 파일을 선택하면 검증 결과를 먼저 보여 줍니다. 복원하면 현재 데이터가 <strong>모두 교체</strong>되며, 복원 직전 데이터는 자동으로 백업 파일로 내려받습니다.</p>
          <label class="btn" for="restoreFile">백업 파일 선택</label><input type="file" id="restoreFile" accept=".json,application/json" class="sr-only">
          <div id="restorePreview" aria-live="polite"></div></section>`
      : admin
        ? `<section class="card"><h2 class="card-title">백업 가져오기 (관리자)</h2>
          <p class="fhint">로컬 모드에서 만든 백업을 서버로 옮기거나 서버 백업을 되돌릴 때 사용합니다. <strong>서버의 이용자·서식·기록이 파일 내용으로 교체</strong>되며(파일에 없는 이용자는 삭제), 삭제된 내용은 감사로그에 남습니다. 가져오기 직전 서버 데이터는 자동으로 백업 파일로 내려받습니다.</p>
          <label class="btn" for="restoreFile">백업 파일 선택</label><input type="file" id="restoreFile" accept=".json,application/json" class="sr-only">
          <div id="restorePreview" aria-live="polite"></div></section>`
        : `<section class="card"><h2 class="card-title">복원</h2><p class="fhint">서버 모드에서 백업 가져오기는 관리자 계정만 할 수 있습니다.</p></section>`;
    root.innerHTML = `<div class="page-head"><div><h1>데이터 관리</h1><p class="sub">저장 방식: ${esc(S().adapter.name)}</p></div></div>
      ${server ? `<div class="notice"><strong>Supabase 서버 저장</strong> — 로그인한 활성 직원만 데이터에 접근할 수 있으며(RLS), 모든 변경은 서버 감사로그에 남습니다. 서버 장애·실수에 대비해 정기적으로 백업 파일도 내려받아 접근이 제한된 기관 저장소에 보관하세요.</div>` : `<div class="notice notice-warn"><strong>로컬 저장의 한계</strong> — 데이터는 <strong>이 PC의 이 브라우저</strong>에만 저장됩니다. 다른 PC·브라우저와 자동 동기화되지 않고, 암호화·사용자별 권한관리가 없으며, 브라우저 데이터 삭제 시 함께 지워집니다. <strong>정기적으로(최소 주 1회) 백업</strong>하고 백업 파일은 접근이 제한된 기관 저장소에 보관하세요.</div>`}
      <div class="grid-2">
        <section class="card"><h2 class="card-title">백업</h2>
          <p>현재 데이터: 참여자 ${db.participants.length}명 · 서식 ${db.documents.length}건 · 기록 ${db.records.length}건 · 이력 ${db.history.length}건</p>
          <p class="fhint">백업 파일(JSON)에는 민감정보가 포함됩니다. 이메일·메신저로 전송하지 마세요.</p>
          <button class="btn btn-primary" id="backupBtn">백업 파일 다운로드</button></section>
        ${restoreCard}
        <section class="card"><h2 class="card-title">엑셀·CSV 내보내기</h2>
          <label class="opt"><input type="checkbox" id="incSensitive"> 실명 포함 (기본: 제외, 비식별)</label>
          <div class="btn-row mt"><button class="btn" data-export="xls">엑셀(.xls) — 전체 시트</button><button class="btn" data-export="participants">CSV — 참여자 현황</button><button class="btn" data-export="records">CSV — 기록</button><button class="btn" data-export="plans">CSV — 실천계획</button></div>
          <p class="fhint">CSV는 UTF-8(BOM)으로 저장되어 엑셀에서 한글이 깨지지 않습니다.</p></section>
        ${server ? '' : `<section class="card"><h2 class="card-title">샘플·초기화</h2>
          <p class="fhint">가상 샘플 데이터는 시연·교육용이며 실제 이용자 정보가 아닙니다.</p>
          <div class="btn-row"><button class="btn" id="seedBtn">가상 샘플 데이터 추가</button><button class="btn btn-danger-outline" id="resetBtn">전체 데이터 초기화</button></div></section>`}
      </div>`;
    root.querySelector('#backupBtn').onclick = () => { PPP.exporter.backup(); PPP.toast('백업 파일을 내려받았습니다.'); };
    root.querySelectorAll('[data-export]').forEach((b) => (b.onclick = () => { PPP.exporter.run(b.dataset.export, root.querySelector('#incSensitive').checked); PPP.toast('파일을 내려받았습니다.'); }));
    if (!server) root.querySelector('#seedBtn').onclick = () => { S().seedSample(); PPP.toast('가상 샘플 데이터를 추가했습니다.'); PPP.router.render(); };
    if (!server) root.querySelector('#resetBtn').onclick = async () => {
      if (!(await PPP.confirmDialog('모든 참여자·서식·기록·이력을 삭제합니다.\n초기화 전에 현재 데이터가 백업 파일로 다운로드됩니다.', { title: '전체 초기화', danger: true, ok: '백업 후 초기화' }))) return;
      PPP.exporter.backup('초기화전');
      S().resetAll(); PPP.toast('전체 데이터를 초기화했습니다.'); PPP.router.render();
    };
    const restoreInput = root.querySelector('#restoreFile');
    if (restoreInput) restoreInput.onchange = (e) => {
      const file = e.target.files[0];
      const box = root.querySelector('#restorePreview');
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { box.innerHTML = '<div class="notice notice-error">파일이 너무 큽니다 (20MB 초과).</div>'; return; }
      const reader = new FileReader();
      reader.onload = () => {
        let obj;
        try { obj = JSON.parse(reader.result); } catch (err) { box.innerHTML = '<div class="notice notice-error">JSON 파일을 읽을 수 없습니다. 올바른 백업 파일인지 확인하세요.</div>'; return; }
        const errors = S().validateBackup(obj);
        if (errors.length) { box.innerHTML = `<div class="notice notice-error"><strong>복원할 수 없는 파일입니다.</strong><ul>${errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`; return; }
        const c = obj.data;
        box.innerHTML = `<div class="notice notice-good"><strong>검증 통과</strong> — ${esc(PPP.fmtDateTime(obj.exportedAt))} 생성 (${esc(obj.exportedBy || '')})<br>참여자 ${c.participants.length}명 · 서식 ${c.documents.length}건 · 기록 ${c.records.length}건 · 이력 ${c.history.length}건</div><button class="btn btn-primary" id="doRestore">이 파일로 복원</button>`;
        box.querySelector('#doRestore').onclick = async () => {
          if (!(await PPP.confirmDialog('현재 데이터를 백업 파일 내용으로 교체합니다.\n복원 직전 데이터는 자동으로 다운로드됩니다.', { title: '복원', danger: true, ok: '복원' }))) return;
          PPP.exporter.backup('복원전');
          if (!S().restore(obj)) return;
          if (server) {
            const a = PPP.supa.ServerAdapter;
            PPP.toast('서버로 전송 중입니다. 완료될 때까지 창을 닫지 마세요.', 'warn');
            await a.queue;
            if (a.failed.size) { PPP.toast(`일부 항목(${a.failed.size}건)을 서버에 저장하지 못했습니다. 상단 저장 상태를 확인하세요.`, 'error'); return; }
          }
          PPP.toast('복원을 완료했습니다.'); location.hash = '#/';
        };
      };
      reader.onerror = () => { box.innerHTML = '<div class="notice notice-error">파일을 읽는 중 오류가 발생했습니다.</div>'; };
      reader.readAsText(file);
      e.target.value = '';
    };
  }

  /* ======================= 설정 ======================= */
  function settingsPage(root) {
    const st = S().db.settings;
    const server = PPP.serverMode;
    const canEditOrg = !server || PPP.supa.isAdmin();
    root.innerHTML = `<div class="page-head"><h1>설정</h1></div>
      <form id="setForm" class="card" novalidate>
        <div id="sErrors" class="error-summary" role="alert" tabindex="-1" hidden></div>
        <div class="fgrid">
          <div class="field wide"><label for="orgName" class="flabel">기관명</label><input type="text" id="orgName" name="orgName" value="${esc(st.orgName)}" maxlength="50" ${canEditOrg ? '' : 'readonly aria-readonly="true"'}>${canEditOrg ? '' : '<p class="fhint">기관명은 관리자만 변경할 수 있습니다.</p>'}</div>
          <div class="field wide"><label for="staff" class="flabel">담당자 목록 <span class="req">*</span></label><textarea id="staff" name="staff" rows="4" maxlength="500" ${server ? 'readonly aria-readonly="true"' : ''}>${esc(st.staff.join('\n'))}</textarea><p class="fhint">${server ? '서버 모드에서는 Supabase에서 활성화된 직원 계정 이름으로 자동 구성됩니다. 계정 추가·비활성화는 관리자가 Supabase에서 합니다.' : '한 줄에 한 명씩 입력합니다. 이력의 작성자와 종결 검토자로 사용됩니다.'}</p></div>
        </div>
        ${canEditOrg ? '<div class="form-actions"><button class="btn btn-primary">저장</button></div>' : ''}
      </form>
      <section class="card"><h2 class="card-title">사용 안내</h2>
        <ul class="guide">
          ${server ? '<li>로그인한 직원 계정이 수정 이력·종결 검토의 작성자로 서버에 기록됩니다. 사용 후 <strong>로그아웃</strong>하세요.</li><li>다른 담당자가 바꾼 내용은 상단 <strong>다시 불러오기</strong>로 가져옵니다. 같은 항목을 동시에 수정하면 나중에 저장한 쪽이 거부되어 덮어쓰기를 막습니다.</li>' : '<li>상단 <strong>현재 사용자</strong>를 본인으로 선택하고 작업하세요. 수정 이력과 종결 검토에 사용됩니다. (로그인 기능이 아니므로 권한 통제는 되지 않습니다.)</li>'}
          <li><strong>익명 모드</strong>가 켜져 있으면 실명·연락처 등 민감정보가 화면과 출력물에서 가려집니다.</li>
          <li>글자 크기는 상단 <strong>가-/가/가+</strong> 버튼으로 조절합니다.</li>
          <li>업무 흐름: 준비(아카데미·준비상담) → 계획(상담→사전→통합→컨퍼런스→확정회의→단기계획) → 실천(세부계획·실천활동·활동평가) → 평가(연 1회).</li>
        </ul></section>`;
    const form = root.querySelector('#setForm');
    form.onsubmit = (e) => {
      e.preventDefault();
      const staff = server ? st.staff : form.staff.value.split('\n').map((s) => s.trim()).filter(Boolean);
      const errs = [];
      if (!staff.length) errs.push(['staff', '담당자를 한 명 이상 입력하세요.']);
      if (new Set(staff).size !== staff.length) errs.push(['staff', '같은 이름이 중복되었습니다.']);
      if (showErrors(form, root.querySelector('#sErrors'), errs)) return;
      st.orgName = form.orgName.value.trim() || st.orgName;
      st.staff = staff;
      S().addHistory({ participantId: null, entity: 'system', action: '설정', summary: '설정 변경 (기관명·담당자)' });
      S().persist();
      PPP.renderUserSelect();
      PPP.toast('설정을 저장했습니다.');
    };
  }

  function notFound(root) {
    root.innerHTML = empty('페이지를 찾을 수 없습니다', '삭제되었거나 잘못된 주소입니다.', '<a class="btn btn-primary" href="#/">대시보드로</a>');
  }

  PPP.views = { dashboard, participantList, participantForm, participantDetail, docEdit, printView, recordForm, recordsPage, dataPage, settingsPage, notFound };
})();
