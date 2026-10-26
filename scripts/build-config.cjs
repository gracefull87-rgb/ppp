/* Vercel 빌드 시 환경변수로 js/config.js 를 만든다 (저장소의 config.js 는 비워 둔 채 유지)
 * 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY (anon 또는 sb_publishable_ 키), 선택: IDLE_MINUTES
 * 두 값이 모두 없으면 아무것도 바꾸지 않는다 → 로컬 모드로 배포
 * 관리자 키(service_role / sb_secret_)가 들어오면 빌드를 실패시켜 공개 배포를 막는다.
 */
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || path.join(__dirname, '..', 'js', 'config.js');
const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
const idle = Number(process.env.IDLE_MINUTES) || 30;
const fail = (msg) => { console.error(`[build-config] 오류: ${msg}`); process.exit(1); };

if (!url && !key) {
  console.log('[build-config] SUPABASE_URL·SUPABASE_ANON_KEY 가 없어 로컬 모드로 배포합니다.');
  process.exit(0);
}
if (!url || !key) fail('SUPABASE_URL 과 SUPABASE_ANON_KEY 를 둘 다 설정하세요.');
if (!/^https:\/\/[^\s'"\\]+$/.test(url)) fail('SUPABASE_URL 은 https:// 로 시작하는 주소여야 합니다.');
if (/[\s'"\\]/.test(key)) fail('SUPABASE_ANON_KEY 에 공백·따옴표가 들어 있습니다. 키만 다시 복사해 넣으세요.');

// 관리자 키 차단
if (/^sb_secret_/.test(key)) fail('secret 키(sb_secret_…)는 넣으면 안 됩니다. Publishable 키 또는 anon 키를 사용하세요.');
if (key.split('.').length === 3) {
  let role = '';
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role; } catch (e) { fail('SUPABASE_ANON_KEY 형식을 읽을 수 없습니다. 키 전체를 복사했는지 확인하세요.'); }
  if (role !== 'anon') fail(`이 키의 역할은 '${role}' 입니다. service_role 키는 RLS 를 무시하므로 절대 사용할 수 없습니다. anon 키를 넣으세요.`);
} else if (!/^sb_publishable_/.test(key)) {
  fail('anon 키(eyJ…) 또는 Publishable 키(sb_publishable_…)가 아닙니다.');
}
if (!/\.supabase\.co$/.test(new URL(url).host)) console.warn('[build-config] 경고: supabase.co 가 아닌 주소입니다. vercel.json CSP 의 connect-src 에 이 주소를 추가해야 합니다.');

fs.writeFileSync(out, `/* Vercel 빌드 시 환경변수로 생성된 파일 (scripts/build-config.cjs) — 저장소의 원본은 비어 있음 */
window.PPP = window.PPP || {};
window.PPP.CONFIG = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)},
  idleMinutes: ${idle},
};
`);
console.log(`[build-config] 서버 모드 설정을 만들었습니다: ${new URL(url).host}`);
