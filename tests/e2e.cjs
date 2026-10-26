/* E2E 스모크 테스트 — 실행: node tests/e2e.cjs  (Playwright + Chromium 필요)
 * 가상 데이터만 사용한다. 화면 캡처는 tests/screenshots/ 에 저장된다(커밋 제외).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const check = (cond, msg) => { if (cond) console.log('  ✓', msg); else { failed++; console.error('  ✗', msg); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  console.log('1. 빈 상태 대시보드');
  await page.goto(URL);
  check(await page.isVisible('text=등록된 참여자가 없습니다'), '빈 상태 안내 표시');

  console.log('2. 현재 사용자 선택 · 참여자 등록 검증');
  await page.selectOption('#currentUser', '담당자1');
  await page.goto(URL + '#/participants/new');
  check((await page.textContent('nav.nav [data-nav=participants]')).trim().endsWith('이용자 관리'), '메뉴 이름: 이용자 관리');
  const fieldHeights = () => page.evaluate(() => {
    const ref = document.getElementById('birthYear').getBoundingClientRect().height;
    const els = [...document.querySelectorAll('#pForm input:not([type=checkbox]):not([type=radio]), #pForm select, #pForm textarea, #pForm .opts')];
    return { ref: Math.round(ref), diff: els.filter((e) => Math.abs(e.getBoundingClientRect().height - ref) > 0.5).map((e) => e.name || e.className) };
  });
  let fh = await fieldHeights();
  check(fh.diff.length === 0, `등록 폼 입력란 높이 = 출생연도 높이(${fh.ref}px)${fh.diff.length ? ' 불일치: ' + fh.diff.join(',') : ''}`);
  await page.click('#fontUp'); await page.click('#fontUp'); await page.click('#fontUp');
  fh = await fieldHeights();
  check(fh.diff.length === 0 && fh.ref > 50, `글자 크게 해도 입력란 높이 동일(${fh.ref}px)`);
  await page.click('#fontReset');
  check(await page.isVisible('text=미래설계서비스이용현황'), '미래설계서비스이용현황 항목 표시');
  check((await page.$$('#pForm input[name=services]')).length === 3, '서비스 하위항목 3개');
  await page.check('#pForm input[name=services][value="평생과정설계 보호자 아카데미"]');
  await page.check('#pForm input[name=services][value="평생과정설계 자조모임"]');
  await page.click('button[type=submit]');
  check(await page.isVisible('.error-summary'), '필수값 누락 시 오류 요약 표시');
  await page.fill('#alias', '테스트(가명)');
  await page.selectOption('#manager', '담당자1');
  await page.fill('#birthYear', '1998');
  await page.selectOption('#disabilityType', '지적장애');
  await page.check('input[name=consentGuardian]');
  await page.click('button[type=submit]');
  check(await page.isVisible('text=동의 확인일을 입력하세요'), '동의 체크 시 동의일 필수 검증');
  await page.fill('#consentDate', '2026-01-05');
  await page.click('button[type=submit]');
  await page.waitForSelector('.stage-board');
  check(await page.isVisible('text=테스트(가명)'), '참여자 등록 후 상세 이동');
  check(JSON.stringify(await page.evaluate(() => window.PPP.store.db.participants[0].services)) === JSON.stringify(['평생과정설계 보호자 아카데미', '평생과정설계 자조모임']), '미래설계서비스 복수 선택 저장');

  console.log('3. 기록 작성 → 단계 자동 완료');
  await page.click('text=+ 기록 작성');
  await page.selectOption('#rtype', '준비상담');
  await page.fill('#rcontent', '준비상담 진행 (테스트)');
  await page.click('#rForm button.btn-primary');
  await page.waitForSelector('text=기록을 저장했습니다');
  await page.click('#tab-overview');
  check(await page.isChecked('[data-step="prepCounsel"]'), '준비상담 단계 자동 완료');

  console.log('4. 자기소개서 작성 · 출력');
  await page.click('#tab-forms');
  await page.click('a[href$="/doc/selfIntro/new"]');
  await page.fill('#f_oneWord', '웃음이 많은 사람');
  await page.check('input[name=gender][value="여"]');
  await page.fill('input[name="people__0__relation"]', '어머니');
  await page.click('[data-add-row="people"]');
  check((await page.$$('table[data-table=people] tbody tr')).length === 5, '표 행 추가');
  await page.check('input[name="adl__0_0"][value="4"]');
  await page.fill('input[name="assets__0_0_0__amount"]', '100000');
  await page.fill('input[name="assets__0_2_0__amount"]', '30000');
  check((await page.textContent('output[data-total="assets"][data-sec="0"]')).includes('70,000'), '재산 총계 자동 계산(부채 차감)');
  await page.click('#docForm button[type=submit]');
  await page.waitForSelector('text=PDF 출력');
  await page.click('text=PDF 출력');
  await page.waitForSelector('.paper');
  check(await page.isVisible('text=행복을 이루기 위한'), '출력 화면 표지');
  check((await page.textContent('.paper')).includes('■ 여'), '출력 화면 체크 표시');
  await page.screenshot({ path: path.join(SHOTS, 'print.png'), fullPage: false });

  console.log('5. 실천계획서 연도 중복 검증');
  const pid = (await page.url()).match(/#\/p\/(\w+)/)[1];
  await page.goto(URL + `#/p/${pid}/doc/actionPlan/new`);
  await page.selectOption('select[name="plans__0__area"]', '직업');
  await page.fill('textarea[name="plans__0__goal"]', '카페 직업훈련 참여');
  await page.click('#docForm button[type=submit]');
  await page.waitForSelector('text=최종 수정');
  await page.goto(URL + `#/p/${pid}/doc/actionPlan/new`);
  await page.click('#docForm button[type=submit]');
  check(await page.isVisible('text=이미 있습니다'), '같은 연도 실천계획서 중복 방지');
  await page.evaluate(() => { window.PPP.dirty = false; });

  console.log('6. 샘플 데이터 · 대시보드 차트');
  await page.goto(URL + '#/data');
  await page.click('#seedBtn');
  await page.goto(URL + '#/');
  await page.waitForSelector('#chStage svg');
  check((await page.$$('.kpi')).length === 6, 'KPI 6개');
  check((await page.$$('.donut-wrap')).length === 5, '원형 그래프 5개');
  check((await page.$$('.progress-table tbody tr')).length >= 10, '참여자 진행상황 표');
  await page.screenshot({ path: path.join(SHOTS, 'dashboard.png'), fullPage: true });

  console.log('7. 검색');
  await page.goto(URL + '#/participants?q=' + encodeURIComponent('테스트'));
  check((await page.$$('.dtable tbody tr')).length === 1, '검색 결과 1건');

  console.log('8. 종결: 요청자와 다른 담당자만 승인');
  await page.goto(URL + `#/p/${pid}`);
  await page.click('[data-act=request]');
  await page.fill('#cReason', '테스트 종결');
  await page.check('input[name=guardianConfirmed]');
  await page.click('#closeForm button.btn-primary');
  await page.waitForSelector('[data-act=approve]');
  await page.click('[data-act=approve]');
  check(await page.isVisible('text=다른 담당자가 승인해야'), '요청자 본인 승인 차단');
  await page.selectOption('#currentUser', '담당자2');
  await page.click('[data-act=approve]');
  await page.click('dialog button[value=ok]');
  await page.waitForSelector('[data-act=reopen]');
  check(true, '다른 담당자 승인으로 종결');
  await page.click('#tab-history');
  check(await page.isVisible('text=종결 검토 승인'), '수정 이력 기록');

  console.log('9. 백업 → 초기화 → 복원');
  await page.goto(URL + '#/data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupBtn')]);
  const backupPath = path.join(SHOTS, 'backup.json');
  await dl.saveAs(backupPath);
  const before = await page.evaluate(() => window.PPP.store.db.participants.length);
  await page.click('#resetBtn');
  await Promise.all([page.waitForEvent('download'), page.click('dialog button[value=ok]')]);
  check(await page.evaluate(() => window.PPP.store.db.participants.length) === 0, '초기화');
  // 손상 파일 거부
  const bad = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  bad.data.participants[0].alias = '변조';
  fs.writeFileSync(path.join(SHOTS, 'bad.json'), JSON.stringify(bad));
  await page.setInputFiles('#restoreFile', path.join(SHOTS, 'bad.json'));
  check(await page.waitForSelector('text=검증값 불일치').then(() => true, () => false), '변조된 백업 거부');
  await page.setInputFiles('#restoreFile', backupPath);
  await page.waitForSelector('#doRestore');
  await page.click('#doRestore');
  await Promise.all([page.waitForEvent('download'), page.click('dialog button[value=ok]')]);
  await page.waitForSelector('.kpis');
  check(await page.evaluate(() => window.PPP.store.db.participants.length) === before, `복원 후 참여자 수 일치 (${before}명)`);

  console.log('10. 내보내기 · 글자 크기');
  await page.goto(URL + '#/data');
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-export=participants]')]);
  const csv = fs.readFileSync(await csvDl.path(), 'utf8');
  check(csv.charCodeAt(0) === 0xfeff && csv.includes('참여자 코드'), 'CSV(BOM) 헤더');
  check(!csv.includes('실명'), '기본 내보내기에서 실명 제외');
  await page.click('#fontUp');
  check(await page.evaluate(() => document.documentElement.style.fontSize) === '18px', '글자 크게');

  console.log('11. 이전 버전(v1) 데이터 변환');
  await page.evaluate(() => {
    const db = { schemaVersion: 1, settings: { orgName: '테스트기관', staff: ['담당자1'] }, documents: [], records: [], history: [],
      participants: [
        { id: 'p_a', code: 'PPP-2025-001', alias: '가(가명)', selfHelpGroup: '당사자 자조활동', status: 'active', steps: {}, consent: { guardian: true, date: '2025-01-01' } },
        { id: 'p_b', code: 'PPP-2025-002', alias: '나(가명)', selfHelpGroup: '없음', status: 'active', steps: {}, consent: { guardian: true, date: '2025-01-01' } }] };
    localStorage.setItem('ppp.db.v1', JSON.stringify(db));
  });
  await page.goto(URL + '#/');
  await page.reload();
  await page.waitForSelector('.kpis');
  const mig = await page.evaluate(() => window.PPP.store.db.participants.map((p) => ({ s: p.services, old: 'selfHelpGroup' in p })));
  check(mig[0].s.join() === '평생과정설계 자조모임' && mig[1].s.length === 0 && !mig[0].old, 'v1 자조활동 → 미래설계서비스이용현황 변환');
  check(await page.isVisible('#chService .hbar'), '대시보드 미래설계서비스 이용현황 막대');

  console.log('12. 모바일 폭 가로 스크롤 없음');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(URL + '#/');
  await page.waitForSelector('.kpis');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '가로 넘침 없음');

  check(errors.length === 0, `콘솔 오류 없음${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  ['backup.json', 'bad.json'].forEach((f) => fs.rmSync(path.join(SHOTS, f), { force: true }));
  console.log(failed ? `\n실패 ${failed}건` : '\n모든 테스트 통과');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
