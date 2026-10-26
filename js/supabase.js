/* Supabase 연결 (서버 모드)
 * 외부 라이브러리 없이 Supabase Auth(GoTrue)·REST(PostgREST) API 를 fetch 로 호출한다.
 * - 로그인 세션은 sessionStorage 에 보관 → 브라우저(탭)를 닫으면 로그아웃
 * - ServerAdapter: 메모리의 db 와 마지막 서버 상태(스냅샷)를 비교해 바뀐 행만 전송
 * - 수정은 updated_at 일치 조건으로 보내 다른 담당자의 변경을 덮어쓰지 않는다(낙관적 동시성 제어)
 * 데이터 접근 권한은 서버의 RLS 정책(supabase/migrations)이 최종 결정한다.
 */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const cfg = PPP.CONFIG || {};
  const BASE = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const KEY = cfg.supabaseAnonKey || '';
  const SESSION_KEY = 'ppp.session';
  const PAGE = 1000;

  PPP.serverMode = !!(BASE && KEY);

  class ApiError extends Error {
    constructor(message, { status = 0, code = '', permanent = false } = {}) {
      super(message);
      this.status = status;
      this.code = code;
      this.permanent = permanent;
    }
  }

  // 서버 오류 → 사용자 안내 문구
  function describe(status, body) {
    const code = (body && (body.code || body.error_code || body.error)) || '';
    const msg = (body && (body.message || body.msg || body.error_description)) || '';
    if (status === 400 && /invalid_grant|invalid_credentials/.test(code + msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (/email_not_confirmed/.test(code)) return '이메일 인증이 완료되지 않은 계정입니다. 관리자에게 문의하세요.';
    if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도하세요.';
    if (code === '23505') return /documents_one_per_year/.test(msg) ? '같은 연도의 서식이 이미 서버에 있습니다. 새로고침 후 기존 문서를 수정하세요.' : '이미 사용 중인 값입니다(참여자 코드 등). 새로고침 후 확인하세요.';
    if (code === '23503') return '연결된 이용자가 서버에 없습니다. 새로고침 후 다시 시도하세요.';
    if (code === '23514') return '저장 형식이 올바르지 않아 서버가 거부했습니다.';
    if (code === '42501' || status === 403) return /[가-힣]/.test(msg) ? msg : '권한이 없습니다. 계정 활성화·권한을 관리자에게 확인하세요.';
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인하세요.';
    if (status >= 500) return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도하세요.';
    return msg || `서버 오류 (${status})`;
  }

  /* ---------------- 인증 ---------------- */
  const auth = {
    session: null, // {access_token, refresh_token, expires_at, user:{id,email}}
    profile: null, // {id, display_name, role, active}

    restore() {
      try { this.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { this.session = null; }
      return this.session;
    },
    store(s) {
      this.session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id, email: s.user.email } } : null;
      try { if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* 저장 불가 시 메모리 세션만 사용 */ }
    },
    async token(grant, body) {
      let res;
      try {
        res = await fetch(`${BASE}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } catch (e) { throw new ApiError('서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(describe(res.status, data), { status: res.status, code: data.error_code || data.error || '', permanent: true });
      this.store(data);
      return this.session;
    },
    signIn(email, password) { return this.token('password', { email, password }); },
    async refresh() {
      if (!this.session) throw new ApiError('로그인이 필요합니다.', { status: 401 });
      if (!this._refreshing) this._refreshing = this.token('refresh_token', { refresh_token: this.session.refresh_token }).finally(() => { this._refreshing = null; });
      return this._refreshing;
    },
    async ensureFresh() {
      if (this.session && this.session.expires_at - 60 < Date.now() / 1000) await this.refresh();
    },
    async signOut() {
      const s = this.session;
      this.store(null);
      this.profile = null;
      if (s) { try { await fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}` } }); } catch (e) { /* 서버 로그아웃 실패해도 로컬 세션은 삭제됨 */ } }
    },
  };

  /* ---------------- REST 호출 ---------------- */
  async function api(method, path, { body, prefer, range, retried } = {}) {
    await auth.ensureFresh();
    const headers = { apikey: KEY, Authorization: `Bearer ${auth.session ? auth.session.access_token : KEY}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    if (range) { headers['Range-Unit'] = 'items'; headers.Range = range; }
    let res;
    try {
      res = await fetch(`${BASE}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError('서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요. 변경 내용은 연결되면 다시 전송됩니다.');
    }
    if (res.status === 401 && !retried && auth.session) {
      try { await auth.refresh(); } catch (e) { throw new ApiError('로그인이 만료되었습니다. 다시 로그인하세요.', { status: 401 }); }
      return api(method, path, { body, prefer, range, retried: true });
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: '' }; }
    if (!res.ok) {
      const permanent = res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status);
      throw new ApiError(describe(res.status, data), { status: res.status, code: (data && data.code) || '', permanent });
    }
    return data;
  }

  async function fetchAll(table, query, max = Infinity) {
    const out = [];
    for (let from = 0; from < max; from += PAGE) {
      const to = Math.min(from + PAGE, max) - 1;
      const rows = await api('GET', `${table}?${query}`, { range: `${from}-${to}` });
      out.push(...rows);
      if (rows.length < to - from + 1) break;
    }
    return out;
  }

  const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
  const enc = encodeURIComponent;

  /* ---------------- 행 변환 ---------------- */
  const TABLES = {
    participants: { toRow: (p) => ({ id: p.id, code: p.code, data: p }), patch: (p) => ({ data: p }) },
    documents: { toRow: (d) => ({ id: d.id, participant_id: d.participantId, form_key: d.formKey, data: d }), patch: (d) => ({ data: d, form_key: d.formKey }) },
    records: { toRow: (r) => ({ id: r.id, participant_id: r.participantId, record_date: r.date, type: r.type, data: r }), patch: (r) => ({ data: r, record_date: r.date, type: r.type }) },
  };

  /* ---------------- ServerAdapter ---------------- */
  const ServerAdapter = {
    name: 'Supabase 서버 DB',
    snap: null, // {participants: Map(id→{json, ts}), documents, records, history:Set, orgName}
    failed: new Map(), // `${table}:${id}` → 오류 메시지 (재시도하지 않을 영구 오류)
    queue: Promise.resolve(),
    pending: 0,

    load() { return null; }, // 서버 모드는 loadAll() 로 비동기 적재

    async loadProfile() {
      const rows = await api('GET', `profiles?select=id,display_name,role,active&id=eq.${enc(auth.session.user.id)}`);
      auth.profile = rows[0] || null;
      return auth.profile;
    },

    async loadAll() {
      const [profiles, settings, participants, documents, records, history] = await Promise.all([
        fetchAll('profiles', 'select=id,display_name,role,active&order=display_name'),
        api('GET', 'settings?select=org_name&id=eq.1'),
        fetchAll('participants', 'select=data,created_at,created_by,updated_at,updated_by&order=code'),
        fetchAll('documents', 'select=data,created_at,created_by,updated_at,updated_by&order=updated_at.desc'),
        fetchAll('records', 'select=data,created_at,created_by,updated_at,updated_by&order=record_date.desc'),
        fetchAll('history', 'select=id,participant_id,at,actor,data&order=at.desc', 5000),
      ]);
      const names = new Map(profiles.map((p) => [p.id, p.display_name]));
      const stamp = (r) => Object.assign(r.data, {
        createdAt: r.created_at, updatedAt: r.updated_at,
        createdBy: names.get(r.created_by) || r.data.createdBy, updatedBy: names.get(r.updated_by) || r.data.updatedBy,
      });
      this.serverTs = new Map();
      [['participants', participants], ['documents', documents], ['records', records]].forEach(([t, rows]) => rows.forEach((r) => this.serverTs.set(`${t}:${r.data.id}`, r.updated_at)));
      return {
        settings: { orgName: (settings[0] && settings[0].org_name) || '노원구장애인가족지원센터', staff: profiles.filter((p) => p.active).map((p) => p.display_name) },
        participants: participants.map(stamp),
        documents: documents.map(stamp),
        records: records.map(stamp),
        history: history.map((r) => Object.assign({}, r.data, { id: r.id, participantId: r.participant_id, at: r.at, by: names.get(r.actor) || '알 수 없음' })),
      };
    },

    // store.init 에서 migrate 후 호출 — 현재 상태를 '서버와 같음'으로 기록
    snapshot(db) {
      const map = (list, t) => new Map(list.map((x) => [x.id, { json: JSON.stringify(x), ts: this.serverTs.get(`${t}:${x.id}`) }]));
      this.snap = {
        participants: map(db.participants, 'participants'), documents: map(db.documents, 'documents'), records: map(db.records, 'records'),
        history: new Set(db.history.map((h) => h.id)), orgName: db.settings.orgName,
      };
      this.failed.clear();
    },

    save() {
      this.pending++;
      PPP.syncStatus && PPP.syncStatus();
      const run = this.queue.then(() => this.push());
      this.queue = run.catch(() => {});
      return run.finally(() => { this.pending--; PPP.syncStatus && PPP.syncStatus(); });
    },

    plan(db) {
      const ops = { del: { documents: [], records: [], participants: [] }, ins: {}, upd: {}, history: [], orgName: null };
      Object.keys(TABLES).forEach((t) => {
        ops.ins[t] = []; ops.upd[t] = [];
        const snap = this.snap[t];
        const seen = new Set();
        db[t].forEach((x) => {
          seen.add(x.id);
          if (this.failed.has(`${t}:${x.id}`)) return;
          const json = JSON.stringify(x);
          const s = snap.get(x.id);
          if (!s) ops.ins[t].push({ x, json });
          else if (s.json !== json) ops.upd[t].push({ x, json, ts: s.ts });
        });
        snap.forEach((_, id) => { if (!seen.has(id) && !this.failed.has(`${t}:${id}`)) ops.del[t].push(id); });
      });
      ops.history = db.history.filter((h) => !this.snap.history.has(h.id) && !this.failed.has(`history:${h.id}`));
      if (db.settings.orgName !== this.snap.orgName) ops.orgName = db.settings.orgName;
      return ops;
    },

    async push() {
      const db = PPP.store.db;
      const ops = this.plan(db);
      const errors = [];
      const attempt = async (key, fn) => {
        try { await fn(); } catch (e) {
          if (e.permanent) this.failed.set(key, e.message);
          errors.push(e);
          if (e.status === 401) throw e;
        }
      };
      // 1) 서식·기록 삭제 → 2) 이용자 삭제 → 3) 이용자 등록·수정 → 4) 서식·기록 등록·수정 → 5) 이력 → 6) 설정
      for (const t of ['documents', 'records', 'participants']) {
        const ids = ops.del[t];
        if (ids.length) await attempt(`${t}:${ids[0]}`, async () => {
          await api('DELETE', `${t}?id=${enc(inList(ids))}`);
          ids.forEach((id) => this.snap[t].delete(id));
        });
      }
      for (const t of ['participants', 'documents', 'records']) {
        for (const { x, json } of ops.ins[t]) {
          await attempt(`${t}:${x.id}`, async () => {
            const rows = await api('POST', t, { body: TABLES[t].toRow(x), prefer: 'return=representation' });
            this.snap[t].set(x.id, { json, ts: rows[0].updated_at });
          });
        }
        for (const { x, json, ts } of ops.upd[t]) {
          await attempt(`${t}:${x.id}`, async () => {
            const rows = await api('PATCH', `${t}?id=eq.${enc(x.id)}&updated_at=eq.${enc(ts)}`, { body: TABLES[t].patch(x), prefer: 'return=representation' });
            if (!rows.length) throw new ApiError('다른 담당자가 먼저 수정했거나 권한이 없어 저장하지 못했습니다. [서버에서 다시 불러오기] 후 다시 입력해 주세요.', { status: 409, permanent: true });
            this.snap[t].set(x.id, { json, ts: rows[0].updated_at });
          });
        }
      }
      if (ops.history.length) await attempt(`history:${ops.history[0].id}`, async () => {
        await api('POST', 'history', { body: ops.history.map((h) => ({ id: h.id, participant_id: h.participantId || null, data: h })), prefer: 'return=minimal' });
        ops.history.forEach((h) => this.snap.history.add(h.id));
      });
      if (ops.orgName != null) await attempt('settings:1', async () => {
        const rows = await api('PATCH', 'settings?id=eq.1', { body: { org_name: ops.orgName }, prefer: 'return=representation' });
        if (!rows.length) throw new ApiError('기관명은 관리자만 변경할 수 있습니다.', { status: 403, permanent: true });
        this.snap.orgName = ops.orgName;
      });
      if (errors.length) throw errors[0];
    },

    hasUnsaved() {
      if (!this.snap || !PPP.store.db) return false;
      const ops = this.plan(PPP.store.db);
      return this.pending > 0 || this.failed.size > 0 || Object.values(ops.ins).some((a) => a.length) || Object.values(ops.upd).some((a) => a.length) || ops.history.length > 0;
    },
  };

  PPP.supa = { auth, api, ServerAdapter, ApiError, isAdmin: () => !!(auth.profile && auth.profile.role === 'admin') };
})();
