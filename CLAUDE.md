# CLAUDE.md — AI 개발 지침

## 1. 프로젝트 목적
노원구장애인가족지원센터 **평생과정설계(PPP)** 사업에서 사회복지사 3명이 기관 PC로 참여자(장애 당사자·가족)의 진행상황과 서식(자기소개서, 미래설계 실천계획서, 행복한 미래 이야기), 상담·회의·활동 기록을 효율적으로 기록·저장·출력하도록 돕는 웹앱이다.
당사자의 **존엄성·자기결정권·접근성**을 최우선으로 하며, 기록은 “나(당사자)”의 이야기라는 관점을 유지한다.

## 2. 작업 원칙
1. 코드 변경 전 관련 문서(PROJECT_SPEC → FEATURES → DATA_MODEL → UI_UX → SECURITY)를 먼저 읽고 일관성을 확인한다.
2. 서식 항목은 기관 HWP 원본 양식의 **순서·문구를 그대로** 유지한다. 임의로 항목을 추가·삭제·재해석하지 않는다. 변경이 필요하면 `[확인 필요]`로 남기고 담당자에게 묻는다.
3. 법령·공식 평가지표·보존기간 등 확인되지 않은 사항은 사실처럼 쓰지 말고 `[확인 필요]`로 표기한다.
4. 샘플·테스트·문서에는 **가상 데이터만** 사용한다. 실제 이용자 정보는 절대 커밋하지 않는다.
5. 개인정보는 최소수집한다. 식별은 `참여자 코드 + 가명`으로 하고, 실명·연락처·주소는 선택 입력이며 익명 모드에서 가린다.

## 3. 기술 스택
- HTML + CSS + JavaScript (프레임워크·빌드 도구 없음, 외부 CDN 없음)
- 클래식 `<script>` + 전역 네임스페이스 `window.PPP` — `index.html`을 더블클릭(file://)해도 동작해야 하므로 ES 모듈을 쓰지 않는다.
- 저장: `PPP.store.adapter` — `js/config.js`가 비어 있으면 `LocalStorageAdapter`, Supabase URL·anon 키가 있으면 `PPP.supa.ServerAdapter`(서버 모드). DATA_MODEL.md §6.
- 서버: Supabase (Auth + PostgREST, **supabase-js 미사용**, `fetch`로 직접 호출). 스키마·RLS는 `supabase/migrations/*.sql`
- 배포: Vercel 정적 호스팅 (`vercel.json`에 보안 헤더)
- 테스트: Playwright E2E (`node tests/e2e.cjs`, `node tests/e2e-server.cjs`), DB RLS (`bash tests/db/run.sh`)

## 4. 파일 구조
```
index.html            앱 셸(상단바·메뉴·#view)
js/config.js          Supabase URL·anon 키 (비우면 로컬 모드)
css/style.css         테마(블루·화이트), 반응형, 인쇄(@media print)
js/util.js            공통 유틸(이스케이프, 날짜, 마스킹, 토스트, 확인창, 다운로드)
js/schema.js          업무 단계(STEPS), 기록 유형, 영역, 서식 3종 스키마
js/store.js           저장소 어댑터, CRUD, 수정 이력, 진행률 계산, 백업 검증·복원
js/supabase.js        Supabase 인증·REST 호출, ServerAdapter(변경분 동기화·충돌 차단)
js/sample.js          가상 샘플 데이터 생성
js/formEngine.js      스키마 → 입력 화면/출력 화면 렌더링, 수집, 검증
js/charts.js          SVG 도넛·막대 차트 (범례·표 보기·툴팁)
js/export.js          백업(JSON), CSV(UTF-8 BOM), 엑셀(.xls SpreadsheetML)
js/views.js           화면: 대시보드, 참여자, 상세, 서식, 출력, 기록, 데이터 관리, 설정
js/app.js             라우터(hash), 글자 크기·익명 모드·현재 사용자
tests/e2e.cjs         E2E 스모크 테스트 (로컬 모드)
tests/e2e-server.cjs  E2E (서버 모드, 가짜 Supabase API)
tests/db/             RLS 검증 (임시 PostgreSQL + Supabase 최소 환경)
supabase/migrations/  Supabase 스키마·RLS·트리거
vercel.json           배포 설정·보안 헤더
```

## 5. 코딩 규칙
- 사용자 입력을 HTML에 넣을 때는 **반드시 `PPP.esc()`** 를 거친다. `innerHTML`에 원시 값을 넣지 않는다.
- 모든 쓰기 작업은 `PPP.store`를 통해서만 하고, 변경 시 `addHistory()`로 수정 이력을 남긴다. 민감 필드(`sensitive: true`)는 이력에 값 대신 “(변경됨)”만 남긴다.
- 서식 필드를 추가할 때는 `schema.js`만 수정한다. 렌더링·수집·출력·이력 라벨은 엔진이 처리한다. 기존 필드 `k`(키)는 바꾸지 않는다(저장 데이터 호환).
- 모든 입력에는 `<label>` 또는 `aria-label`을 붙이고, 오류는 오류 요약 + 필드 옆 메시지로 표시한다.
- 색상만으로 정보를 전달하지 않는다(차트는 범례 수치 + 표 보기, 상태는 텍스트 배지).
- 한국어 UI 문구는 존댓말, 짧고 구체적으로 쓴다.
- 들여쓰기 2칸, 세미콜론 사용, 함수·변수는 camelCase.

## 6. 금지사항
- 실제 이용자 개인정보를 코드·샘플·테스트·이슈·커밋 메시지에 포함
- service_role/secret 키를 코드·설정·문서에 포함, RLS 비활성화, `anon` 역할에 테이블 권한 부여
- 새 테이블을 만들면서 RLS 활성화·정책·`tests/db/rls_test.sql` 검증을 빠뜨리는 것
- 외부 CDN·분석 스크립트·추적 코드 추가 (CSP가 `'self'`만 허용)
- 사진·주민등록번호 등 고위험 정보 저장 기능 추가 (사진은 출력본에 직접 부착)
- 수정 이력 삭제·우회 기능, 종결 검토 단계 생략
- 서식 원본 문구 임의 변경
- 확인되지 않은 법령·지침을 단정적으로 표기

## 7. 완료 기준 (Definition of Done)
- [ ] `node tests/e2e.cjs`·`node tests/e2e-server.cjs` 전체 통과, 브라우저 콘솔 오류 없음
- [ ] DB 변경 시 새 마이그레이션 파일 추가(기존 파일 수정 금지) + `bash tests/db/run.sh` 통과
- [ ] 새 기능에 대한 E2E 확인 항목 추가
- [ ] 키보드만으로 기능 수행 가능, 포커스 표시 확인
- [ ] 1440px(PC)과 390px 폭에서 가로 스크롤 없음
- [ ] 인쇄 미리보기에서 서식이 A4로 출력됨
- [ ] 백업 → 복원 후 데이터 동일
- [ ] 관련 문서 갱신

## 8. 변경 시 문서 갱신 규칙
| 변경 내용 | 갱신할 문서 |
|---|---|
| 서식 항목·업무 단계·기록 유형 | FEATURES.md, DATA_MODEL.md, (필요 시) PROJECT_SPEC.md |
| 데이터 구조·스키마 버전 | DATA_MODEL.md (`SCHEMA_VERSION` 증가 + `migrate()` 작성) |
| 화면·메뉴·문구 규칙 | UI_UX.md |
| 개인정보·저장·내보내기·RLS·인증 | SECURITY.md, README.md, (DB 변경 시) DATA_MODEL.md §6 |
| 일정·우선순위 | DEVELOPMENT_PLAN.md |
