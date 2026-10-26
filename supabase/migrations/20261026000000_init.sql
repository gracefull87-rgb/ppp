-- =====================================================================
-- 평생과정설계 기록관리 — Supabase 스키마 및 RLS(행 수준 보안)
-- 적용: Supabase 대시보드 > SQL Editor 에 전체를 붙여 넣고 실행
--       (또는 supabase CLI: supabase db push)
--
-- 보안 원칙
--   1. 모든 테이블 RLS 활성화. 정책이 없는 동작은 전부 거부된다.
--      (FORCE RLS 는 쓰지 않는다: 테이블 소유자(postgres)는 관리자 권한이라 실익이 없고,
--       SECURITY DEFINER 보조 함수가 profiles 정책을 재귀 호출하게 만들 수 있다)
--   2. anon(비로그인) 역할은 어떤 테이블에도 권한이 없다.
--   3. 로그인했더라도 관리자가 활성화(profiles.active = true)한 직원만 접근한다.
--   4. 이용자(participants) 삭제는 관리자만, 수정 이력(history)은 추가만 가능(수정·삭제 불가).
--   5. 작성자·시각(created_by/updated_by/at)은 서버가 기록한다(클라이언트 값 무시).
--   6. 종결은 '종결 검토 대기'를 거쳐 요청자가 아닌 다른 직원이 승인해야 한다(트리거로 강제).
--   7. 모든 이용자·서식·기록 변경은 감사로그(audit_log)에 자동 저장되며 관리자만 열람한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 내부 함수용 스키마 (API로 노출되지 않음)
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- 1. 직원 계정 프로필
--    Supabase Auth 사용자 1명 = profiles 1행. 새 계정은 비활성(active=false)으로 생성되며
--    관리자가 활성화해야 데이터에 접근할 수 있다.
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 30),
  role          text not null default 'staff' check (role in ('staff', 'admin')),
  active        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is '직원 계정. active=true 인 계정만 데이터 접근 가능. role=admin 은 이용자 삭제·설정·감사로그 열람 가능';

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active);
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin');
$$;

revoke all on function private.is_staff(), private.is_admin() from public, anon;
grant execute on function private.is_staff(), private.is_admin() to authenticated;

-- Auth 사용자 생성 시 비활성 프로필 자동 생성
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), '직원'), 30))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. 기관 설정 (1행)
-- ---------------------------------------------------------------------
create table public.settings (
  id          smallint primary key default 1 check (id = 1),
  org_name    text not null default '노원구장애인가족지원센터' check (char_length(org_name) between 1 and 50),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. 업무 데이터
--    앱의 객체 전체를 data(jsonb)에 저장하고, 검색·무결성에 필요한 값만 컬럼으로 둔다.
--    컬럼과 data 안의 값은 CHECK 제약으로 일치를 강제한다.
-- ---------------------------------------------------------------------
create table public.participants (
  id                    text primary key check (id ~ '^p_[a-z0-9]{6,40}$'),
  code                  text not null unique check (code ~ '^[A-Z0-9-]{3,30}$'),
  data                  jsonb not null check (jsonb_typeof(data) = 'object'),
  status                text generated always as (data ->> 'status') stored,
  closing_requested_by  uuid references public.profiles (id),
  created_at            timestamptz not null default now(),
  created_by            uuid not null default auth.uid() references public.profiles (id),
  updated_at            timestamptz not null default now(),
  updated_by            uuid not null default auth.uid() references public.profiles (id),
  constraint participants_data_match check (data ->> 'id' = id and data ->> 'code' = code),
  constraint participants_status_valid check (data ->> 'status' in ('active', 'closing', 'closed', 'linked')),
  constraint participants_data_size check (pg_column_size(data) < 200000)
);
comment on table public.participants is '이용자(참여자). 실명 등 민감정보는 data 안에 선택 입력';

create table public.documents (
  id              text primary key check (id ~ '^d_[a-z0-9]{6,40}$'),
  participant_id  text not null references public.participants (id) on delete cascade,
  form_key        text not null check (form_key in ('selfIntro', 'actionPlan', 'yearStory')),
  year            int generated always as (
                    case when (data -> 'data' ->> 'year') ~ '^\d{4}$' then (data -> 'data' ->> 'year')::int end
                  ) stored,
  data            jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at      timestamptz not null default now(),
  created_by      uuid not null default auth.uid() references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null default auth.uid() references public.profiles (id),
  constraint documents_data_match check (data ->> 'id' = id and data ->> 'participantId' = participant_id and data ->> 'formKey' = form_key),
  constraint documents_data_size check (pg_column_size(data) < 500000),
  -- 연도별 서식(실천계획서·행복한 미래 이야기)은 이용자·연도당 1건 (year 가 없는 자기소개서는 제외)
  constraint documents_one_per_year unique (participant_id, form_key, year)
);
create index documents_participant_idx on public.documents (participant_id);

create table public.records (
  id              text primary key check (id ~ '^r_[a-z0-9]{6,40}$'),
  participant_id  text not null references public.participants (id) on delete cascade,
  record_date     date not null,
  type            text not null,
  data            jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at      timestamptz not null default now(),
  created_by      uuid not null default auth.uid() references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null default auth.uid() references public.profiles (id),
  constraint records_data_match check (data ->> 'id' = id and data ->> 'participantId' = participant_id and data ->> 'date' = record_date::text and data ->> 'type' = type),
  constraint records_data_size check (pg_column_size(data) < 100000)
);
create index records_participant_idx on public.records (participant_id);
create index records_date_idx on public.records (record_date desc);

-- 앱 화면에 보이는 수정 이력 (추가만 가능)
create table public.history (
  id              text primary key check (id ~ '^h_[a-z0-9]{6,40}$'),
  participant_id  text,   -- 삭제된 이용자의 이력도 남기기 위해 외래키를 두지 않음
  at              timestamptz not null default now(),
  actor           uuid not null default auth.uid() references public.profiles (id),
  data            jsonb not null check (jsonb_typeof(data) = 'object'),
  constraint history_data_size check (pg_column_size(data) < 50000)
);
create index history_participant_idx on public.history (participant_id);
create index history_at_idx on public.history (at desc);

-- 서버 감사로그 (트리거만 기록, 관리자만 열람, 수정·삭제 불가)
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor       uuid default auth.uid(),
  at          timestamptz not null default now(),
  old_data    jsonb,
  new_data    jsonb
);
create index audit_log_row_idx on public.audit_log (table_name, row_id);
create index audit_log_at_idx on public.audit_log (at desc);
comment on table public.audit_log is '서버 감사로그. 삭제된 서식·기록의 복구 근거. 보존기간은 기관 규정 확인 필요';

-- ---------------------------------------------------------------------
-- 4. 트리거
-- ---------------------------------------------------------------------
-- 작성자·시각을 서버 값으로 강제
create or replace function private.stamp_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    if new.id is distinct from old.id then
      raise exception 'ID는 변경할 수 없습니다.' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- 종결 2인 검토 강제
create or replace function private.guard_participant_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_status text := case when tg_op = 'UPDATE' then old.data ->> 'status' end;
  new_status text := new.data ->> 'status';
begin
  if tg_op = 'INSERT' then
    -- 종결 관련 상태로 바로 등록하는 것은 관리자 이관(백업 가져오기)만 허용
    if new_status in ('closing', 'closed') and not private.is_admin() then
      raise exception '종결 상태로 이용자를 등록할 수 없습니다.' using errcode = '42501';
    end if;
    -- 클라이언트가 보낸 값은 무시하고 서버가 기록
    new.closing_requested_by := case when new_status = 'closing' then auth.uid() end;
    return new;
  end if;

  if new_status = 'closing' and old_status is distinct from 'closing' then
    new.closing_requested_by := auth.uid();
  elsif new_status = 'closed' and old_status is distinct from 'closed' then
    if old_status is distinct from 'closing' then
      raise exception '종결은 종결 검토 요청 후에만 승인할 수 있습니다.' using errcode = '42501';
    end if;
    if old.closing_requested_by is not distinct from auth.uid() then
      raise exception '종결 요청자와 다른 담당자가 승인해야 합니다.' using errcode = '42501';
    end if;
    new.closing_requested_by := old.closing_requested_by;
  elsif new_status = 'closing' then
    new.closing_requested_by := old.closing_requested_by;
  elsif new_status = 'closed' then
    new.closing_requested_by := old.closing_requested_by;
  else
    new.closing_requested_by := null;
  end if;
  return new;
end;
$$;

-- 이력: 작성자·시각 서버 강제
create or replace function private.stamp_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.actor := auth.uid();
  new.at := now();
  return new;
end;
$$;

-- 감사로그 기록
create or replace function private.write_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (table_name, row_id, action, actor, old_data, new_data)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;  -- AFTER 트리거: 반환값 무시
end;
$$;

create or replace function private.stamp_simple()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_table_name = 'settings' then new.updated_by := auth.uid(); end if;
  return new;
end;
$$;

revoke all on function private.stamp_row(), private.guard_participant_status(), private.stamp_history(), private.write_audit(), private.stamp_simple() from public, anon, authenticated;

create trigger participants_stamp before insert or update on public.participants for each row execute function private.stamp_row();
create trigger participants_status before insert or update on public.participants for each row execute function private.guard_participant_status();
create trigger documents_stamp before insert or update on public.documents for each row execute function private.stamp_row();
create trigger records_stamp before insert or update on public.records for each row execute function private.stamp_row();
create trigger history_stamp before insert on public.history for each row execute function private.stamp_history();
create trigger settings_stamp before update on public.settings for each row execute function private.stamp_simple();
create trigger profiles_stamp before update on public.profiles for each row execute function private.stamp_simple();

create trigger participants_audit after insert or update or delete on public.participants for each row execute function private.write_audit();
create trigger documents_audit after insert or update or delete on public.documents for each row execute function private.write_audit();
create trigger records_audit after insert or update or delete on public.records for each row execute function private.write_audit();
create trigger profiles_audit_upd after update on public.profiles for each row execute function private.write_audit();

-- ---------------------------------------------------------------------
-- 5. 권한(GRANT) — 기본 권한을 모두 회수한 뒤 필요한 것만 부여
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.settings, public.participants, public.documents, public.records, public.history, public.audit_log from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, role, active) on public.profiles to authenticated;
grant select on public.settings to authenticated;
grant update (org_name) on public.settings to authenticated;
grant select, insert, delete on public.participants to authenticated;
grant update (data) on public.participants to authenticated;
grant select, insert, delete on public.documents to authenticated;
grant update (data, form_key) on public.documents to authenticated;
grant select, insert, delete on public.records to authenticated;
grant update (data, record_date, type) on public.records to authenticated;
grant select, insert on public.history to authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------
-- 6. RLS 활성화 및 정책
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.participants enable row level security;
alter table public.documents    enable row level security;
alter table public.records      enable row level security;
alter table public.history      enable row level security;
alter table public.audit_log    enable row level security;


-- profiles: 본인 행 또는 활성 직원은 열람, 수정은 관리자만
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- settings: 직원 열람, 관리자 수정
create policy settings_select on public.settings for select to authenticated
  using ((select private.is_staff()));
create policy settings_update_admin on public.settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- participants: 직원 열람·등록·수정, 삭제는 관리자만
-- [확인 필요] 현재는 팀 운영(종결 교차 검토)을 위해 모든 직원이 모든 이용자를 열람한다.
create policy participants_select on public.participants for select to authenticated
  using ((select private.is_staff()));
create policy participants_insert on public.participants for insert to authenticated
  with check ((select private.is_staff()));
create policy participants_update on public.participants for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy participants_delete_admin on public.participants for delete to authenticated
  using ((select private.is_admin()));

-- documents: 직원 열람·작성·수정·삭제 (삭제 내용은 감사로그에 보존)
create policy documents_select on public.documents for select to authenticated
  using ((select private.is_staff()));
create policy documents_insert on public.documents for insert to authenticated
  with check ((select private.is_staff()));
create policy documents_update on public.documents for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy documents_delete on public.documents for delete to authenticated
  using ((select private.is_staff()));

-- records: documents 와 동일
create policy records_select on public.records for select to authenticated
  using ((select private.is_staff()));
create policy records_insert on public.records for insert to authenticated
  with check ((select private.is_staff()));
create policy records_update on public.records for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy records_delete on public.records for delete to authenticated
  using ((select private.is_staff()));

-- history: 직원 열람·추가만 (UPDATE/DELETE 정책 없음 = 불가), 작성자는 본인으로 강제
create policy history_select on public.history for select to authenticated
  using ((select private.is_staff()));
create policy history_insert on public.history for insert to authenticated
  with check ((select private.is_staff()) and actor = (select auth.uid()));

-- audit_log: 관리자 열람만 (INSERT 는 트리거가 정의자 권한으로 수행)
create policy audit_log_select_admin on public.audit_log for select to authenticated
  using ((select private.is_admin()));
