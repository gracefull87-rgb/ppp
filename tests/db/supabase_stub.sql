-- 로컬 검증용 최소 Supabase 환경 (실제 Supabase 에는 적용하지 않는다)
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Supabase 는 public 스키마의 새 테이블에 anon/authenticated 권한을 기본 부여한다. 마이그레이션이 이를 회수하는지 검증하기 위해 동일하게 설정
alter default privileges in schema public grant all on tables to anon, authenticated;
