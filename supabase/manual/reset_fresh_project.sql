-- =====================================================================
-- ⚠ 새 프로젝트 전용 초기화 — 이용자 데이터가 없는 프로젝트에서만 실행
-- 앱 테이블과, 프로젝트 생성 시 예제(User Management Starter 등)가 만든 profiles·트리거를 지운다.
-- 이용자(participants) 데이터가 1건이라도 있으면 아무것도 지우지 않고 중단한다.
-- 실행 후: migrations 폴더의 SQL 을 파일 이름 순서대로 다시 실행한다.
-- =====================================================================
do $$
declare has_rows boolean := false;
begin
  if to_regclass('public.participants') is not null then
    execute 'select exists (select 1 from public.participants)' into has_rows;
  end if;
  if has_rows then
    raise exception '이용자 데이터가 있어 초기화를 중단합니다. 이 스크립트는 새 프로젝트에서만 사용하세요.';
  end if;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.audit_log, public.history, public.records, public.documents, public.participants, public.settings, public.profiles cascade;
drop schema if exists private cascade;
