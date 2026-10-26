# DATA_MODEL.md — 데이터 구조

스키마 버전: **2** (`PPP.SCHEMA_VERSION`, `js/store.js`)

## 1. 전체 구조
```
db
├─ schemaVersion : number
├─ settings      : Settings
├─ participants  : Participant[]
├─ documents     : Document[]      (participantId → Participant)
├─ records       : Record[]        (participantId → Participant)
└─ history       : History[]       (participantId → Participant | null)
```
관계: Participant 1 — N Document, Participant 1 — N Record, Participant 1 — N History.

## 2. 엔터티

### Settings
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| orgName | string | Y | 기관명 (기본: 노원구장애인가족지원센터) |
| staff | string[] | Y | 담당자 이름 목록(1명 이상, 중복 불가) |

### Participant (참여자)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | string | Y | `p_` + 랜덤 |
| code | string | Y | 참여자 코드 `PPP-YYYY-NNN`, 고유 |
| alias | string | Y | 가명(별칭) — 화면 식별용 |
| name | string | N | 실명 **(민감)** |
| gender | '남' \| '여' \| '' | N | |
| birthYear | string(YYYY) | N | 연령대 통계용 |
| disabilityType | string | N | `PPP.DISABILITY_TYPES` |
| disabilitySeverity | '심한 장애' \| '심하지 않은 장애' \| '' | N | |
| guardianRelation | string | N | 주 보호자 관계 |
| manager | string | Y | 담당자(settings.staff) |
| supportStart | date(YYYY-MM-DD) | Y | 지원 시작일 (3년 경과 계산) |
| services | string[] | Y | 미래설계서비스이용현황, `PPP.SERVICE_TYPES` 중 복수 선택 (빈 배열 = 이용 없음) |
| consent | {guardian: bool, date, method, note} | Y | 보호자 동의 확인 |
| status | 'active' \| 'closing' \| 'closed' \| 'linked' | Y | 진행 중/종결 검토 대기/종결/자조활동 연계 |
| closing | {reason, guardianConfirmed, requestedBy, requestedAt, reviewedBy?, reviewedAt?} \| null | N | 종결 정보 |
| steps | {[stepKey]: {done: bool, date}} | Y | 13개 단계 (`PPP.STEPS`) |
| memo | string | N | |
| createdAt/updatedAt | ISO datetime | Y | |
| createdBy/updatedBy | string | Y | 현재 사용자 |

stepKey: `academy, prepCounsel, familyProgram(선택), counsel, preMeeting, integratedMeeting, conferenceMeeting, confirmMeeting, shortPlan, detailPlan, activity, activityEval, annualEval`

**파생 값(저장 안 함)** — `store.progress(p)`: done/total(필수 12), pct, next(다음 단계), stage, months(지원 경과 개월).

### Document (서식)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | string | Y | `d_` + 랜덤 |
| participantId | string | Y | FK |
| formKey | 'selfIntro' \| 'actionPlan' \| 'yearStory' | Y | |
| data | object | Y | 서식 스키마(`js/schema.js`)의 필드 키 → 값 |
| createdAt/updatedAt/createdBy/updatedBy | | Y | |

`data` 값 형식(필드 타입별):
| 타입 | 저장 형식 | 예 |
|---|---|---|
| text/textarea/date/select/number | string | `"2026-03-02"` |
| radio | string (+ `{k}_other`) | `"가끔"` |
| checks | string[] (+ `{k}_other`) | `["안경","기타"]` |
| table | object[] (빈 행 제외) | `[{relation:"어머니", ...}]` |
| grid | object[] (rowLabels 순서) | `[{routine:"", rule:""}, ...]` |
| matrix | {"그룹_항목": 척도index(0~4)} | `{"0_0": 4}` |
| compare | {rowKey: {now, future, now_detail, future_detail, reason}} | |
| amounts | {"구간_그룹_항목": {amount, note?, ratio?}} | |

제약: actionPlan·yearStory는 `(participantId, formKey, data.year)` 고유.

### Record (상담·회의·활동 기록)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | string | Y | `r_` + 랜덤 |
| participantId | string | Y | FK |
| date | date | Y | 오늘 이전 |
| type | string | Y | `PPP.RECORD_TYPES` (13종) |
| area | string | N | `PPP.DOMAINS` |
| achievement | '1'~'5' | N | 활동평가 달성도 |
| attendees | string | N | 역할 위주 |
| content | string | Y | 주요 내용 |
| result / nextPlan | string | N | |
| createdAt/updatedAt/createdBy/updatedBy | | Y | |

### History (수정 이력)
| 필드 | 타입 | 설명 |
|---|---|---|
| id, at, by | | 자동 |
| participantId | string \| null | 시스템 작업·삭제된 참여자는 null |
| entity | 'participant'\|'document'\|'record'\|'step'\|'system' | |
| action | 등록/수정/삭제/작성/단계/상태/복원/샘플/설정/내보내기 | |
| summary | string | |
| changes | {field, before, after}[] | 값은 120자 축약, 민감 필드는 “(가림)/(변경됨)” |
최대 5,000건 보관(초과 시 오래된 것부터 제거) [확인 필요: 기관 보존 요구].

## 3. 저장 정책 (로컬 모드)
- 저장 키: `localStorage['ppp.db.v1']` (전체 DB JSON), `localStorage['ppp.prefs']` (글자 크기·익명 모드·현재 사용자 — 기기별 편의 설정)
- 모든 변경은 즉시 전체 저장. 실패(용량 초과·차단) 시 오류 토스트.
- 한계: 기기·브라우저별 분리, 자동 동기화 없음, 암호화 없음, 다중 사용자 권한 없음, 약 5MB.

## 4. 삭제 정책
| 대상 | 방식 |
|---|---|
| 서식·기록 | 확인창 후 즉시 삭제(복구는 백업으로만), 이력에 요약 기록 |
| 참여자 | 관련 서식·기록 함께 삭제, 해당 참여자 이력의 변경값 제거 후 요약만 유지 (UI 미노출, [확인 필요]) |
| 종결 참여자 파기 | [확인 필요] 보존기간 경과 후 파기 절차 미구현 |

## 5. 백업·복원 형식
```json
{
  "app": "ppp-lifelong-planning",
  "schemaVersion": 1,
  "exportedAt": "ISO",
  "exportedBy": "담당자1",
  "counts": {"participants": 0, "documents": 0, "records": 0, "history": 0},
  "checksum": "data의 JSON 문자열 해시(무결성 확인용, 보안용 아님)",
  "data": { "...db 전체..." }
}
```
복원: 검증 → 미리보기 → 현재 데이터 자동 백업 → `migrate()` 후 교체. 스키마 변경 시 `SCHEMA_VERSION`을 올리고 `migrate()`에 단계별 변환을 추가한다(이전 버전 백업도 복원 가능해야 함).

| 버전 | 변경 | 변환 규칙 (`migrate()`) |
|---|---|---|
| 1 | 최초 | — |
| 2 | `selfHelpGroup`(문자열) → `services`(문자열 배열, 미래설계서비스이용현황) | 기존 값에 ‘자조’가 포함되면 `['평생과정설계 자조모임']`, 그 외(‘없음’ 등)는 `[]`. `selfHelpGroup` 필드 삭제. 아카데미 이용 여부는 v1에 없던 정보이므로 담당자가 직접 입력해야 함 |

## 6. Supabase 서버 DB (서버 모드)
스키마: `supabase/migrations/20261026000000_init.sql` · 검증: `bash tests/db/run.sh`

`js/config.js`에 Supabase URL·anon 키가 있으면 서버 모드로 동작한다(`PPP.supa.ServerAdapter`). 앱 객체는 그대로 `data`(jsonb)에 저장하고, 무결성·권한에 필요한 값만 컬럼으로 둔다.

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| profiles | id(=auth.users.id), display_name, role(staff/admin), active | Auth 사용자 생성 시 **비활성**으로 자동 생성 |
| settings | id=1, org_name | 1행 고정 |
| participants | id, code(고유), data, status(생성 컬럼), closing_requested_by, created/updated_at·by | `code = data.code`, `id = data.id` CHECK |
| documents | id, participant_id(FK, cascade), form_key, year(생성 컬럼), data | (participant_id, form_key, year) 고유 → 연도별 서식 중복 방지 |
| records | id, participant_id(FK, cascade), record_date, type, data | 컬럼과 data 일치 CHECK |
| history | id, participant_id(FK 없음), at, actor, data | 추가만 가능, at·actor 서버 강제 |
| audit_log | table_name, row_id, action, actor, at, old_data, new_data | 트리거 자동 기록, 관리자만 열람 |

### 동기화 방식
- 로그인 시 전체를 불러와(이력은 최근 5,000건) 메모리에서 사용하고, 저장할 때마다 마지막 서버 상태와 비교해 **바뀐 행만** 전송한다.
- 수정은 `updated_at` 일치 조건으로 보낸다. 그 사이 다른 담당자가 같은 행을 수정했다면 0행이 갱신되어 **저장 실패(충돌)** 로 안내하고 덮어쓰지 않는다 → [다시 불러오기] 후 재입력.
- 작성자·시각(`created_by/updated_by/at/actor`)은 서버 트리거가 기록하며, 화면의 작성자 이름도 서버 값으로 표시한다.
- 다른 담당자의 변경은 [다시 불러오기] 또는 재로그인 시 반영된다(실시간 구독 없음).

### 서버 모드 삭제·복원
- 이용자 삭제: 관리자만(RLS). 서식·기록 삭제: 직원 가능, 삭제 전 내용은 audit_log 에 보존.
- 백업 가져오기(관리자): 서버 데이터를 파일 내용으로 교체(파일에 없는 이용자 삭제). 기존 이력은 삭제되지 않으며, 가져온 이력의 시각·작성자는 가져온 시점·관리자로 기록된다(원래 값은 data 안에 보존).
- 전체 초기화·가상 샘플 데이터: 서버 모드에서는 사용할 수 없다.
