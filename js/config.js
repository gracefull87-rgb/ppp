/* 앱 설정
 * Supabase 를 사용하려면 Supabase 대시보드 > Project Settings > API 의 값을 입력하세요.
 *   - supabaseUrl     : Project URL (예: https://abcdefghijkl.supabase.co)
 *   - supabaseAnonKey : anon / public 키 (공개용 키. 데이터 보호는 RLS 정책이 담당)
 * 두 값을 비워 두면 기존처럼 이 PC 브라우저에만 저장하는 '로컬 모드'로 동작합니다.
 *
 * ⚠ service_role 키(또는 secret 키)는 RLS 를 무시하는 관리자 키입니다. 절대 이 파일이나 저장소에 넣지 마세요.
 */
window.PPP = window.PPP || {};
window.PPP.CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  idleMinutes: 30, // 이 시간(분) 동안 조작이 없으면 자동 로그아웃 (서버 모드)
};
