/* 가상 샘플 데이터 — 실제 이용자 정보가 아닌 시연·테스트용 데이터 */
(function () {
  const PPP = (window.PPP = window.PPP || {});

  PPP.buildSampleData = function () {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const staff = PPP.store.db.settings.staff;
    const year = new Date().getFullYear();
    const aliases = ['하늘', '바다', '나무', '구름', '별빛', '햇살', '들꽃', '시냇물', '노을', '새싹', '단비', '무지개', '솔바람', '봄날'];
    const types = ['지적장애', '지적장애', '자폐성장애', '자폐성장애', '뇌병변장애', '지체장애', '중복장애', '시각장애'];
    const stepsDoneCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12];
    const iso = (d) => d.toISOString().slice(0, 10);
    const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
    const now = new Date();
    const usedCodes = new Set(PPP.store.db.participants.map((p) => p.code));
    let codeNum = 1;
    const nextCode = () => { let c; do { c = `PPP-${year}-${String(900 + codeNum++).padStart(3, '0')}`; } while (usedCodes.has(c)); usedCodes.add(c); return c; };

    const participants = [], documents = [], records = [];
    const required = PPP.STEPS.filter((s) => !s.optional);

    aliases.forEach((alias, i) => {
      const doneCount = stepsDoneCounts[i];
      const start = addDays(now, -(60 + doneCount * 45 + Math.floor(rnd() * 30)));
      const steps = {};
      PPP.STEPS.forEach((s) => (steps[s.key] = { done: false, date: '' }));
      let cursor = start;
      required.slice(0, doneCount).forEach((s) => { cursor = addDays(cursor, 20 + Math.floor(rnd() * 25)); if (cursor > now) cursor = now; steps[s.key] = { done: true, date: iso(cursor) }; });
      if (rnd() > 0.5) steps.familyProgram = { done: true, date: iso(addDays(start, 15)) };
      let status = 'active';
      if (i === 12) status = 'linked';
      if (i === 13) status = 'closed';
      const p = Object.assign(PPP.newParticipant(), {
        id: PPP.uid('p'), code: nextCode(), alias: `${alias}(가명)`, name: '',
        gender: rnd() > 0.45 ? '남' : '여', birthYear: String(year - (19 + Math.floor(rnd() * 32))),
        disabilityType: pick(types), disabilitySeverity: rnd() > 0.25 ? '심한 장애' : '심하지 않은 장애',
        manager: staff[i % staff.length], guardianRelation: pick(['모', '부', '형제자매', '모']),
        consent: i % 6 === 5 ? { guardian: false, date: '', method: '', note: '동의서 회수 예정' } : { guardian: true, date: iso(start), method: '서면', note: '' },
        selfHelpGroup: pick(PPP.SELF_HELP_GROUPS), supportStart: iso(start), status, steps,
        closing: status === 'closed' ? { reason: '가상 데이터: 이사로 인한 서비스 종결', requestedBy: staff[0], requestedAt: iso(addDays(now, -20)), reviewedBy: staff[1], reviewedAt: iso(addDays(now, -18)), guardianConfirmed: true } : null,
        memo: '가상 샘플 데이터입니다.',
        createdAt: start.toISOString(), createdBy: 'sample', updatedAt: now.toISOString(), updatedBy: 'sample',
      });
      participants.push(p);

      // 기록
      PPP.RECORD_TYPES.forEach((t) => {
        if (t.step && steps[t.step] && steps[t.step].done) {
          records.push({ id: PPP.uid('r'), participantId: p.id, date: steps[t.step].date, type: t.key, area: t.key === '실천활동' || t.key === '활동평가' ? pick(PPP.DOMAINS.slice(0, 9)) : '',
            attendees: '당사자, 보호자, 담당자', content: `${t.key} 진행 (가상 기록)`, result: '', nextPlan: '', achievement: t.key === '활동평가' ? String(2 + Math.floor(rnd() * 4)) : '',
            createdAt: now.toISOString(), createdBy: 'sample', updatedAt: now.toISOString(), updatedBy: 'sample' });
        }
      });
      if (steps.activity.done) {
        for (let m = 1; m <= 4; m++) {
          const d = addDays(now, -m * 21 - Math.floor(rnd() * 10));
          records.push({ id: PPP.uid('r'), participantId: p.id, date: iso(d), type: '실천활동', area: pick(PPP.DOMAINS.slice(0, 9)), attendees: '당사자, 활동지원사', content: '지역사회 활동 참여 (가상 기록)', result: '', nextPlan: '', achievement: '',
            createdAt: now.toISOString(), createdBy: 'sample', updatedAt: now.toISOString(), updatedBy: 'sample' });
        }
      }

      // 서식
      if (steps.counsel.done) {
        documents.push({ id: PPP.uid('d'), participantId: p.id, formKey: 'selfIntro', createdAt: now.toISOString(), createdBy: 'sample', updatedAt: now.toISOString(), updatedBy: 'sample',
          data: { writtenAt: steps.counsel.date, writer: '보호자', supporter: p.manager, oneWord: pick(['웃음이 많은 사람', '부지런한 사람', '음악을 좋아하는 사람']), gender: p.gender, disabilityType: p.disabilityType,
            dream: pick(['카페에서 일하기', '혼자 여행 가기', '내 방 꾸미기', '친구와 영화 보기']), adl: { '0_0': 3, '0_6': 4, '1_0': 2, '3_2': 4 } } });
      }
      if (steps.shortPlan.done) {
        const areas = [pick(PPP.DOMAINS.slice(0, 9)), pick(PPP.DOMAINS.slice(0, 9)), pick(PPP.DOMAINS.slice(0, 9))];
        documents.push({ id: PPP.uid('d'), participantId: p.id, formKey: 'actionPlan', createdAt: now.toISOString(), createdBy: 'sample', updatedAt: now.toISOString(), updatedBy: 'sample',
          data: { year: year, writtenAt: steps.shortPlan.date, dream: '지역사회에서 즐겁게 생활하기 (가상)', longGoal: '스스로 선택한 활동을 꾸준히 이어가기',
            plans: areas.map((a) => ({ area: a, goal: `${a} 영역 단기목표 (가상)`, plan: '월 2회 활동 참여', note: '' })) } });
      }
      if (steps.annualEval.done) {
        documents.push({ id: PPP.uid('d'), participantId: p.id, formKey: 'yearStory', createdAt: now.toISOString(), createdBy: 'sample', updatedAt: now.toISOString(), updatedBy: 'sample',
          data: { year: year, writtenAt: steps.annualEval.date, score: String(6 + Math.floor(rnd() * 4)), storyText: '새로운 활동에 도전함 (가상)' } });
      }
    });
    return { participants, documents, records };
  };
})();
