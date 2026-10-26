/* 내보내기 — 백업(JSON), CSV(UTF-8 BOM), 엑셀(SpreadsheetML .xls) */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const S = () => PPP.store;
  const stamp = () => PPP.today().replace(/-/g, '');
  const STATUS = { active: '진행 중', closing: '종결 검토 대기', closed: '종결', linked: '자조활동 연계' };

  function backup(label) {
    const b = S().buildBackup();
    PPP.download(`평생과정설계_백업_${label ? label + '_' : ''}${stamp()}_${Date.now().toString().slice(-6)}.json`, JSON.stringify(b, null, 1), 'application/json');
  }

  function participantRows(incSensitive) {
    const head = ['참여자 코드', '가명', ...(incSensitive ? ['실명'] : []), '성별', '연령대', '장애유형', '장애정도', '담당자', '상태', '현재 단계', '진행률(%)', '다음 단계', '지원 시작일', '지원 경과(개월)', '보호자 동의', '동의일', '자조활동', '최근 기록일',
      ...PPP.STEPS.map((s) => `${s.label} 완료일`)];
    const rows = S().participants().map((p) => {
      const pr = S().progress(p);
      return [p.code, p.alias, ...(incSensitive ? [p.name] : []), p.gender, PPP.ageBand(p.birthYear), p.disabilityType, p.disabilitySeverity, p.manager, STATUS[p.status], pr.stage, pr.pct, pr.next ? pr.next.label : '', p.supportStart, pr.months == null ? '' : pr.months,
        p.consent.guardian ? '확인' : '미확인', p.consent.date, p.selfHelpGroup, S().lastRecordDate(p.id), ...PPP.STEPS.map((s) => (p.steps[s.key].done ? p.steps[s.key].date || '완료' : ''))];
    });
    return [head, ...rows];
  }
  function recordRows() {
    const head = ['일자', '참여자 코드', '가명', '유형', '영역', '참석자', '주요 내용', '결정·평가', '다음 계획', '달성도', '작성자'];
    return [head, ...S().records().map((r) => { const p = S().participant(r.participantId) || {}; return [r.date, p.code, p.alias, r.type, r.area, r.attendees, r.content, r.result, r.nextPlan, r.achievement, r.updatedBy || r.createdBy]; })];
  }
  function planRows() {
    const head = ['참여자 코드', '가명', '연도', '꿈과 희망', '중장기목표', '영역', '단기목표', '실천계획', '비고'];
    const rows = [];
    S().db.documents.filter((d) => d.formKey === 'actionPlan').forEach((d) => {
      const p = S().participant(d.participantId) || {};
      (d.data.plans || []).forEach((pl) => rows.push([p.code, p.alias, d.data.year, d.data.dream, d.data.longGoal, pl.area, pl.goal, pl.plan, pl.note]));
    });
    return [head, ...rows];
  }

  // CSV: 수식 주입 방지를 위해 =,+,-,@ 로 시작하는 값 앞에 ' 를 붙인다
  const safe = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
  const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => `"${safe(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');

  function xls(sheets) {
    const x = (v) => PPP.esc(safe(v)).replace(/\n/g, '&#10;');
    const ws = sheets.map(([name, rows]) => `<Worksheet ss:Name="${x(name)}"><Table>${rows.map((r, i) => `<Row>${r.map((v) => `<Cell${i === 0 ? ' ss:StyleID="h"' : ''}><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${x(v)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#DCE8F7" ss:Pattern="Solid"/></Style></Styles>${ws}</Workbook>`;
  }

  function run(kind, incSensitive) {
    const d = stamp();
    if (kind === 'participants') PPP.download(`참여자현황_${d}.csv`, csv(participantRows(incSensitive)), 'text/csv;charset=utf-8');
    else if (kind === 'records') PPP.download(`기록_${d}.csv`, csv(recordRows()), 'text/csv;charset=utf-8');
    else if (kind === 'plans') PPP.download(`실천계획_${d}.csv`, csv(planRows()), 'text/csv;charset=utf-8');
    else if (kind === 'xls') PPP.download(`평생과정설계_${d}.xls`, xls([['참여자 현황', participantRows(incSensitive)], ['기록', recordRows()], ['실천계획', planRows()]]), 'application/vnd.ms-excel');
    S().addHistory({ participantId: null, entity: 'system', action: '내보내기', summary: `${kind} 내보내기${incSensitive ? ' (실명 포함)' : ''}` });
    S().persist();
  }

  PPP.exporter = { backup, run, csv, participantRows };
})();
