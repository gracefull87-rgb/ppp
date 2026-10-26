/* 데이터 저장소
 * StorageAdapter 인터페이스: load() → db|null, save(db) → void
 * 현재 구현: LocalStorageAdapter (브라우저 로컬 저장, 기기별 분리 · 암호화/동기화/권한관리 없음)
 * 서버 DB 전환 시 같은 인터페이스의 ServerAdapter를 구현해 PPP.store.adapter 를 교체한다 (DATA_MODEL.md 참고).
 */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const SCHEMA_VERSION = 1;
  const DB_KEY = 'ppp.db.v1';
  const PREF_KEY = 'ppp.prefs';

  const LocalStorageAdapter = {
    name: '브라우저 로컬 저장 (localStorage)',
    load() {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : null;
    },
    save(db) {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    },
  };

  const emptyDb = () => ({
    schemaVersion: SCHEMA_VERSION,
    settings: { orgName: '노원구장애인가족지원센터', staff: ['담당자1', '담당자2', '담당자3'] },
    participants: [],
    documents: [],
    records: [],
    history: [],
  });

  const prefs = {
    get() {
      try { return Object.assign({ fontStep: 2, anonymous: true, currentUser: '' }, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); }
      catch (e) { return { fontStep: 2, anonymous: true, currentUser: '' }; }
    },
    set(patch) {
      const next = Object.assign(prefs.get(), patch);
      try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch (e) { /* 선호 설정 저장 실패는 무시 */ }
      return next;
    },
  };

  const store = {
    adapter: LocalStorageAdapter,
    db: null,
    available: true,

    init() {
      try {
        this.db = this.adapter.load() || emptyDb();
        this.db = migrate(this.db);
      } catch (e) {
        console.error(e);
        this.available = false;
        this.db = emptyDb();
      }
      return this.db;
    },

    persist() {
      try {
        this.adapter.save(this.db);
        return true;
      } catch (e) {
        console.error(e);
        PPP.toast('저장하지 못했습니다. 브라우저 저장 공간이 부족하거나 차단되어 있습니다. 백업 후 오래된 기록을 정리해 주세요.', 'error');
        return false;
      }
    },

    user() { return prefs.get().currentUser || '미지정'; },

    /* ---------- 이력 ---------- */
    addHistory(entry) {
      this.db.history.unshift(Object.assign({ id: PPP.uid('h'), at: new Date().toISOString(), by: this.user() }, entry));
      if (this.db.history.length > 5000) this.db.history.length = 5000;
    },
    historyFor(pid) { return this.db.history.filter((h) => h.participantId === pid); },

    /* ---------- 참여자 ---------- */
    participants() { return this.db.participants; },
    participant(id) { return this.db.participants.find((p) => p.id === id); },

    nextCode(year = new Date().getFullYear()) {
      const prefix = `PPP-${year}-`;
      const nums = this.db.participants.filter((p) => p.code.startsWith(prefix)).map((p) => Number(p.code.slice(prefix.length)) || 0);
      return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
    },

    saveParticipant(input) {
      const now = new Date().toISOString();
      const existing = input.id && this.participant(input.id);
      if (existing) {
        const changes = diff(existing, input, PARTICIPANT_LABELS);
        Object.assign(existing, input, { updatedAt: now, updatedBy: this.user() });
        if (changes.length) this.addHistory({ participantId: existing.id, entity: 'participant', action: '수정', summary: '참여자 정보 수정', changes });
        this.persist();
        return existing;
      }
      const p = Object.assign(newParticipant(), input, { id: PPP.uid('p'), code: input.code || this.nextCode(), createdAt: now, createdBy: this.user(), updatedAt: now, updatedBy: this.user() });
      this.db.participants.push(p);
      this.addHistory({ participantId: p.id, entity: 'participant', action: '등록', summary: `참여자 등록 (${p.code})` });
      this.persist();
      return p;
    },

    setStep(pid, stepKey, patch, note) {
      const p = this.participant(pid);
      if (!p) return;
      const before = Object.assign({}, p.steps[stepKey]);
      p.steps[stepKey] = Object.assign({ done: false, date: '' }, p.steps[stepKey], patch);
      p.updatedAt = new Date().toISOString();
      const step = PPP.STEPS.find((s) => s.key === stepKey);
      this.addHistory({ participantId: pid, entity: 'step', action: '단계', summary: `${step.label}: ${p.steps[stepKey].done ? '완료' : '미완료'}${p.steps[stepKey].date ? ' (' + p.steps[stepKey].date + ')' : ''}${note ? ' — ' + note : ''}`,
        changes: [{ field: step.label, before: before.done ? `완료 ${before.date || ''}` : '미완료', after: p.steps[stepKey].done ? `완료 ${p.steps[stepKey].date || ''}` : '미완료' }] });
      this.persist();
    },

    deleteParticipant(id) {
      const p = this.participant(id);
      if (!p) return;
      this.db.participants = this.db.participants.filter((x) => x.id !== id);
      this.db.documents = this.db.documents.filter((d) => d.participantId !== id);
      this.db.records = this.db.records.filter((r) => r.participantId !== id);
      // 삭제된 참여자의 이력은 내용(변경값)을 지우고 요약만 남긴다
      this.db.history.forEach((h) => { if (h.participantId === id) { h.changes = []; h.participantId = null; h.summary = `[삭제된 참여자 ${p.code}] ${h.summary}`; } });
      this.addHistory({ participantId: null, entity: 'participant', action: '삭제', summary: `참여자 삭제 (${p.code}) — 관련 서식·기록 함께 삭제` });
      this.persist();
    },

    /* ---------- 서식 문서 ---------- */
    documents(pid, formKey) {
      return this.db.documents.filter((d) => d.participantId === pid && (!formKey || d.formKey === formKey))
        .sort((a, b) => (b.data.year || 0) - (a.data.year || 0) || String(b.updatedAt).localeCompare(a.updatedAt));
    },
    document(id) { return this.db.documents.find((d) => d.id === id); },
    saveDocument(doc) {
      const now = new Date().toISOString();
      const form = PPP.FORMS[doc.formKey];
      const existing = doc.id && this.document(doc.id);
      if (existing) {
        const changes = diff(existing.data, doc.data, PPP.formLabels(form));
        existing.data = doc.data;
        existing.updatedAt = now;
        existing.updatedBy = this.user();
        if (changes.length) this.addHistory({ participantId: existing.participantId, entity: 'document', action: '수정', summary: `${form.title}${doc.data.year ? ' (' + doc.data.year + ')' : ''} 수정`, changes });
        this.persist();
        return existing;
      }
      const d = { id: PPP.uid('d'), participantId: doc.participantId, formKey: doc.formKey, data: doc.data, createdAt: now, createdBy: this.user(), updatedAt: now, updatedBy: this.user() };
      this.db.documents.push(d);
      this.addHistory({ participantId: d.participantId, entity: 'document', action: '작성', summary: `${form.title}${d.data.year ? ' (' + d.data.year + ')' : ''} 작성` });
      this.persist();
      return d;
    },
    deleteDocument(id) {
      const d = this.document(id);
      if (!d) return;
      this.db.documents = this.db.documents.filter((x) => x.id !== id);
      this.addHistory({ participantId: d.participantId, entity: 'document', action: '삭제', summary: `${PPP.FORMS[d.formKey].title}${d.data.year ? ' (' + d.data.year + ')' : ''} 삭제` });
      this.persist();
    },

    /* ---------- 상담·회의·활동 기록 ---------- */
    records(pid) {
      return this.db.records.filter((r) => !pid || r.participantId === pid).sort((a, b) => String(b.date).localeCompare(a.date));
    },
    record(id) { return this.db.records.find((r) => r.id === id); },
    saveRecord(rec) {
      const now = new Date().toISOString();
      const existing = rec.id && this.record(rec.id);
      let saved;
      if (existing) {
        const changes = diff(existing, rec, RECORD_LABELS);
        Object.assign(existing, rec, { updatedAt: now, updatedBy: this.user() });
        if (changes.length) this.addHistory({ participantId: existing.participantId, entity: 'record', action: '수정', summary: `${existing.type} 기록 수정 (${existing.date})`, changes });
        saved = existing;
      } else {
        saved = Object.assign({ id: PPP.uid('r'), createdAt: now, createdBy: this.user(), updatedAt: now, updatedBy: this.user() }, rec);
        this.db.records.push(saved);
        this.addHistory({ participantId: saved.participantId, entity: 'record', action: '작성', summary: `${saved.type} 기록 작성 (${saved.date})` });
      }
      // 기록 유형에 연결된 단계가 미완료면 완료 처리
      const type = PPP.RECORD_TYPES.find((t) => t.key === saved.type);
      const p = this.participant(saved.participantId);
      if (type && type.step && p && !(p.steps[type.step] || {}).done) {
        this.setStep(p.id, type.step, { done: true, date: saved.date }, `${saved.type} 기록에 따라 자동 완료`);
      } else {
        this.persist();
      }
      return saved;
    },
    deleteRecord(id) {
      const r = this.record(id);
      if (!r) return;
      this.db.records = this.db.records.filter((x) => x.id !== id);
      this.addHistory({ participantId: r.participantId, entity: 'record', action: '삭제', summary: `${r.type} 기록 삭제 (${r.date})` });
      this.persist();
    },

    /* ---------- 진행 상황 계산 ---------- */
    progress(p) {
      const required = PPP.STEPS.filter((s) => !s.optional);
      const done = required.filter((s) => (p.steps[s.key] || {}).done).length;
      const next = required.find((s) => !(p.steps[s.key] || {}).done) || null;
      let stage;
      if (p.status === 'closed') stage = '종결';
      else if (p.status === 'linked') stage = '자조활동 연계';
      else stage = next ? next.stage : '평가';
      const startDate = p.supportStart;
      const months = startDate ? Math.max(0, Math.floor(PPP.daysBetween(startDate, PPP.today()) / 30.4)) : null;
      return { done, total: required.length, pct: Math.round((done / required.length) * 100), next, stage, months };
    },
    lastRecordDate(pid) {
      const r = this.records(pid)[0];
      return r ? r.date : '';
    },

    /* ---------- 백업·복원 ---------- */
    buildBackup() {
      const data = JSON.parse(JSON.stringify(this.db));
      const body = JSON.stringify(data);
      return {
        app: 'ppp-lifelong-planning',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        exportedBy: this.user(),
        counts: { participants: data.participants.length, documents: data.documents.length, records: data.records.length, history: data.history.length },
        checksum: PPP.hash(body),
        data,
      };
    },
    validateBackup(obj) {
      const errors = [];
      if (!obj || typeof obj !== 'object') return ['JSON 형식이 아닙니다.'];
      if (obj.app !== 'ppp-lifelong-planning') errors.push('이 앱에서 만든 백업 파일이 아닙니다.');
      if (typeof obj.schemaVersion !== 'number') errors.push('스키마 버전 정보가 없습니다.');
      else if (obj.schemaVersion > SCHEMA_VERSION) errors.push(`더 최신 버전(v${obj.schemaVersion})의 백업입니다. 앱을 업데이트한 뒤 복원하세요.`);
      const d = obj.data;
      if (!d || !Array.isArray(d.participants) || !Array.isArray(d.documents) || !Array.isArray(d.records) || !Array.isArray(d.history)) errors.push('필수 데이터(participants, documents, records, history)가 없습니다.');
      else {
        if (obj.checksum && PPP.hash(JSON.stringify(d)) !== obj.checksum) errors.push('파일 내용이 손상되었거나 수정되었습니다 (검증값 불일치).');
        const ids = new Set(d.participants.map((p) => p.id));
        if (d.participants.some((p) => !p.id || !p.code)) errors.push('참여자 데이터에 ID 또는 참여자 코드가 없는 항목이 있습니다.');
        if (d.documents.some((x) => !ids.has(x.participantId))) errors.push('참여자와 연결되지 않은 서식 문서가 있습니다.');
        if (d.records.some((x) => !ids.has(x.participantId))) errors.push('참여자와 연결되지 않은 기록이 있습니다.');
      }
      return errors;
    },
    restore(obj) {
      this.db = migrate(JSON.parse(JSON.stringify(obj.data)));
      this.addHistory({ participantId: null, entity: 'system', action: '복원', summary: `백업 복원 (${PPP.fmtDateTime(obj.exportedAt)} 생성본, 참여자 ${obj.counts ? obj.counts.participants : this.db.participants.length}명)` });
      return this.persist();
    },
    resetAll() {
      this.db = emptyDb();
      this.persist();
    },

    /* ---------- 가상 샘플 데이터 ---------- */
    seedSample() {
      const sample = PPP.buildSampleData();
      sample.participants.forEach((p) => this.db.participants.push(p));
      sample.documents.forEach((d) => this.db.documents.push(d));
      sample.records.forEach((r) => this.db.records.push(r));
      this.addHistory({ participantId: null, entity: 'system', action: '샘플', summary: `가상 샘플 데이터 ${sample.participants.length}명 추가` });
      this.persist();
    },
  };

  function newParticipant() {
    const steps = {};
    PPP.STEPS.forEach((s) => (steps[s.key] = { done: false, date: '' }));
    return {
      code: '', alias: '', name: '', gender: '', birthYear: '', disabilityType: '', disabilitySeverity: '',
      manager: '', guardianRelation: '', consent: { guardian: false, date: '', method: '', note: '' },
      selfHelpGroup: '없음', supportStart: '', status: 'active', closing: null, memo: '', steps,
    };
  }
  PPP.newParticipant = newParticipant;

  function migrate(db) {
    // schemaVersion 1 이 최초 버전. 이후 버전 추가 시 여기에서 단계적으로 변환한다.
    const base = emptyDb();
    db = Object.assign(base, db);
    db.settings = Object.assign(emptyDb().settings, db.settings || {});
    db.participants.forEach((p) => {
      p.steps = p.steps || {};
      PPP.STEPS.forEach((s) => { if (!p.steps[s.key]) p.steps[s.key] = { done: false, date: '' }; });
      p.consent = p.consent || { guardian: false, date: '', method: '', note: '' };
    });
    db.schemaVersion = SCHEMA_VERSION;
    return db;
  }

  const PARTICIPANT_LABELS = {
    alias: '가명(별칭)', name: '실명', gender: '성별', birthYear: '출생연도', disabilityType: '장애유형', disabilitySeverity: '장애정도',
    manager: '담당자', guardianRelation: '보호자 관계', consent: '보호자 동의', selfHelpGroup: '자조활동', supportStart: '지원 시작일',
    status: '상태', closing: '종결 정보', memo: '메모',
  };
  const RECORD_LABELS = { date: '일자', type: '유형', area: '영역', attendees: '참석자', content: '주요 내용', result: '결정·평가', nextPlan: '다음 계획', achievement: '달성도' };
  const SENSITIVE_KEYS = new Set(['name']);

  // 변경 항목 계산 (값은 120자로 축약, 민감 항목은 값 대신 '변경됨'으로 기록)
  function diff(before, after, labels) {
    const out = [];
    const keys = new Set([...Object.keys(labels)]);
    keys.forEach((k) => {
      if (!(k in after)) return;
      const a = JSON.stringify(before[k] == null ? '' : before[k]);
      const b = JSON.stringify(after[k] == null ? '' : after[k]);
      if (a === b) return;
      const sensitive = SENSITIVE_KEYS.has(k) || labels[k + '__sensitive'];
      out.push({ field: labels[k], before: sensitive ? '(가림)' : short(before[k]), after: sensitive ? '(변경됨)' : short(after[k]) });
    });
    return out;
  }
  function short(v) {
    if (v == null || v === '') return '';
    let s = typeof v === 'object' ? summarize(v) : String(v);
    return s.length > 120 ? s.slice(0, 120) + '…' : s;
  }
  function summarize(v) {
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? Object.values(x || {}).filter(Boolean).join('/') : x)).filter(Boolean).join(', ');
    return Object.entries(v).map(([k, x]) => (x === true ? k : x && typeof x !== 'object' ? `${k}:${x}` : '')).filter(Boolean).join(', ');
  }

  // 서식 필드 라벨 맵 (이력용). 민감 필드는 값 대신 '변경됨'만 기록.
  PPP.formLabels = (form) => {
    const m = {};
    form.fields.forEach((f) => {
      if (!f.k) return;
      m[f.k] = f.label;
      if (f.sensitive) m[f.k + '__sensitive'] = true;
      if (f.other) m[f.k + '_other'] = `${f.label} (기타)`;
    });
    return m;
  };

  PPP.store = store;
  PPP.prefs = prefs;
  PPP.SCHEMA_VERSION = SCHEMA_VERSION;
})();
