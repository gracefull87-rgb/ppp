-- RLS·트리거 검증. 실패 시 예외로 중단된다.
\set ON_ERROR_STOP on
\set QUIET on

-- 테스트 계정: admin(관리자), s1·s2(직원), s3(비활성)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"관리자"}'),
  ('00000000-0000-0000-0000-000000000001', 's1@test.local', '{"display_name":"담당자1"}'),
  ('00000000-0000-0000-0000-000000000002', 's2@test.local', '{"display_name":"담당자2"}'),
  ('00000000-0000-0000-0000-000000000003', 's3@test.local', '{}');
update public.profiles set active = true where id <> '00000000-0000-0000-0000-000000000003';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

create schema t;
create function t.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok   거부됨: % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL 허용되면 안 됨: %', label;
end $$;
create function t.expect_count(sql text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || sql || ') t' into c;
  if c <> n then raise exception 'FAIL %: 기대 %, 실제 %', label, n, c; end if;
  raise notice 'ok   %: %건', label, c;
end $$;
create function t.expect_rows(sql text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute sql;
  get diagnostics c = row_count;
  if c <> n then raise exception 'FAIL %: 기대 %행, 실제 %행', label, n, c; end if;
  raise notice 'ok   %: %행 변경', label, c;
end $$;
grant execute on all functions in schema t to anon, authenticated;
grant usage on schema t to anon, authenticated;

\echo '--- 1. 비활성 프로필 자동 생성'
select t.expect_count($$select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000003' and not active and display_name = 's3'$$, 1, '새 Auth 사용자 → 비활성 프로필');

\echo '--- 2. 직원 s1: 등록·수정'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into public.participants (id, code, data) values ('p_test01', 'PPP-2026-001', '{"id":"p_test01","code":"PPP-2026-001","status":"active","alias":"가상(가명)"}');
insert into public.participants (id, code, data, closing_requested_by) values ('p_test02', 'PPP-2026-002', '{"id":"p_test02","code":"PPP-2026-002","status":"active"}', '00000000-0000-0000-0000-000000000002');
select t.expect_count($$select 1 from public.participants where id = 'p_test02' and closing_requested_by is null$$, 1, '등록 시 closing_requested_by 클라이언트 값 무시');
select t.expect_count($$select 1 from public.participants where created_by = '00000000-0000-0000-0000-000000000001'$$, 2, '작성자 서버 기록');
insert into public.documents (id, participant_id, form_key, data) values ('d_test01', 'p_test01', 'actionPlan', '{"id":"d_test01","participantId":"p_test01","formKey":"actionPlan","data":{"year":2026}}');
select t.expect_fail($$insert into public.documents (id, participant_id, form_key, data) values ('d_test02', 'p_test01', 'actionPlan', '{"id":"d_test02","participantId":"p_test01","formKey":"actionPlan","data":{"year":2026}}')$$, '같은 연도 실천계획서 중복');
insert into public.records (id, participant_id, record_date, type, data) values ('r_test01', 'p_test01', '2026-10-01', '상담', '{"id":"r_test01","participantId":"p_test01","date":"2026-10-01","type":"상담"}');
select t.expect_fail($$insert into public.records (id, participant_id, record_date, type, data) values ('r_test02', 'p_test01', '2026-10-01', '상담', '{"id":"r_test02","participantId":"p_test99","date":"2026-10-01","type":"상담"}')$$, '컬럼과 data 불일치');
select t.expect_fail($$insert into public.participants (id, code, data) values ('p_test03', 'PPP-2026-003', '{"id":"p_test03","code":"PPP-2026-003","status":"closed"}')$$, '직원이 종결 상태로 바로 등록');
update public.participants set data = data || '{"alias":"수정됨"}' where id = 'p_test01';
select t.expect_fail($$update public.participants set code = 'X-1' where id = 'p_test01'$$, '코드 컬럼 직접 수정(권한 없음)');
select t.expect_fail($$update public.participants set created_by = '00000000-0000-0000-0000-000000000002' where id = 'p_test01'$$, '작성자 위조');

\echo '--- 3. 이력: 추가만, 작성자 위조 불가'
insert into public.history (id, participant_id, data, actor, at) values ('h_test01', 'p_test01', '{"summary":"테스트"}', '00000000-0000-0000-0000-000000000002', '2000-01-01');
select t.expect_count($$select 1 from public.history where id = 'h_test01' and actor = '00000000-0000-0000-0000-000000000001' and at > '2020-01-01'$$, 1, '이력 작성자·시각 서버 강제');
select t.expect_fail($$update public.history set data = '{}' where id = 'h_test01'$$, '이력 수정');
select t.expect_fail($$delete from public.history where id = 'h_test01'$$, '이력 삭제');

\echo '--- 4. 삭제 권한'
select t.expect_rows($$delete from public.participants where id = 'p_test02'$$, 0, '직원의 이용자 삭제 차단');
delete from public.records where id = 'r_test01';
select t.expect_count($$select 1 from public.records where id = 'r_test01'$$, 0, '직원의 기록 삭제 허용');

\echo '--- 5. 종결 2인 검토'
select t.expect_fail($$update public.participants set data = data || '{"status":"closed"}' where id = 'p_test01'$$, '검토 요청 없이 바로 종결');
update public.participants set data = data || '{"status":"closing"}' where id = 'p_test01';
select t.expect_fail($$update public.participants set data = data || '{"status":"closed"}' where id = 'p_test01'$$, '요청자 본인 승인');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
update public.participants set data = data || '{"status":"closed"}' where id = 'p_test01';
select t.expect_count($$select 1 from public.participants where id = 'p_test01' and status = 'closed'$$, 1, '다른 직원 승인으로 종결');

\echo '--- 6. 관리자 전용'
select t.expect_count($$select 1 from public.audit_log$$, 0, '직원은 감사로그 열람 불가');
select t.expect_rows($$update public.settings set org_name = '변경'$$, 0, '직원 설정 변경 차단');
select t.expect_rows($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000002'$$, 0, '직원의 관리자 승격 차단');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.expect_count($$select 1 from public.audit_log where table_name = 'records' and action = 'DELETE' and old_data ->> 'id' = 'r_test01'$$, 1, '관리자: 삭제된 기록이 감사로그에 보존');
update public.settings set org_name = '테스트기관';
delete from public.participants where id = 'p_test02';
select t.expect_count($$select 1 from public.participants where id = 'p_test02'$$, 0, '관리자 이용자 삭제');

\echo '--- 7. 비활성 계정·비로그인'
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select t.expect_count($$select 1 from public.participants$$, 0, '비활성 계정: 이용자 0건');
select t.expect_count($$select 1 from public.profiles$$, 1, '비활성 계정: 본인 프로필만');
select t.expect_fail($$insert into public.participants (id, code, data) values ('p_test09', 'PPP-2026-009', '{"id":"p_test09","code":"PPP-2026-009","status":"active"}')$$, '비활성 계정 등록');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.expect_fail($$select 1 from public.participants$$, '비로그인 이용자 조회');
select t.expect_fail($$select 1 from public.profiles$$, '비로그인 프로필 조회');
select t.expect_fail($$select 1 from public.history$$, '비로그인 이력 조회');
reset role;

\echo '--- 8. 모든 public 테이블 RLS 활성화'
select t.expect_count($$select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$, 0, 'RLS 꺼진 테이블');
\echo '모든 DB 테스트 통과'
