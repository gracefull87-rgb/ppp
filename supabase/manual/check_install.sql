-- 설치 상태 확인 (읽기 전용). Supabase SQL Editor 에서 실행하고 결과 한 줄을 확인하세요.
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('profiles', 'settings', 'participants', 'documents', 'records', 'history', 'audit_log')) as "앱 테이블 수(7이면 설치됨)",
  exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name') as "앱용 profiles",
  exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name in ('username', 'full_name', 'avatar_url')) as "예제(Starter) profiles",
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as "RLS 꺼진 테이블 수(0이어야 함)",
  (select count(*) from public.profiles) as "프로필 수";
