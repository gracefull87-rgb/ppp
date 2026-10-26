/* 평생과정설계 — 업무 단계·영역·서식 정의
 * 서식(자기소개서, 미래설계 실천계획서, 행복한 미래 이야기)은 기관 HWP 양식의 항목 순서를 그대로 옮겼다.
 * 필드 타입: text, textarea, date, number, select, radio, checks, table, grid, matrix, compare, amounts
 * 구조 요소: part(【 】 대제목), domain(영역 설계 제목), sub(○ 소제목), note(안내문)
 */
(function () {
  const PPP = (window.PPP = window.PPP || {});

  /* ---------- 업무 단계 (성민복지관 평생과정설계 단계별 Process 기준) ---------- */
  PPP.STAGES = [
    { key: '준비', desc: '아카데미 · 준비상담 · 가족지원' },
    { key: '계획', desc: '지원회의 (상담 → 단기계획 수립)' },
    { key: '실천', desc: '세부계획 확인 · 실천활동 · 활동평가' },
    { key: '평가', desc: '실천과정 평가 (연 1회 모니터링)' },
  ];

  PPP.STEPS = [
    { key: 'academy', stage: '준비', label: '아카데미 수료', desc: '당사자/보호자/지원자 아카데미' },
    { key: 'prepCounsel', stage: '준비', label: '준비상담', desc: '영역별 정보 제공, 준비 과정 안내' },
    { key: 'familyProgram', stage: '준비', label: '가족 지원 프로그램', desc: '장애수용·교육·심리활동·자조모임 (선택)', optional: true },
    { key: 'counsel', stage: '계획', label: '상담', desc: '회의 설계, 자기소개서 작성 안내' },
    { key: 'preMeeting', stage: '계획', label: '사전회의', desc: '꿈과 히스토리 공유' },
    { key: 'integratedMeeting', stage: '계획', label: '통합회의', desc: '힘과 필요 찾기' },
    { key: 'conferenceMeeting', stage: '계획', label: '컨퍼런스회의', desc: '중장기목표 협의' },
    { key: 'confirmMeeting', stage: '계획', label: '확정회의', desc: '중장기목표 및 영역 우선순위 확정' },
    { key: 'shortPlan', stage: '계획', label: '단기계획 수립', desc: '단기목표(2년) 및 해당연도 실천계획' },
    { key: 'detailPlan', stage: '실천', label: '세부계획 확인', desc: '월별·연간 활동 계획 협의' },
    { key: 'activity', stage: '실천', label: '실천활동 진행', desc: '지역중심 활동, 시민옹호인·활동지원사 협력' },
    { key: 'activityEval', stage: '실천', label: '활동평가', desc: '약속된 기간 내 평가 및 세부계획 조정' },
    { key: 'annualEval', stage: '평가', label: '실천과정 평가', desc: '목표·지원 평가, 다음 연도 계획 반영 (연 1회)' },
  ];

  // 기록 유형 → 완료 처리할 단계 (기록 저장 시 해당 단계가 미완료면 완료로 표시)
  PPP.RECORD_TYPES = [
    { key: '준비상담', step: 'prepCounsel' },
    { key: '가족지원 프로그램', step: 'familyProgram' },
    { key: '상담', step: 'counsel' },
    { key: '사전회의', step: 'preMeeting' },
    { key: '통합회의', step: 'integratedMeeting' },
    { key: '컨퍼런스회의', step: 'conferenceMeeting' },
    { key: '확정회의', step: 'confirmMeeting' },
    { key: '세부계획 확인', step: 'detailPlan' },
    { key: '실천활동', step: 'activity' },
    { key: '활동평가', step: 'activityEval' },
    { key: '실천과정 평가', step: 'annualEval' },
    { key: '자조활동', step: null },
    { key: '기타', step: null },
  ];

  PPP.DOMAINS = ['일상생활', '교육', '보건의료', '문화여가', '직업', '결혼', '주거', '법적', '소득재정', '기타'];
  PPP.DISABILITY_TYPES = ['지적장애', '자폐성장애', '지체장애', '뇌병변장애', '시각장애', '청각장애', '언어장애', '정신장애', '중복장애', '기타'];
  // 미래설계서비스이용현황 (복수 선택)
  PPP.SERVICE_TYPES = ['평생과정설계 보호자 아카데미', '평생과정설계 가족 아카데미', '평생과정설계 자조모임'];
  PPP.SUPPORT_YEARS = 3; // 미래설계 지원 3년(지원회의 1년, 실천 2년) 후 자조활동 연계

  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const WEEK_ROWS = ['관계 (누구와)', '활동 (무엇을)', '장소 (어디서)'];
  const SCALE = ['시도하지 않음', '수행불가', '가끔씩', '도움주면 가능', '수행가능'];
  const LIKE_ROWS = ['상황', '공간', '사람', '활동', '물건', '음식', '의사표현', '기타 (색깔, 음악 등)'];
  const story = (k, name) => ({ k, t: 'textarea', label: `평생과정설계 아카데미에서 표현한 ‘${name}’ 이야기`, hint: '영역별 활동내용, 예비 미래설계서 중 해당 영역 내용 기록', wide: true });
  const yn = ['네', '아니오'];

  /* ---------- 서식 1: 평생과정설계 자기소개서 ---------- */
  const selfIntro = {
    key: 'selfIntro',
    title: '평생과정설계 자기소개서',
    subtitle: '행복을 이루기 위한 “나”의 이야기',
    stepHint: 'counsel',
    intro:
      '평생과정설계 자기소개서 「행복을 이루기 위한 “나”의 이야기」는 평생과정설계 계획수립을 위한 기본적인 자료로 활용됩니다. 또한 “나”의 이야기는 장애 당사자와 가족의 소중한 삶의 이야기들이 담겨있어 추후 매우 의미 있는 자료가 될 것입니다. “나”의 이야기의 “나”는 장애 당사자를 의미합니다. “나”의 이야기는 장애 당사자와 가족이 함께 작성하시는 것이 가장 좋습니다.',
    fields: [
      { k: 'writtenAt', t: 'date', label: '작성일', required: true },
      { k: 'writer', t: 'text', label: '작성자' },
      { k: 'supporter', t: 'text', label: '지원자' },

      { t: 'part', label: '【 나를 소개합니다 】' },
      { k: 'photoDesc', t: 'textarea', label: '♥ 사진을 설명해주세요.', hint: '사진은 앱에 저장하지 않습니다. 출력본에 직접 부착하세요.', wide: true },
      { t: 'sub', label: '○ “나”를 한마디로 표현하기' },
      { k: 'oneWord', t: 'text', label: '“나”를 한마디로', wide: true },

      { t: 'sub', label: '○ 나의 기본정보' },
      { t: 'note', label: '개인정보 최소수집: 이름·연락처·주소는 꼭 필요한 경우에만 입력하세요. 익명 모드에서는 가려서 표시됩니다.' },
      { k: 'name', t: 'text', label: '이름', sensitive: true },
      { k: 'gender', t: 'radio', label: '성별', opts: ['남', '여'] },
      { k: 'birth', t: 'text', label: '생년월일', placeholder: '예) 1995년 3월 2일', sensitive: true },
      { k: 'birthCal', t: 'radio', label: '음·양', opts: ['음', '양'] },
      { k: 'phone', t: 'text', label: '연락처 (나)', sensitive: true },
      { k: 'emergencyPhone', t: 'text', label: '연락처 (긴급연락처)', sensitive: true },
      { k: 'address', t: 'text', label: '주소', sensitive: true, wide: true },
      { k: 'disabilityType', t: 'text', label: '장애유형' },
      { k: 'disabilityTrait', t: 'textarea', label: '장애특성' },
      { k: 'actSupport', t: 'radio', label: '활동지원 서비스', opts: ['이용함', '이용안함'] },
      { k: 'actHours', t: 'number', label: '활동지원 이용시간', unit: '시간/월' },
      { k: 'actContent', t: 'textarea', label: '활동지원 내용' },
      { k: 'blood', t: 'text', label: '혈액형' },
      { k: 'vision', t: 'text', label: '시력' },
      { k: 'height', t: 'number', label: '키', unit: 'cm' },
      { k: 'weight', t: 'number', label: '몸무게', unit: 'kg' },
      { k: 'sizeTop', t: 'text', label: '사이즈 - 상의' },
      { k: 'sizeBottom', t: 'text', label: '사이즈 - 하의' },
      { k: 'sizeShoes', t: 'text', label: '사이즈 - 신발' },
      { k: 'religion', t: 'text', label: '종교' },
      { k: 'religionAct', t: 'text', label: '종교시설에서 하고 있는 활동' },
      { k: 'nickname', t: 'text', label: '별명' },
      { k: 'personality', t: 'textarea', label: '성격' },
      { k: 'basicEtc', t: 'textarea', label: '기타' },

      { t: 'sub', label: '○ 나의 특성' },
      { k: 'goodAt', t: 'textarea', label: '내가 잘하는 것 (좋은 점, 좋은 습관 등)' },
      { k: 'favStory', t: 'textarea', label: '내가 좋아하는 이야기 또는 추억' },
      { k: 'likedLook', t: 'textarea', label: '사람들이 좋아하는 나의 모습' },
      { k: 'likes', t: 'grid', label: '내가 좋아하는 것 또는 나를 기분 좋게 하는 것', rowLabels: LIKE_ROWS, cols: [{ k: 'v', label: '내용' }] },
      { k: 'dislikes', t: 'grid', label: '내가 싫어하는 것 또는 나를 어렵게 하는 것', rowLabels: LIKE_ROWS, cols: [{ k: 'v', label: '내용' }] },
      { k: 'comfortWay', t: 'textarea', label: '나를 편안하게 하는 방법' },
      { k: 'consoleWay', t: 'textarea', label: '나에게 위로를 주는 방법' },

      { t: 'sub', label: '○ 나와 함께 하고 있는 사람들' },
      { k: 'people', t: 'table', label: '함께 하고 있는 사람들', minRows: 4, cols: [
        { k: 'relation', label: '관계' }, { k: 'name', label: '이름', sensitive: true }, { k: 'age', label: '나이' },
        { k: 'job', label: '직업' }, { k: 'phone', label: '전화번호', sensitive: true }, { k: 'help', label: '도움을 주는 내용' } ] },
      { k: 'anniversaries', t: 'textarea', label: '• 나와 가족이 기념하는 행사와 기념하는 방법', wide: true },
      { k: 'friends', t: 'textarea', label: '• 나의 친구(지인 등) 소개 및 함께 하는 방법', wide: true },
      { k: 'orgs', t: 'textarea', label: '• 내가 소속된 기관(단체 등)과 활동 방법', wide: true },

      { t: 'part', label: '【 꿈과 행복 찾기 】' },
      { t: 'sub', label: '○ 나의 일상 나누기' },
      { k: 'dailyRoutine', t: 'grid', label: '하루 일과', corner: '구분', rowLabels: ['아침', '점심', '저녁', '밤'], cols: [{ k: 'routine', label: '하루 일과' }, { k: 'rule', label: '나만의 중요한 규칙(루틴)' }] },
      { k: 'weekNow', t: 'grid', label: '주간 활동', corner: '주간 활동', rowLabels: WEEK_ROWS, cols: DAYS.map((d) => ({ k: d, label: d })) },
      { t: 'sub', label: '○ 내가 생각하는 행복이란? (행복하고 즐거웠던 경험 등)' },
      { k: 'happiness', t: 'textarea', label: '내가 생각하는 행복', wide: true },
      { t: 'sub', label: '○ 나의 꿈은?' },
      { k: 'dream', t: 'textarea', label: '나의 꿈', wide: true },
      { t: 'sub', label: '○ 내가 기대하는 일상' },
      { k: 'weekHope', t: 'grid', label: '내가 기대하는 주간 활동', corner: '주간 활동', rowLabels: WEEK_ROWS, cols: DAYS.map((d) => ({ k: d, label: d })) },

      { t: 'part', label: '【 행복한 삶 준비하기 】' },
      { t: 'domain', label: '일상생활', sub: '자립생활에 필요한 것 돌아보기' },
      { k: 'adl', t: 'matrix', label: '일상생활 활동', scale: SCALE, groups: [
        { name: '(1) 청소와 정리하기', items: ['집안 청소하기', '이부자리 정리하기', '옷장 정리하기', '탁자, 서랍장 정리하기', '싱크대 정리하기', '냉장고 정리하기', '설거지하기', '화장실 청소하기'] },
        { name: '(2) 빨래하기', items: ['세탁기 사용하기', '손빨래하기', '세탁소 이용하기'] },
        { name: '(3) 쓰레기 버리기', items: ['재활용 쓰레기', '음식물 쓰레기', '일반쓰레기'] },
        { name: '(4) 음식 만들기', items: ['양념 및 음식재료 알기', '요리도구 사용하기', '밥솥 사용하기'] },
        { name: '(5) 단정하게 옷 입기', items: ['자신의 옷 고르기', '깨끗한 옷 고르기', '결혼/장례식 때에 맞는 옷 입기'] },
        { name: '(6) 멋내기', items: ['머리 정돈하기', '손톱과 발톱 관리하기', '화장품 사용하기', '액세서리 사용하기'] },
        { name: '(7) 고장난 물건 고치기', items: ['라디오나 핸드폰이 고장 났을 때 서비스 센터 이용하기'] },
      ] },
      { k: 'social', t: 'matrix', label: '사람들과 친하게 지내기 활동', scale: SCALE, groups: [
        { name: '(1) 사람들과 대화하기', items: ['대화할 때 바른 행동 알기', '좋은 말 사용하기', '나의 어려운 점 이야기하기'] },
        { name: '(2) 친구들과 친하게 지내기', items: ['취미생활 함께 하기', '모임에 참석하기', '집에 초대하기', '비밀지키기', '약속 지키기'] },
        { name: '(3) 이웃들과 함께 살기', items: ['이웃에게 인사하기', '질서 지키기', '피해주지 않기', '버스/지하철 예의 지키기'] },
        { name: '(4) 가족들과 친하게 지내기', items: ['가족 행사가기 (생일, 결혼 등)', '어른에게 안부 전화하기'] },
        { name: '(5) 지역사회시설 이용하기', items: ['주민센터 위치 알기 (구청, 동주민센터, 시청 등)', '우체국, 은행, 병원 등 찾기', '각 시설 이용하는 방법 알기'] },
        { name: '(6) 핸드폰으로 카카오톡, 문자, 페이스북 사용하기', items: ['들어가는 방법 알기', '문자 쓰는 방법 알기', '사진 올리는 방법 알기'] },
        { name: '(7) 원하는 곳으로 외출하기', items: ['내가 갈 곳 찾기', '버스, 택시, 지하철 이용 방법 알기', '길 묻기'] },
      ] },

      { t: 'domain', label: '교육설계', sub: '꿈을 이루기 위한 이야기' },
      story('eduStory', '교육'),
      { t: 'sub', label: '○ 과거 교육' },
      { k: 'eduPast', t: 'table', label: '과거 교육', minRows: 2, cols: [{ k: 'name', label: '교육명' }, { k: 'org', label: '교육기관' }, { k: 'period', label: '교육기간' }, { k: 'note', label: '비고' }] },
      { t: 'sub', label: '○ 현재 교육' },
      { k: 'eduNow', t: 'table', label: '현재 교육', minRows: 2, cols: [{ k: 'name', label: '교육명' }, { k: 'org', label: '교육기관' }, { k: 'period', label: '교육기간' }, { k: 'satisfaction', label: '만족도 (소감 등)' }] },
      { t: 'sub', label: '○ 꿈을 이루기 위한 미래 교육' },
      { k: 'eduFuture', t: 'table', label: '미래 교육', minRows: 2, cols: [{ k: 'hope', label: '희망교육' }, { k: 'reason', label: '이유' }, { k: 'help', label: '필요한 도움' }] },

      { t: 'domain', label: '보건의료 설계', sub: '몸과 마음이 건강하기 위한 이야기' },
      story('healthStory', '보건의료'),
      { t: 'sub', label: '○ 내가 생각하는 건강' },
      { k: 'myHealth', t: 'textarea', label: '나의 건강은 어떤가요?', wide: true },
      { k: 'healthHelp', t: 'grid', label: '내가 더 건강해지기 위해 필요한 도움은 무엇인가요?', corner: '항목', rowLabels: ['정기적 건강검진(구강검진 등)', '건강한 식단관리', '건강한 체형(다이어트 등)', '건강한 마음챙김(스트레스 해소)', '건강관련 정보 알기', '약물복용 방법 알기', '기타'], cols: [{ k: 'checked', label: '선택', type: 'check' }, { k: 'content', label: '내용' }, { k: 'help', label: '필요한 도움' }] },
      { k: 'healthRole', t: 'grid', label: '나의 건강한 역할에 필요한 도움은 무엇인가요?', corner: '질문', rowLabels: ['가족에서 어떤 역할을 하고 싶나요?', '친구, 동료 등 주변 사람들에게 어떤 역할을 하고 싶나요?'], cols: [{ k: 'content', label: '내용' }, { k: 'help', label: '필요한 도움' }] },
      { t: 'sub', label: '○ 나의 건강 정보' },
      { k: 'diagnosis', t: 'textarea', label: '진단명 (또는 질환)', sensitive: true },
      { k: 'hospitals', t: 'table', label: '이용병원', minRows: 2, cols: [{ k: 'name', label: '병원이름(의사)' }, { k: 'content', label: '진료내용' }, { k: 'cycle', label: '방문주기', type: 'select', opts: ['정기', '비정기'] }, { k: 'cycleNote', label: '정기 주기' }] },
      { k: 'meds', t: 'table', label: '약 복용', minRows: 2, cols: [{ k: 'name', label: '약 이름' }, { k: 'reason', label: '복용이유' }, { k: 'when', label: '복용시기' }] },
      { k: 'medManage', t: 'radio', label: '복용관리', opts: ['스스로 복용', '복용 지원 필요'] },
      { k: 'aids', t: 'checks', label: '보조기구', opts: ['안경', '보청기', '휠체어', '기타'], other: true },
      { k: 'habitFood', t: 'text', label: '건강습관 - 식습관' },
      { k: 'habitSleep', t: 'text', label: '건강습관 - 수면' },
      { k: 'habitSupp', t: 'text', label: '건강습관 - 보조식품' },
      { k: 'habitOral', t: 'text', label: '건강습관 - 구강관리' },
      { k: 'habitCheckup', t: 'text', label: '건강습관 - 건강검진' },
      { k: 'stress', t: 'radio', label: '스트레스가 있나요?', opts: ['없다', '가끔', '자주'] },
      { k: 'stressWay', t: 'textarea', label: '스트레스가 있다면 해결방법이 무엇인가요?' },
      { k: 'depress', t: 'radio', label: '우울을 느낀 적이 있나요?', opts: ['없다', '가끔', '자주'] },
      { k: 'depressWay', t: 'textarea', label: '우울을 느낀 적이 있다면 해결방법이 무엇인가요?' },
      { k: 'agingKnow', t: 'textarea', label: '늙어감 - 나이 들어감(노화)에 대해 알고 있나요?' },
      { k: 'agingBody', t: 'textarea', label: '늙어감 - 나이 들면 몸에 나타나는 변화를 알고 있나요?' },
      { k: 'agingHope', t: 'textarea', label: '늙어감 - 나는 어떤 모습으로 늙어가고 싶나요?' },
      { k: 'deathThink', t: 'textarea', label: '죽음에 대해 어떻게 생각하나요?' },
      { k: 'deathExp', t: 'radio', label: '주변 사람의 죽음을 경험한 적이 있나요?', opts: ['없다', '있다'] },
      { k: 'deathFeel', t: 'textarea', label: '그때 느꼈던 감정이 무엇인가요?' },

      { t: 'domain', label: '문화여가설계', sub: '신나고 즐겁게 활동하기 위한 이야기' },
      story('leisureStory', '문화여가'),
      { t: 'sub', label: '○ 나의 문화여가 경험' },
      { k: 'leisurePast', t: 'table', label: '문화여가 경험', minRows: 3, cols: [{ k: 'act', label: '문화여가 활동' }, { k: 'good', label: '좋았던 이유' }, { k: 'bad', label: '싫었던 이유' }] },
      { t: 'sub', label: '○ 내가 희망하는 문화여가' },
      { k: 'leisureHope', t: 'table', label: '희망 문화여가', minRows: 3, cols: [{ k: 'act', label: '문화여가 활동' }, { k: 'who', label: '누구와' }, { k: 'when', label: '언제(낮, 밤)' }, { k: 'reason', label: '이유' }] },
      { k: 'leisureHelp', t: 'checks', label: '필요한 도움', opts: ['함께 하는 사람', '다양한 문화여가 활동 경험', '문화여가 활동비용', '문화여가 활동 시간과 장소 확보', '문화여가 관련 정보 알기', '기타'], other: true },

      { t: 'domain', label: '직업설계', sub: '사회에서 즐겁게 일하기 위한 이야기' },
      story('jobStory', '직업'),
      { t: 'sub', label: '○ 직업이 있는 경우' },
      { k: 'jobKeep', t: 'radio', label: '현재 직업을 계속 하고 싶나요?', opts: ['네', '아니오 (직업이 없는 경우로 이동)'] },
      { k: 'jobKeepPrep', t: 'textarea', label: '직업을 계속 하기 위해 필요한 준비는 무엇인가요?' },
      { k: 'jobKeepSupport', t: 'textarea', label: '직업을 계속 하기 위해 필요한 지원은 무엇인가요?' },
      { t: 'sub', label: '○ 직업이 없는 경우 (또는 직업을 바꾸고 싶은 경우)' },
      { k: 'jobHope', t: 'radio', label: '직업을 희망하나요?', opts: yn },
      { k: 'jobHopeWhat', t: 'textarea', label: '희망하는 직업이 무엇인가요?' },
      { k: 'jobHopePrep', t: 'textarea', label: '희망하는 직업을 위해 필요한 준비는 무엇인가요?' },
      { k: 'jobHopeSupport', t: 'textarea', label: '희망하는 직업을 위해 필요한 지원은 무엇인가요?' },
      { t: 'sub', label: '○ 사회에 도움이 되는 활동' },
      { k: 'socialAct', t: 'radio', label: '사회에 도움이 되는 활동을 희망하나요?', opts: yn },
      { k: 'socialActWhat', t: 'textarea', label: '당신이 희망하는 활동이 무엇인가요?' },

      { t: 'domain', label: '결혼설계', sub: '좋아하는 사람과 함께 하기 위한 이야기' },
      story('marriageStory', '결혼'),
      { t: 'sub', label: '○ 의미 있는 관계' },
      { k: 'meaningful', t: 'checks', label: '나에게 의미있는 사람은 누구인가요? (가족 외)', opts: ['친구', '동료', '선후배', '배우자', '기타', '없다'], other: true },
      { k: 'meaningfulWhy', t: 'textarea', label: '이유는 무엇인가요?' },
      { k: 'meaningfulHelp', t: 'textarea', label: '의미있는 사람과의 관계에 필요한 도움이 무엇인가요?' },
      { t: 'sub', label: '○ 이성교제' },
      { k: 'dating', t: 'radio', label: '이성교제 중인가요?', opts: ['네', '아니요'] },
      { k: 'datingHope', t: 'radio', label: '이성교제를 희망하나요? (이성교제 중인 경우 지속적 교제)', opts: ['네', '아니요'] },
      { k: 'datingHelp', t: 'checks', label: '이성교제에 필요한 도움이 무엇인가요?', opts: ['감정표현하기', '상대방 이해하기', '데이트하기', '성적욕구(스킨십 등)', '결혼을 위한 준비', '기타'], other: true },
      { t: 'sub', label: '○ 결혼' },
      { k: 'married', t: 'radio', label: '결혼생활 중인가요?', opts: ['네', '아니요'] },
      { k: 'marriageHope', t: 'radio', label: '결혼을 희망하나요? (결혼한 경우 지속적 결혼생활)', opts: ['네', '아니요'] },
      { k: 'marriageHelp', t: 'checks', label: '결혼생활에 필요한 도움이 무엇인가요?', opts: ['가사활동(요리, 빨래 등)', '부부관계', '임신과 출산', '자녀 양육', '가족(시가, 처가 등)에서의 역할', '갈등해소 지원(부부 또는 가족)', '기타'], other: true },

      { t: 'domain', label: '주거설계', sub: '살고 싶은 집에 대한 이야기' },
      story('houseStory', '주거'),
      { t: 'sub', label: '○ 내가 선택하는 주거생활' },
      { k: 'housing', t: 'compare', label: '내가 선택하는 주거생활', rows: [
        { k: 'with', label: '누구와 살고 있나요?', kind: 'checks', opts: ['가족', '혼자', '배우자', '친구, 동료'] },
        { k: 'type', label: '집의 유형은 무엇인가요?', kind: 'checks', opts: ['아파트', '주택', '빌라/다가구주택', '거주시설(그룹홈 등)', '기타'] },
        { k: 'tenure', label: '집의 형태는 무엇인가요?', kind: 'checks', opts: ['자가', '전세', '월세', '무상(임대)', '기타'] },
        { k: 'location', label: '집의 위치는 어디인가요?', kind: 'checks', opts: ['서울시', '경기도', '다른 지역'], detail: true },
        { k: 'nearby', label: '집 주변에 필요한 것은 무엇인가요?', kind: 'checks', opts: ['공원', '학교', '마트', '은행', '우체국', '식당', '관공서', '편리한교통', 'PC방', '도서관', '복지기관', '종교시설', '영화관', '미용실', '병원', '기타'] },
        { k: 'ownSpace', label: '나만의 공간이 있나요?', kind: 'radio', opts: ['있다', '없다'], optsFuture: ['필요하다', '필요없다'] },
        { k: 'items', label: '나에게 중요한 물건이나 가구는 무엇인가요?', kind: 'text' },
        { k: 'neighbors', label: '내 주변에 누가 살았으면 좋겠나요?', kind: 'text' },
        { k: 'chores', label: '독립적으로 수행할 수 있는 집안 일이 있나요?', kind: 'checks', opts: ['청소', '빨래', '설거지', '요리', '가스 잠그기', '문단속', '기타'] },
        { k: 'safety', label: '안전장치가 있나요?', kind: 'checks', opts: ['소화기', '비상벨', '도움요청 방법 알고 있다', '읽기 쉬운 설명서', '채광, 환기', '기타'], optsFuture: ['소화기', '비상벨', '도움요청 방법 필요하다', '읽기 쉬운 설명서', '채광, 환기 등', '기타'] },
      ] },
      { k: 'housingHelp', t: 'checks', label: '필요한 도움', opts: ['집 준비 관련 정보제공 (임대주택 관련 정보, 자가주택 준비 등)', '집 준비 관련 비용 지원(주거생활 비용)', '집 내부 환경 바꾸기(주거환경 개선)', '가사 활동 및 관리 방법 알기', '기타'], other: true, wide: true },

      { t: 'domain', label: '법적설계', sub: '나를 이해하고 도와주는 사람에 대한 이야기' },
      story('legalStory', '법'),
      { t: 'sub', label: '○ 나를 이해하고 응원하는 사람(옹호인)' },
      { k: 'advocateWho', t: 'checks', label: '누가 나를 이해하고 응원해주길 희망하나요?', opts: ['가족', '친인척', '친구', '이웃', '사회복지사', '활동지원사', '기타'], other: true, wide: true },
      { k: 'advocateName', t: 'text', label: '이름', sensitive: true },
      { k: 'advocatePhone', t: 'text', label: '연락처', sensitive: true },
      { k: 'advocateHope', t: 'textarea', label: '희망하는 도움' },
      { k: 'advocateHelp', t: 'checks', label: '어떤 도움을 받고 싶은가요?', wide: true, other: true, opts: [
        '내 꿈을 위해 배우고 싶은 것을 알아보는 것', '몸이 아플 때 약국이나 병원에 가서 진료를 받는 것', '친구를 만들거나 친한 사람들과 신나고 즐거운 활동을 하는 것',
        '친한 사람들과 갈등이 생겼을 때 해결하는 것', '사랑하는 사람과 이성교제(데이트) 또는 결혼하는 것', '직장에서 생긴 어려운 일 해결, 직장생활 잘 할 수 있도록 하는 것',
        '은행에서 통장을 만들거나 돈을 찾는 것, 공과금(수도세, 전기세 등) 납부하는 것', '돈을 관리 하는 방법을 아는 것', '앞으로 살고 싶은 집(아파트, 빌라 등)을 준비하는 것',
        '요리활동, 집안일(청소, 빨래 등) 등을 잘 하는 것', '내 생각을 잘 말할 수 있도록 하는 것', '기타' ] },

      { t: 'domain', label: '소득재정설계', sub: '돈을 잘 사용하기 위한 이야기' },
      story('moneyStory', '소득재정'),
      { t: 'sub', label: '○ 돈 관리 경험' },
      { k: 'moneyExp', t: 'radio', label: '돈 사용에 대한 경험', opts: ['있다', '없다'] },
      { k: 'moneyPurpose', t: 'checks', label: '▸ 사용목적 (있다)', opts: ['식비', '간식비', '교통비', '통신비', '물건구매', '기타'], other: true },
      { k: 'moneyNoReason', t: 'text', label: '▸ 돈 사용 경험이 없는 이유 (없다)' },
      { t: 'sub', label: '○ 돈 관리 방법' },
      { k: 'moneyWho', t: 'radio', label: '돈 관리는 누가 하나요?', opts: ['내가 직접 관리', '가족이 관리', '후견인이 관리', '기타', '누가 관리하는지 모름'], other: true },
      { k: 'moneyKeep', t: 'radio', label: '돈 보관 방법은 무엇인가요?', opts: ['현금으로 보관', '은행에 저금함', '저금통에 저금함', '기타', '보관방법 모름'], other: true },
      { k: 'moneyUse', t: 'radio', label: '돈 사용방법은 무엇인가요?', opts: ['현금 사용', '체크카드 사용', '신용카드 사용', '기타', '사용방법 모름'], other: true },
      { k: 'moneyHelp', t: 'checks', label: '돈을 잘 관리하기 위해 필요한 도움은 무엇인가요?', opts: ['들어온 돈(수입)과 사용한 돈(지출)의 의미 알기', '계획적인 소비(돈 사용) 방법을 알고 실행하기', '다양한 분야의 소비 경험 늘리기', '기타'], other: true, wide: true },
      { t: 'sub', label: '○ 자녀의 소득재정 관리에 대한 생각 확인하기' },
      { t: 'note', label: '※ 지원자(보호자 등)가 체크합니다.' },
      { k: 'assetManager', t: 'radio', label: '보호자 부재 시 장애자녀의 재산관리 주체는 누구인가요?', opts: ['장애자녀', '비장애형제', '친인척', '지인', '금융기관', '기타'], other: true, wide: true },
      { k: 'assetHelp', t: 'checks', label: '장애자녀의 재산관리를 위해 필요한 도움은 무엇인가요?', opts: ['영역별 활동에 따른 필요비용 설계', '신탁제도 정보 제공 및 활용 방법 지원', '후견제도 정보 제공 및 활용 방법 지원', '안전한 재산관리를 위한 방법 지원', '재산상속 정보 제공', '기타'], other: true, wide: true },
      { t: 'sub', label: '○ 재산과 수입현황 파악' },
      { k: 'assets', t: 'amounts', label: '재산과 수입현황', note: true, sections: [
        { name: '재산', groups: [
          { name: '보유 유동자산', items: ['현금', '예금', '연금, 보험', '유가증권'] },
          { name: '보유 고정자산', items: ['부동산'] },
          { name: '부채', items: ['은행대출(-)', '기타(-)'] } ] },
        { name: '수입', groups: [
          { name: '정기 소득', items: ['근로소득', '부동산소득', '장애연금/수당', '개인연금'] },
          { name: '비정기 소득', items: ['결연후원', '정부지원금', '장애연금/수당', '기타'] } ] },
      ] },
      { k: 'insurance', t: 'grid', label: '보험', corner: '보험유형', rowLabels: ['의료', '상해', '연금', '기타'], cols: [{ k: 'cover', label: '보험 보장 내용' }, { k: 'amount', label: '보장 금액' }] },
      { t: 'sub', label: '○ 지출현황 파악 (장애인의 수입으로 지출하는 경우)' },
      { k: 'expensePerson', t: 'amounts', label: '지출현황 (장애인의 수입)', sections: [
        { name: '지출', groups: [
          { name: '정기지출', items: ['주거생활비(월세, 각종공과금 등)', '식비(주식, 간식, 기호품 등)', '외식비(가족, 기타)', '교통비(대중교통, 차량유지비 등)', '통신비(구입비, 인터넷·핸드폰 월정액 등)', '교육비(학원비, 교재비 등)', '용돈(부모님, 자녀 등)', '각종 할부금(자동차구입 등)', '저축(적금, 주식형, 연금 등)', '금융비용(신용대출, 마이너스통장, 대출이자 등)', '의료비(병원비, 약값, 건강식품 등)', '보험비(생명보험, 손해보험, 공공보험 등)', '기타'] },
          { name: '비정기지출', items: ['경조사비(돌잔치, 결혼, 생신 등)', '의류(신발)비(구입, 세탁비 등)', '문화여가비(취미, 스포츠, 영화관람, 여행 등)', '의료비(진료비, 의약품 및 건강식품구입비)', '의료기구(구입비, 수리비 등)', '생활용품비(구입비, 수리비, 가구/가전 등)', '이미용비(파마, 염색 등)', '기타'] } ] },
      ] },
      { t: 'sub', label: '○ 지출현황 파악 (가구의 수입으로 지출하는 경우)' },
      { k: 'expenseHouse', t: 'amounts', label: '지출현황 (가구의 수입)', ratio: true, sections: [
        { name: '지출', groups: [
          { name: '정기지출', items: ['공공요금(임대료, 월세, 관리비 등)', '생활용품비(샴푸, 세제 등)', '생활비(주/부식, 간식 등)', '교통비(대중교통 등)', '통신비(인터넷, 핸드폰 요금 등)', '교육비(학원비, 치료비 등)', '저축(적금, 예금, 주택청약 등)', '금융비용(대출원금, 대출이자 등)', '의료비(병원비, 약값, 건강기능식품 등)', '보험비(생명보험, 손해보험 등)', '용돈(부모님, 자녀 등)', '각종 할부금(자동차 구입 등)', '기타'] },
          { name: '비정기지출', items: ['경조사비(결혼, 조문 등)', '의류비(의료, 신발 구입비 등)', '문화여가비(여행 등)', '이미용비(파마, 염색 등)', '의료비(의료기구 구입비 및 수리비 등)', '생활비(생활용품 구입비 및 수리비 등)', '기타'] } ] },
      ] },
    ],
  };

  /* ---------- 서식 2: 미래설계 실천계획서 ---------- */
  const actionPlan = {
    key: 'actionPlan',
    title: '미래설계 실천계획서',
    yearly: true,
    stepHint: 'shortPlan',
    fields: [
      { k: 'year', t: 'number', label: '해당연도', required: true, min: 2000, max: 2100 },
      { k: 'writtenAt', t: 'date', label: '작성일', required: true },
      { k: 'dream', t: 'textarea', label: '꿈과 희망', wide: true },
      { k: 'longGoal', t: 'textarea', label: '중장기목표', wide: true },
      { k: 'important', t: 'textarea', label: '내가 중요하게 생각하는 것' },
      { k: 'needs', t: 'textarea', label: '나에게 필요한 것' },
      { k: 'success', t: 'textarea', label: '성공경험', wide: true },
      { k: 'plans', t: 'table', label: '영역별 단기목표 및 실천계획', minRows: 3, required: true, cols: [
        { k: 'area', label: '영역', type: 'select', opts: PPP.DOMAINS }, { k: 'goal', label: '단기목표', type: 'textarea' },
        { k: 'plan', label: '실천계획', type: 'textarea' }, { k: 'note', label: '비고' } ] },
    ],
  };

  /* ---------- 서식 3: 행복한 미래 이야기 (연간 돌아보기·실천과정 평가) ---------- */
  const yearStory = {
    key: 'yearStory',
    title: '행복한 미래 이야기',
    yearly: true,
    stepHint: 'annualEval',
    fields: [
      { k: 'year', t: 'number', label: '작성연도 (새해)', required: true, min: 2000, max: 2100, hint: '예) 2025 입력 시 「2024년 돌아보기」, 「2025년 달라진 정보 확인하기」로 표시' },
      { k: 'writtenAt', t: 'date', label: '작성일', required: true },
      { t: 'part', label: '【 {prev}년 돌아보기 】' },
      { k: 'dream', t: 'textarea', label: '나의 꿈', wide: true },
      { k: 'longGoal', t: 'textarea', label: '중장기 목표', wide: true },
      { k: 'plans', t: 'table', label: '미래설계 실천계획', minRows: 2, cols: [{ k: 'area', label: '영역', type: 'select', opts: PPP.DOMAINS }, { k: 'goal', label: '단기목표', type: 'textarea' }, { k: 'plan', label: '활동계획', type: 'textarea' }] },
      { k: 'storyText', t: 'textarea', label: '미래설계 실천 이야기 (변화, 어려움 등)', wide: true },
      { k: 'happyMoments', t: 'textarea', label: '나에게 행복했던 순간들 (사진 등)', hint: '사진은 앱에 저장하지 않습니다.', wide: true },
      { k: 'score', t: 'number', label: '점수로 평가하기', unit: '점 (0~10)', min: 0, max: 10 },
      { k: 'scoreNote', t: 'textarea', label: '점수 이유' },
      { t: 'part', label: '【 {year}년 달라진 정보 확인하기 】' },
      { k: 'changed', t: 'checks', label: '달라진 정보', opts: ['나의 꿈', '나의 강점', '나를 힘나게/힘들게 하는 것', '나와 함께 하고 있는 사람들', '나의 건강', '나의 거주 공간(집)', '나의 하루', '보호자(가족) 지원', '기타'], other: true, wide: true },
      { k: 'nDream', t: 'textarea', label: '나의 꿈' },
      { k: 'nStrength', t: 'textarea', label: '나의 강점' },
      { k: 'nPower', t: 'textarea', label: '나를 힘나게 하는 것' },
      { k: 'nHard', t: 'textarea', label: '나를 힘들게 하는 것' },
      { k: 'nPeople', t: 'textarea', label: '나와 함께 하고 있는 사람들' },
      { k: 'nHealth', t: 'textarea', label: '나의 건강' },
      { k: 'nHouse', t: 'textarea', label: '나의 거주공간 (집)' },
      { k: 'nDay', t: 'grid', label: '나의 하루', corner: '나의 하루', rowLabels: ['활동'], cols: DAYS.map((d) => ({ k: d, label: d })) },
      { k: 'nFamily', t: 'textarea', label: '보호자 (가족) 지원' },
      { k: 'nEtc', t: 'textarea', label: '기타', wide: true },
      { t: 'part', label: '【 {year}년 행복한 삶 실천하기 】' },
      { k: 'priorities', t: 'grid', label: '우선순위', corner: '우선순위', rowLabels: ['1', '2', '3'], cols: [{ k: 'area', label: '미래설계 희망영역', type: 'select', opts: PPP.DOMAINS }, { k: 'content', label: '내용' }, { k: 'help', label: '필요한 도움' }] },
    ],
  };

  PPP.FORMS = { selfIntro, actionPlan, yearStory };
  PPP.FORM_ORDER = ['selfIntro', 'actionPlan', 'yearStory'];
})();
