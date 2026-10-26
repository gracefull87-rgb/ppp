#!/usr/bin/env bash
# Supabase 마이그레이션 RLS 검증 — 임시 PostgreSQL 클러스터에서 실행
# 사용: bash tests/db/run.sh   (PostgreSQL 14+ 의 initdb/pg_ctl 필요)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"
PORT=55432
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
RUN=""; [ "$(id -u)" = "0" ] && { chown -R postgres "$TMP"; RUN="runuser -u postgres --"; }
$RUN "$BIN/initdb" -D "$TMP/data" -U postgres -E UTF8 --locale=C.UTF-8 2>/dev/null >/dev/null
$RUN "$BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
PSQL=(psql -h "$TMP" -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
cp "$ROOT/tests/db/"*.sql "$ROOT/supabase/migrations/"*.sql "$TMP/"; chmod a+r "$TMP"/*.sql
$RUN "${PSQL[@]}" -f "$TMP/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do $RUN "${PSQL[@]}" -f "$TMP/$(basename "$f")"; done
$RUN "${PSQL[@]}" -o /dev/null -f "$TMP/rls_test.sql" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1 /; s/^NOTICE //'
exit "${PIPESTATUS[0]}"
