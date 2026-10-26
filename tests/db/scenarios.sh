#!/usr/bin/env bash
# 설치 상황별 검증: (A) 마이그레이션 두 번 실행, (B) 예제 profiles 가 먼저 있는 프로젝트, (C) 데이터가 있을 때 초기화 차단
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"; PORT=55433; FAIL=0
RUN=""; [ "$(id -u)" = "0" ] && RUN="runuser -u postgres --"
cleanup() { $RUN "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
[ -n "$RUN" ] && chown postgres "$TMP"
$RUN "$BIN/initdb" -D "$TMP/data" -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null 2>&1
$RUN "$BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
cp "$ROOT"/tests/db/*.sql "$ROOT"/supabase/migrations/*.sql "$ROOT"/supabase/manual/*.sql "$TMP/"; chmod a+r "$TMP"/*.sql
INIT="$TMP/20261026000000_init.sql"; BACKFILL="$TMP/20261027000000_backfill_profiles.sql"
psql_db() { local db=$1; shift; $RUN psql -h "$TMP" -p $PORT -U postgres -d "$db" -X -q -v ON_ERROR_STOP=1 "$@"; }
fresh() { $RUN psql -h "$TMP" -p $PORT -U postgres -d postgres -X -q -c "drop database if exists $1" 2>/dev/null -c "create database $1" >/dev/null; psql_db "$1" -f "$TMP/supabase_stub.sql" >/dev/null 2>&1 || $RUN psql -h "$TMP" -p $PORT -U postgres -d "$1" -X -q -f "$TMP/supabase_stub.sql" 2>&1 | grep -v "already exists"; }
expect() { if [ "$1" = "$2" ]; then echo "  ✓ $3"; else echo "  ✗ $3 (기대: $2 / 실제: $1)"; FAIL=1; fi; }
check() { psql_db "$1" -At -F'|' -f "$TMP/check_install.sql"; }

echo "A. 마이그레이션을 두 번 실행한 경우"
fresh a
psql_db a -f "$INIT" >/dev/null
out=$(psql_db a -f "$INIT" 2>&1); expect "$(grep -o '42P07\|relation "profiles" already exists' <<<"$out" | head -1)" 'relation "profiles" already exists' '두 번째 실행 시 사용자와 같은 오류'
psql_db a -f "$BACKFILL" >/dev/null && psql_db a -f "$BACKFILL" >/dev/null
expect "$(check a)" '7|t|f|0|0' '확인 SQL: 설치 완료 상태로 표시 (7|앱용|예제 아님|RLS 꺼진 표 0)'

echo "B. 예제(Starter) profiles 가 먼저 있는 경우"
fresh b
psql_db b -f "$TMP/starter_profiles.sql" >/dev/null
out=$(psql_db b -f "$INIT" 2>&1); expect "$(grep -o 'relation "profiles" already exists' <<<"$out" | head -1)" 'relation "profiles" already exists' '마이그레이션 시 사용자와 같은 오류'
expect "$(check b | cut -d'|' -f1-3)" '1|f|t' '확인 SQL: 예제 profiles 로 판별'
psql_db b -f "$TMP/reset_fresh_project.sql" >/dev/null 2>"$TMP/reset.err"; rc=$?; [ $rc = 0 ] || cat "$TMP/reset.err"; expect "$rc" 0 '초기화 SQL 실행'
psql_db b -f "$INIT" >/dev/null 2>&1; expect "$?" 0 '초기화 후 마이그레이션 성공'
psql_db b -f "$BACKFILL" >/dev/null 2>&1; expect "$?" 0 '프로필 보완 SQL 성공'
expect "$(check b)" '7|t|f|0|1' '설치 완료 + 먼저 만든 계정도 프로필 생성(비활성)'
expect "$(psql_db b -At -c "select active from public.profiles where id = '00000000-0000-0000-0000-0000000000ee'")" 'f' '먼저 만든 계정은 비활성'
psql_db b -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ef', 'later@test.local')" >/dev/null
expect "$(psql_db b -At -c "select display_name || ':' || active from public.profiles where id = '00000000-0000-0000-0000-0000000000ef'")" 'later:false' '이후 새 계정은 앱 트리거로 비활성 프로필 생성'

echo "C. 이용자 데이터가 있으면 초기화 차단"
psql_db b -c "select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ee', false)" -c "insert into public.participants (id, code, data) values ('p_keep01', 'PPP-2026-001', '{\"id\":\"p_keep01\",\"code\":\"PPP-2026-001\",\"status\":\"active\"}')" >/dev/null
out=$(psql_db b -f "$TMP/reset_fresh_project.sql" 2>&1)
expect "$(grep -c '이용자 데이터가 있어' <<<"$out")" 1 '초기화 중단 메시지'
expect "$(psql_db b -At -c 'select count(*) from public.participants')" 1 '데이터 보존'

[ $FAIL = 0 ] && echo "모든 설치 상황 테스트 통과" || { echo "실패 있음"; exit 1; }
