/* 서버 모드(Supabase) E2E — 실행: node tests/e2e-server.cjs
 * 실제 Supabase 대신 가짜 Auth·REST API(아래 mock)로 앱의 요청 형식과 화면 흐름을 검증한다.
 * RLS·트리거 자체는 tests/db/run.sh 가 실제 PostgreSQL 에서 검증한다.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUPA = 'https://mock-project.supabase.co';
let failed = 0;
const check = (cond, msg) => { if (cond) console.log('  ✓', msg); else { failed++; console.error('  ✗', msg); } };

/* ---------- 정적 서버 ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/* ---------- 가짜 Supabase ---------- */
const users = {
  'staff1@test.local': { id: 'u-staff1', pw: 'pass1234', profile: { id: 'u-staff1', display_name: '담당자1', role: 'staff', active: true } },
  'staff2@test.local': { id: 'u-staff2', pw: 'pass1234', profile: { id: 'u-staff2', display_name: '담당자2', role: 'staff', active: true } },
  'admin@test.local': { id: 'u-admin', pw: 'pass1234', profile: { id: 'u-admin', display_name: '관리자', role: 'admin', active: true } },
  'new@test.local': { id: 'u-new', pw: 'pass1234', profile: { id: 'u-new', display_name: 'new', role: 'staff', active: false } },
};
const tables = { participants: new Map(), documents: new Map(), records: new Map(), history: new Map() };
const settings = { org_name: '노원구장애인가족지원센터' };
const log = [];
let tick = 0;
const ts = () => new Date(Date.UTC(2026, 9, 26, 0, 0, 0) + ++tick).toISOString().replace('Z', '+00:00');
const tokenUser = (h) => { const m = /^Bearer tok-(.+)$/.exec(h || ''); return m && Object.values(users).find((u) => u.id === m[1]); };

async function supabaseMock(route) {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
  const headers = req.headers();
  log.push({ method, path: url.pathname + url.search, apikey: headers.apikey, auth: headers.authorization, body: req.postData() });
  if (headers.apikey !== 'test-anon-key') return json(401, { message: 'no apikey' });

  if (url.pathname === '/auth/v1/token') {
    const b = JSON.parse(req.postData() || '{}');
    if (url.searchParams.get('grant_type') === 'password') {
      const u = users[b.email];
      if (!u || u.pw !== b.password) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      return json(200, { access_token: `tok-${u.id}`, refresh_token: `ref-${u.id}`, expires_in: 3600, user: { id: u.id, email: b.email } });
    }
    const u = Object.values(users).find((x) => `ref-${x.id}` === b.refresh_token);
    return u ? json(200, { access_token: `tok-${u.id}`, refresh_token: `ref-${u.id}`, expires_in: 3600, user: { id: u.id } }) : json(400, { error: 'invalid_grant' });
  }
  if (url.pathname === '/auth/v1/logout') return json(204);

  const user = tokenUser(headers.authorization);
  if (!user) return json(401, { message: 'JWT required' });
  const table = url.pathname.replace('/rest/v1/', '');
  const staff = user.profile.active;
  if (table === 'profiles') {
    const all = Object.values(users).map((u) => u.profile);
    const id = url.searchParams.get('id');
    return json(200, id ? all.filter((p) => `eq.${p.id}` === id && (staff || p.id === user.id)) : staff ? all : all.filter((p) => p.id === user.id));
  }
  if (!staff) return json(200, []);
  if (table === 'settings') {
    if (method === 'PATCH') { if (user.profile.role !== 'admin') return json(200, []); Object.assign(settings, JSON.parse(req.postData())); return json(200, [settings]); }
    return json(200, [settings]);
  }
  const t = tables[table];
  if (!t) return json(404, { message: 'no table' });
  if (method === 'GET') {
    const from = Number((headers.range || '0-999').split('-')[0]);
    const rows = [...t.values()].slice(from, from + 1000);
    return json(200, table === 'history' ? rows : rows.map((r) => ({ data: r.data, created_at: r.created_at, created_by: r.created_by, updated_at: r.updated_at, updated_by: r.updated_by })));
  }
  if (method === 'POST') {
    const body = JSON.parse(req.postData());
    const list = Array.isArray(body) ? body : [body];
    const out = [];
    for (const r of list) {
      if (t.has(r.id)) return json(409, { code: '23505', message: 'duplicate key' });
      if (table === 'participants' && [...t.values()].some((x) => x.code === r.code)) return json(409, { code: '23505', message: 'participants_code_key' });
      const row = Object.assign({}, r, table === 'history' ? { actor: user.id, at: ts() } : { created_at: ts(), created_by: user.id, updated_at: ts(), updated_by: user.id });
      t.set(r.id, row); out.push(row);
    }
    return json(201, out);
  }
  if (method === 'PATCH') {
    const id = (url.searchParams.get('id') || '').replace('eq.', '');
    const cond = (url.searchParams.get('updated_at') || '').replace('eq.', '');
    const row = t.get(id);
    if (!row || row.updated_at !== cond) return json(200, []);
    Object.assign(row, JSON.parse(req.postData()), { updated_at: ts(), updated_by: user.id });
    return json(200, [row]);
  }
  if (method === 'DELETE') {
    const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, ''));
    if (table === 'participants' && user.profile.role !== 'admin') return json(204);
    ids.forEach((id) => t.delete(id));
    return json(204);
  }
  return json(405, {});
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route('**/js/config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.PPP = window.PPP || {}; window.PPP.CONFIG = { supabaseUrl: '${SUPA}/', supabaseAnonKey: 'test-anon-key', idleMinutes: 30 };` }));
  await ctx.route(`${SUPA}/**`, supabaseMock);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const login = async (email, pw = 'pass1234') => {
    await page.fill('#loginEmail', email);
    await page.fill('#loginPw', pw);
    await page.click('#loginForm button[type=submit]');
  };

  console.log('1. 로그인 화면');
  await page.goto(BASE);
  await page.waitForSelector('#loginForm');
  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'server-login.png') });
  check(!(await page.isVisible('nav.nav')), '로그인 전 메뉴 숨김');
  check(await page.evaluate(() => !window.PPP.store.db), '로그인 전 데이터 없음');
  await login('staff1@test.local', 'wrong');
  check(await page.waitForSelector('text=이메일 또는 비밀번호가 올바르지 않습니다').then(() => true, () => false), '잘못된 비밀번호 안내');

  console.log('2. 비활성 계정');
  await login('new@test.local');
  check(await page.waitForSelector('text=계정 승인 대기').then(() => true, () => false), '비활성 계정 → 승인 대기 화면');
  await page.click('#pendingLogout');
  await page.waitForSelector('#loginForm');

  console.log('3. 직원 로그인 · 등록');
  await login('staff1@test.local');
  await page.waitForSelector('.page-head h1');
  check((await page.textContent('#serverUser')).includes('담당자1'), '상단에 로그인 사용자 표시');
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'server-dashboard.png') });
  check(!(await page.isVisible('#currentUser')), '현재 사용자 선택상자 숨김');
  check(!(await page.isVisible('#seedBtn')), '서버 모드: 샘플 데이터 버튼 없음');
  check(log.filter((l) => l.path.startsWith('/rest/')).every((l) => l.apikey === 'test-anon-key' && /^Bearer tok-u-/.test(l.auth)), 'REST 요청에 anon 키 + 로그인 사용자 토큰');
  await page.goto(BASE + '#/participants/new');
  await page.fill('#alias', '서버테스트(가명)');
  await page.selectOption('#manager', '담당자1');
  await page.click('#pForm button[type=submit]');
  await page.waitForSelector('.stage-board');
  await page.waitForFunction(() => document.getElementById('syncStatus').dataset.state === 'ok' && !window.PPP.supa.ServerAdapter.pending);
  const prow = [...tables.participants.values()][0];
  check(prow && prow.data.alias === '서버테스트(가명)' && prow.code === prow.data.code, '이용자 행 서버 저장 (code·data 일치)');
  check(tables.history.size >= 1 && [...tables.history.values()][0].actor === 'u-staff1', '이력 서버 저장');

  console.log('4. 수정 · 동시 수정 충돌');
  await page.click('text=정보 수정');
  await page.fill('#memo', '첫 수정');
  await page.click('#pForm button[type=submit]');
  await page.waitForSelector('.stage-board');
  await page.waitForFunction(() => !window.PPP.supa.ServerAdapter.pending);
  const patch = log.filter((l) => l.method === 'PATCH' && l.path.startsWith('/rest/v1/participants'));
  check(patch.length === 1 && /updated_at=eq\./.test(patch[0].path), 'PATCH 에 updated_at 조건 포함');
  check(prow.data.memo === '첫 수정', '수정 내용 서버 반영');
  // 다른 담당자가 먼저 수정한 상황
  prow.updated_at = ts(); prow.data = Object.assign({}, prow.data, { memo: '다른 담당자 수정' });
  await page.click('text=정보 수정');
  await page.fill('#memo', '두 번째 수정');
  await page.click('#pForm button[type=submit]');
  check(await page.waitForSelector('text=다른 담당자가 먼저 수정').then(() => true, () => false), '충돌 시 덮어쓰지 않고 안내');
  check(prow.data.memo === '다른 담당자 수정', '다른 담당자 변경 보존');
  await page.waitForFunction(() => document.getElementById('syncStatus').dataset.state === 'error');
  check(true, '상단 저장 상태: 실패 표시');
  await page.click('#reloadBtn');
  await page.click('dialog button[value=ok]');
  await page.waitForFunction(() => document.getElementById('syncStatus').dataset.state === 'ok');
  check(await page.evaluate(() => window.PPP.store.db.participants[0].memo) === '다른 담당자 수정', '다시 불러오기로 서버 최신값 반영');

  console.log('5. 기록 작성 · 삭제');
  const pid = prow.id;
  await page.goto(BASE + `#/p/${pid}/record/new`);
  await page.selectOption('#rtype', '상담');
  await page.fill('#rcontent', '서버 기록 테스트');
  await page.click('#rForm button.btn-primary');
  await page.waitForSelector('text=기록을 저장했습니다');
  await page.waitForFunction(() => !window.PPP.supa.ServerAdapter.pending);
  const rrow = [...tables.records.values()][0];
  check(rrow && rrow.record_date === rrow.data.date && rrow.participant_id === pid, '기록 행 서버 저장');
  await page.click('[data-del-rec]');
  await page.click('dialog button[value=ok]');
  await page.waitForFunction(() => window.PPP.store.db.records.length === 0 && !window.PPP.supa.ServerAdapter.pending);
  check(tables.records.size === 0, '기록 삭제 서버 반영');

  console.log('6. 데이터 관리 · 설정 (직원)');
  await page.goto(BASE + '#/data');
  check(!(await page.isVisible('#resetBtn')) && !(await page.isVisible('#restoreFile')), '직원: 초기화·가져오기 없음');
  await page.goto(BASE + '#/settings');
  check(await page.getAttribute('#staff', 'readonly') !== null && await page.getAttribute('#orgName', 'readonly') !== null, '직원: 설정 읽기 전용');

  console.log('7. 로그아웃 · 관리자');
  await page.click('#logoutBtn');
  await page.waitForSelector('#loginForm');
  check(await page.evaluate(() => sessionStorage.getItem('ppp.session')) === null, '로그아웃 시 세션 삭제');
  await login('admin@test.local');
  await page.waitForSelector('.page-head h1');
  await page.goto(BASE + '#/data');
  check(await page.isVisible('text=백업 가져오기 (관리자)'), '관리자: 백업 가져오기 표시');
  await page.goto(BASE + '#/settings');
  await page.fill('#orgName', '테스트기관');
  await page.click('#setForm button.btn-primary');
  await page.waitForFunction(() => !window.PPP.supa.ServerAdapter.pending);
  check(settings.org_name === '테스트기관', '관리자: 기관명 변경 서버 반영');

  console.log('8. 새로고침 후 세션 유지');
  await page.reload();
  await page.waitForSelector('.page-head h1');
  check((await page.textContent('#serverUser')).includes('관리자'), '새로고침 후 로그인 유지(같은 탭)');

  check(errors.length === 0, `페이지 오류 없음${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  console.log(failed ? `\n실패 ${failed}건` : '\n모든 서버 모드 테스트 통과');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
