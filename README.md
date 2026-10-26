# 평생과정설계 기록관리 웹앱

노원구장애인가족지원센터 **평생과정설계(PPP) 지원사업**의 참여자 진행상황, 서식, 상담·회의·활동 기록을 관리하는 웹앱입니다.

> 저장 방식은 두 가지입니다.
> - **서버 모드 (Supabase, 권장)**: `js/config.js`에 Supabase 주소·키를 넣으면 직원 계정 로그인 후 서버 DB에 저장됩니다. 모든 테이블에 RLS(행 수준 보안)가 적용됩니다. → 아래 [Supabase 연결](#supabase-연결-서버-모드)
> - **로컬 모드**: 설정이 비어 있으면 이 PC 브라우저에만 저장합니다(동기화·암호화·권한관리 없음, 정기 백업 필수).

## 대상 사용자
- 평생과정설계 담당 사회복지사 3명 (기관 PC, PC 화면 우선)

## 주요 기능
| 기능 | 설명 |
|---|---|
| 대시보드 | 주요 지표 6종, 단계별 현황, 원형 그래프 5종(단계·장애유형·연령대·성별·실천계획 영역), 미래설계서비스 이용현황 막대, 세부 단계별 완료 인원, 월별 기록 추이, 담당자별 현황, 참여자별 진행상황 표와 알림 |
| 이용자 관리 | 등록·수정·검색(코드/가명/장애유형/담당자, 단계·상태 필터), 보호자 동의 확인 |
| 진행 단계 | 준비 → 계획(지원회의) → 실천 → 평가(모니터링) 13단계 체크, 기록 작성 시 자동 완료 |
| 서식 | ① 평생과정설계 자기소개서 ② 미래설계 실천계획서(연도별) ③ 행복한 미래 이야기(연간 돌아보기) — HWP 양식 항목 그대로 |
| 기록 | 상담·각종 회의·실천활동·활동평가·실천과정 평가·자조활동 기록 |
| 종결 관리 | 종결 요청 → 다른 담당자 검토 승인, 보호자 의사 확인 필수 |
| 수정 이력 | 등록·수정·삭제·단계·상태 변경 자동 기록 |
| PDF 출력 | 서식을 A4 양식으로 인쇄 / ‘PDF로 저장’ |
| 엑셀·CSV | 참여자 현황·기록·실천계획 (실명 기본 제외) |
| 백업·복원 | JSON 백업, 복원 전 검증(형식·무결성·연결관계)과 자동 사전 백업 |
| 접근성 | 글자 크기 6단계(가-/가/가+), 키보드 조작, 익명 모드 |

## 실행 방법
### 1) 바로 실행 (설치 불필요)
`index.html` 파일을 Chrome 또는 Edge로 엽니다.
> 같은 PC라도 **브라우저나 파일 위치가 바뀌면 다른 저장공간**을 사용합니다. 항상 같은 방법으로 여세요.

### 2) 로컬 서버
```bash
npx serve .          # 또는 python3 -m http.server 8080
```

### 3) Vercel 배포
1. 이 저장소를 Vercel에 Import → Framework: **Other**, Build Command 없음, Output: 루트(`.`)
2. 배포 후 URL로 접속합니다. `vercel.json`이 보안 헤더(CSP 등)와 검색엔진 차단을 설정합니다.
> ⚠️ 공개 URL에는 로그인 기능이 없습니다. 데이터는 접속한 브라우저에만 저장되므로 서버로 전송되지는 않지만, **Vercel 비밀번호 보호(Deployment Protection) 등 접근 제한 설정 여부는 [확인 필요]** 입니다.

## Supabase 연결 (서버 모드)
### 1) 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트 생성 (리전·요금제는 기관 정책 확인 [확인 필요])
2. **Authentication > Sign In / Providers** 에서 *Allow new users to sign up* 을 **끕니다** (계정은 관리자만 발급)

### 2) 스키마·RLS 적용
**SQL Editor** 에서 `supabase/migrations/` 의 파일을 **이름 순서대로 한 번씩** 실행합니다. (CLI 사용 시 `supabase db push`)
1. `20261026000000_init.sql` → 테이블 7개, RLS 정책, 트리거, 감사로그
2. `20261027000000_backfill_profiles.sql` → 미리 만들어 둔 Auth 계정에도 프로필 생성 (여러 번 실행해도 안전)

**`relation "profiles" already exists` 오류가 나면**
1. `supabase/manual/check_install.sql` 을 실행해 결과를 확인합니다.
   | 결과 | 의미 | 할 일 |
   |---|---|---|
   | 앱 테이블 수 **7**, 앱용 profiles **true** | 이미 설치되어 있음 (두 번 실행한 경우) | init 은 다시 실행하지 말고 2번 파일(backfill)만 실행 |
   | 예제(Starter) profiles **true** | 프로젝트 생성 시 예제가 만든 profiles 가 있음 | 아래 초기화 후 다시 설치 |
2. 초기화(새 프로젝트만): `supabase/manual/reset_fresh_project.sql` 실행 → init → backfill 순서로 다시 실행
   - 이용자 데이터가 1건이라도 있으면 초기화는 자동으로 중단됩니다.
3. 마지막으로 `check_install.sql` 결과가 `7 | true | false | 0` 인지 확인합니다.

### 3) 직원 계정 만들기
1. **Authentication > Users > Add user** 로 직원 이메일·비밀번호 생성 (*Auto Confirm User* 체크)
   - 새 계정은 자동으로 **비활성** 상태입니다. 활성화 전에는 로그인해도 아무 데이터도 볼 수 없습니다.
2. **SQL Editor** 에서 이름·권한을 지정하고 활성화합니다.
```sql
-- 첫 관리자 (1~2명만)
update public.profiles set display_name = '관리자이름', role = 'admin', active = true
where id = (select id from auth.users where email = 'admin@기관도메인');

-- 직원
update public.profiles set display_name = '담당자1', active = true
where id = (select id from auth.users where email = 'staff1@기관도메인');

-- 퇴사·휴직 시 즉시 비활성화
update public.profiles set active = false
where id = (select id from auth.users where email = 'staff1@기관도메인');
```
> `display_name` 은 담당자 목록·수정 이력·종결 검토에 표시되는 이름입니다.

### 4) 앱에 연결
Supabase **Project Settings > API Keys** 에서 *Project URL* 과 공개 키를 확인합니다.
공개 키는 **anon public**(`eyJ…`, Legacy API keys 탭) 또는 **Publishable key**(`sb_publishable_…`) 중 하나를 쓰면 됩니다.

**방법 A — Vercel 환경변수 (권장, 키가 저장소에 남지 않음)**
1. Vercel 프로젝트 > **Settings > Environment Variables** 에 추가
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | anon 또는 Publishable 키 |
   | `IDLE_MINUTES` (선택) | 자동 로그아웃 시간(분), 기본 30 |
2. **Deployments > 최신 배포 > Redeploy** (환경변수는 다시 배포해야 반영됩니다)
3. 배포 시 `scripts/build-config.cjs` 가 `js/config.js` 를 만들어 넣습니다. 저장소의 `js/config.js` 는 비워 둡니다.
   - 관리자 키(`service_role`, `sb_secret_…`)를 넣거나 값이 하나만 있으면 **배포가 실패**하고 Build Logs 에 이유가 표시됩니다.

**방법 B — `js/config.js` 에 직접 입력** (Vercel 없이 쓰거나 PC에서 `index.html` 을 바로 열 때)
```js
supabaseUrl: 'https://xxxxxxxx.supabase.co',
supabaseAnonKey: '공개 키',   // 따옴표 안에 붙여넣기
```

- 공개 키는 원래 브라우저에 노출되는 키입니다. 데이터는 RLS가 보호하므로 로그인·활성화된 직원만 조회할 수 있습니다.
- ⚠️ **service_role(또는 secret) 키는 어느 방법으로도 넣지 마세요.** RLS를 무시하는 관리자 키입니다.
- 사용자 정의 도메인을 쓰면 `vercel.json` CSP의 `connect-src` 에 그 주소를 추가하세요.

### 5) 기존 로컬 데이터 옮기기
1. (연결 전) 로컬 모드에서 **데이터 관리 → 백업 파일 다운로드**
2. 서버 모드에서 **관리자 계정**으로 로그인 → **데이터 관리 → 백업 가져오기 (관리자)**
3. 가져오기 후 대시보드 건수를 확인합니다. 가상 샘플 데이터가 섞여 있다면 가져오기 전에 로컬에서 정리하세요.

### 서버 모드 사용 시 달라지는 점
- 상단에 로그인 사용자·저장 상태(● 서버에 저장됨 / 저장 중 / 저장 실패)·**다시 불러오기**·**로그아웃** 이 표시됩니다.
- 다른 담당자가 바꾼 내용은 **다시 불러오기** 로 가져옵니다. 같은 항목을 동시에 고치면 나중 저장이 거부되어 덮어쓰기를 막습니다.
- 브라우저 탭을 닫거나 30분 동안 조작이 없으면 자동 로그아웃됩니다.
- 이용자 삭제·기관명 변경·백업 가져오기는 관리자만 할 수 있고, 전체 초기화·가상 샘플 데이터는 사용할 수 없습니다.

## 사용법
1. 서버 모드는 직원 계정으로 로그인합니다. 로컬 모드는 상단 **현재 사용자**에서 본인을 선택합니다(수정 이력·종결 검토에 사용).
2. **설정**에서 기관명과 담당자 목록을 확인합니다.
3. **이용자 관리 → 참여자 등록**: 가명, 담당자, 지원 시작일, 보호자 동의를 입력합니다.
4. 참여자 상세에서 **진행 단계**를 체크하거나, **기록 작성**으로 상담·회의를 기록하면 해당 단계가 자동 완료됩니다.
5. **서식** 탭에서 자기소개서·실천계획서·행복한 미래 이야기를 작성하고 **PDF 출력**합니다.
6. 종결 시 **종결 요청** → 다른 담당자가 현재 사용자를 바꿔 **검토 승인**합니다.
7. **데이터 관리**에서 주 1회 이상 백업합니다.

처음 둘러볼 때는 대시보드 또는 데이터 관리에서 **가상 샘플 데이터**를 불러올 수 있습니다(실제 정보 아님).

## 데이터 저장 및 백업 주의사항
- 브라우저의 “인터넷 사용 기록/쿠키 및 사이트 데이터 삭제”를 하면 데이터가 **모두 지워집니다**.
- 시크릿(InPrivate) 창에서는 창을 닫으면 사라집니다.
- 저장 용량은 브라우저당 약 5MB입니다(텍스트 기준 수백 명 분량 예상, [확인 필요: 실제 사용량 측정]).
- 백업 파일(JSON)·CSV·출력물에는 민감정보가 포함됩니다. 기관 내부 접근제한 폴더에만 보관하고 이메일·메신저로 보내지 마세요.
- 복원은 현재 데이터를 **교체**합니다. 복원 직전 데이터는 자동으로 백업 파일로 내려받습니다.

## 테스트
```bash
node tests/e2e.cjs          # 로컬 모드 E2E (Playwright + Chromium 필요)
node tests/e2e-server.cjs   # 서버 모드 E2E (가짜 Supabase API로 로그인·동기화·충돌 처리 검증)
bash tests/db/run.sh        # Supabase 스키마·RLS 검증 (로컬 PostgreSQL 14+ 필요)
```

## 문서
CLAUDE.md · PROJECT_SPEC.md · FEATURES.md · DATA_MODEL.md · UI_UX.md · SECURITY.md · DEVELOPMENT_PLAN.md
