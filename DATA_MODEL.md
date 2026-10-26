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

## 3. 저장 정책
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

## 6. 서버 DB 전환 설계 (별도 설계 필요 — 초안)
- 어댑터 인터페이스 유지: `load(): db`, `save(db)` → 서버 버전은 엔터티 단위 API로 세분화 권장.
- 제안 API(초안): `GET/POST/PATCH /api/participants`, `/api/documents`, `/api/records`, `GET /api/history?participantId=`, `POST /api/backup`
- 제안 저장소: Vercel Postgres / Supabase 등 [확인 필요: 기관 정보보호 정책, 국내 리전 요구 여부]
- 필수 추가: 로그인(담당자 계정), 역할 권한, 전송·저장 암호화, 서버 측 감사로그, 동시 수정 충돌 처리(updatedAt 비교)
