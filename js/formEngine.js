/* 서식 렌더링 엔진 — 하나의 스키마로 입력 화면(edit)과 출력 화면(print)을 함께 만든다 */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const esc = (v) => PPP.esc(v);
  const fid = (k) => `f_${k}`;

  const titleVars = (label, data) => {
    const y = Number(data.year) || new Date().getFullYear();
    return label.replace('{prev}', y - 1).replace('{year}', y);
  };

  /* ============ 입력 화면 ============ */
  function renderEdit(form, data, opts = {}) {
    let html = '';
    let groupOpen = false;
    const open = () => { if (!groupOpen) { html += '<div class="fgrid">'; groupOpen = true; } };
    const close = () => { if (groupOpen) { html += '</div>'; groupOpen = false; } };
    if (form.intro) html += `<p class="form-intro">${esc(form.intro)}</p>`;
    form.fields.forEach((f) => {
      if (f.t === 'part') { close(); html += `<h3 class="f-part">${esc(titleVars(f.label, data))}</h3>`; return; }
      if (f.t === 'domain') { close(); html += `<div class="f-domain"><span class="f-domain-name">${esc(f.label)}</span><span class="f-domain-sub">${esc(f.sub || '')}</span></div>`; return; }
      if (f.t === 'sub') { close(); html += `<h4 class="f-sub">${esc(f.label)}</h4>`; return; }
      if (f.t === 'note') { close(); html += `<p class="f-note">${esc(f.label)}</p>`; return; }
      if (['table', 'grid', 'matrix', 'compare', 'amounts'].includes(f.t)) { close(); html += `<fieldset class="f-block" data-key="${f.k}"><legend>${esc(f.label)}</legend>${complexEdit(f, data[f.k], opts)}</fieldset>`; return; }
      open();
      html += `<div class="field ${f.wide || f.t === 'checks' ? 'wide' : ''}" data-key="${f.k}">${simpleEdit(f, data, opts)}</div>`;
    });
    close();
    return html;
  }

  function labelHtml(f, forId) {
    return `<label class="flabel" ${forId ? `for="${forId}"` : ''}>${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span>' : ''}${f.sensitive ? ' <span class="badge badge-sens" title="민감정보">민감</span>' : ''}</label>`;
  }

  function simpleEdit(f, data, opts) {
    const v = data[f.k];
    const id = fid(f.k);
    const hint = f.hint ? `<p class="fhint" id="${id}_hint">${esc(f.hint)}</p>` : '';
    const desc = f.hint ? ` aria-describedby="${id}_hint"` : '';
    const req = f.required ? ' required aria-required="true"' : '';
    const sens = f.sensitive && opts.anonymous && v ? ' data-masked="1"' : '';
    switch (f.t) {
      case 'text':
        return labelHtml(f, id) + `<input type="text" id="${id}" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" maxlength="500"${req}${desc}${sens}>` + hint;
      case 'number':
        return labelHtml(f, id) + `<div class="with-unit"><input type="number" id="${id}" name="${f.k}" value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="any"${req}${desc}>${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}</div>` + hint;
      case 'date':
        return labelHtml(f, id) + `<input type="date" id="${id}" name="${f.k}" value="${esc(v)}"${req}${desc}>` + hint;
      case 'textarea':
        return labelHtml(f, id) + `<textarea id="${id}" name="${f.k}" rows="3" maxlength="5000"${req}${desc}>${esc(v)}</textarea>` + hint;
      case 'select':
        return labelHtml(f, id) + `<select id="${id}" name="${f.k}"${req}><option value="">선택</option>${f.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` + hint;
      case 'radio':
      case 'checks': {
        const type = f.t === 'radio' ? 'radio' : 'checkbox';
        const values = f.t === 'radio' ? [v] : Array.isArray(v) ? v : [];
        const items = f.opts.map((o, i) => `<label class="opt"><input type="${type}" name="${f.k}" value="${esc(o)}" ${values.includes(o) ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('');
        const other = f.other ? `<input type="text" class="other-input" name="${f.k}_other" aria-label="${esc(f.label)} 기타 내용" placeholder="기타 내용" value="${esc(data[f.k + '_other'])}" maxlength="300">` : '';
        const clear = f.t === 'radio' ? `<button type="button" class="link-btn" data-clear-radio="${f.k}">선택 해제</button>` : '';
        return `<fieldset class="optgroup"><legend class="flabel">${esc(f.label)}</legend><div class="opts">${items}${clear}</div>${other}</fieldset>` + hint;
      }
    }
    return '';
  }

  function cellInput(col, name, value, ariaLabel) {
    const a = ` aria-label="${esc(ariaLabel)}"`;
    if (col.type === 'check') return `<input type="checkbox" name="${name}" ${value ? 'checked' : ''}${a}>`;
    if (col.type === 'select') return `<select name="${name}"${a}><option value="">선택</option>${col.opts.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (col.type === 'textarea') return `<textarea name="${name}" rows="2" maxlength="2000"${a}>${esc(value)}</textarea>`;
    return `<input type="text" name="${name}" value="${esc(value)}" maxlength="500"${a}>`;
  }

  function complexEdit(f, v, opts) {
    if (f.t === 'table') {
      const rows = Array.isArray(v) && v.length ? v : [];
      const n = Math.max(rows.length, f.minRows || 1);
      let body = '';
      for (let i = 0; i < n; i++) body += tableRow(f, rows[i] || {}, i);
      return `<div class="table-wrap"><table class="ftable" data-table="${f.k}"><thead><tr><th scope="col" class="num">#</th>${f.cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}<th scope="col"><span class="sr-only">행 삭제</span></th></tr></thead><tbody>${body}</tbody></table></div>
        <button type="button" class="btn btn-sm" data-add-row="${f.k}">+ 행 추가</button>`;
    }
    if (f.t === 'grid') {
      const rows = Array.isArray(v) ? v : [];
      return `<div class="table-wrap"><table class="ftable"><thead><tr><th scope="col">${esc(f.corner || '구분')}</th>${f.cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${f.rowLabels
        .map((rl, i) => `<tr><th scope="row">${esc(rl)}</th>${f.cols.map((c) => `<td>${cellInput(c, `${f.k}__${i}__${c.k}`, (rows[i] || {})[c.k], `${rl} ${c.label}`)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`;
    }
    if (f.t === 'matrix') {
      const val = v || {};
      let body = '';
      f.groups.forEach((g, gi) => {
        body += `<tr class="grp"><th scope="rowgroup" colspan="${f.scale.length + 1}">${esc(g.name)}</th></tr>`;
        g.items.forEach((it, ii) => {
          const key = `${gi}_${ii}`;
          body += `<tr><th scope="row" class="item">${esc(it)}</th>${f.scale.map((s, si) => `<td class="c"><input type="radio" name="${f.k}__${key}" value="${si}" ${val[key] === si ? 'checked' : ''} aria-label="${esc(it)}: ${esc(s)}"></td>`).join('')}</tr>`;
        });
      });
      return `<p class="fhint">스스로 할 수 있나요? 해당 칸을 선택하세요. (같은 칸을 다시 누르면 해제)</p><div class="table-wrap"><table class="ftable matrix"><thead><tr><th scope="col">${esc(f.label)}</th>${f.scale.map((s) => `<th scope="col" class="c">${esc(s)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    if (f.t === 'compare') {
      const val = v || {};
      const body = f.rows.map((r) => {
        const rv = val[r.k] || {};
        const cell = (which, options) => {
          const name = `${f.k}__${r.k}__${which}`;
          if (r.kind === 'text') return `<input type="text" name="${name}" value="${esc(rv[which])}" aria-label="${esc(r.label)} ${which === 'now' ? '현재' : '미래'}" maxlength="300">`;
          const type = r.kind === 'radio' ? 'radio' : 'checkbox';
          const cur = r.kind === 'radio' ? [rv[which]] : Array.isArray(rv[which]) ? rv[which] : [];
          return `<div class="opts opts-col">${options.map((o) => `<label class="opt"><input type="${type}" name="${name}" value="${esc(o)}" ${cur.includes(o) ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('')}</div>` +
            (r.detail || options.includes('기타') ? `<input type="text" name="${name}_detail" value="${esc(rv[which + '_detail'])}" placeholder="세부 내용 (지역, 기타 등)" aria-label="${esc(r.label)} 세부 내용" maxlength="300">` : '');
        };
        return `<tr><th scope="row">${esc(r.label)}</th><td>${cell('now', r.opts || [])}</td><td>${cell('future', r.optsFuture || r.opts || [])}</td><td><textarea name="${f.k}__${r.k}__reason" rows="2" aria-label="${esc(r.label)} 이유" maxlength="1000">${esc(rv.reason)}</textarea></td></tr>`;
      }).join('');
      return `<div class="table-wrap"><table class="ftable compare"><thead><tr><th scope="col">구분</th><th scope="col">현재</th><th scope="col">미래</th><th scope="col">이유</th></tr></thead><tbody>${body}</tbody></table></div>`;
    }
    if (f.t === 'amounts') {
      const val = v || {};
      let body = '';
      f.sections.forEach((s, si) => {
        s.groups.forEach((g, gi) => {
          g.items.forEach((it, ii) => {
            const key = `${si}_${gi}_${ii}`;
            const rv = val[key] || {};
            body += `<tr>${ii === 0 && gi === 0 ? `<th scope="rowgroup" rowspan="${s.groups.reduce((n, x) => n + x.items.length, 0) + 1}" class="vhead">${esc(s.name)}</th>` : ''}${ii === 0 ? `<th scope="rowgroup" rowspan="${g.items.length}" class="ghead">${esc(g.name)}</th>` : ''}<th scope="row" class="item">${esc(it)}</th>
              ${f.note ? `<td><input type="text" name="${f.k}__${key}__note" value="${esc(rv.note)}" aria-label="${esc(it)} 내용" maxlength="300"></td>` : ''}
              <td><input type="number" min="0" step="1" class="amount" data-amount="${f.k}" data-sec="${si}" data-neg="${it.includes('(-)') ? 1 : 0}" name="${f.k}__${key}__amount" value="${esc(rv.amount)}" aria-label="${esc(it)} 월 평균 금액(원)"></td>
              ${f.ratio ? `<td><select name="${f.k}__${key}__ratio" aria-label="${esc(it)} 장애인 지출 비율(5점 만점)"><option value=""></option>${[1, 2, 3, 4, 5].map((n) => `<option ${String(n) === String(rv.ratio) ? 'selected' : ''}>${n}</option>`).join('')}</select></td>` : ''}</tr>`;
          });
        });
        body += `<tr class="total"><th scope="row" colspan="2">총 계</th>${f.note ? '<td></td>' : ''}<td><output data-total="${f.k}" data-sec="${si}">${fmtWon(sectionTotal(f, val, si))}</output></td>${f.ratio ? '<td></td>' : ''}</tr>`;
      });
      return `<div class="table-wrap"><table class="ftable amounts"><thead><tr><th scope="col" colspan="3">항목</th>${f.note ? '<th scope="col">내용</th>' : ''}<th scope="col">월 평균 금액(원)</th>${f.ratio ? '<th scope="col">장애인 지출 비율(5점 만점)</th>' : ''}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    return '';
  }

  function tableRow(f, row, i) {
    return `<tr><td class="num">${i + 1}</td>${f.cols.map((c) => `<td>${cellInput(c, `${f.k}__${i}__${c.k}`, row[c.k], `${i + 1}행 ${c.label}`)}</td>`).join('')}<td><button type="button" class="icon-btn" data-del-row="${f.k}" aria-label="${i + 1}행 삭제" title="행 삭제">✕</button></td></tr>`;
  }

  const fmtWon = (n) => (n ? n.toLocaleString('ko-KR') + '원' : '0원');
  function sectionTotal(f, val, si) {
    let t = 0;
    f.sections[si].groups.forEach((g, gi) => g.items.forEach((it, ii) => {
      const a = Number((val[`${si}_${gi}_${ii}`] || {}).amount) || 0;
      t += it.includes('(-)') ? -a : a;
    }));
    return t;
  }

  /* 입력 화면 동작 연결 (행 추가/삭제, 라디오 해제, 합계 계산) */
  function bindEdit(root, form) {
    root.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add-row]');
      if (add) {
        const f = form.fields.find((x) => x.k === add.dataset.addRow);
        const tbody = root.querySelector(`table[data-table="${f.k}"] tbody`);
        const i = tbody.rows.length;
        if (i >= 50) { PPP.toast('행은 최대 50개까지 추가할 수 있습니다.', 'warn'); return; }
        tbody.insertAdjacentHTML('beforeend', tableRow(f, {}, i));
        tbody.rows[i].querySelector('input,select,textarea').focus();
        return;
      }
      const del = e.target.closest('[data-del-row]');
      if (del) {
        const f = form.fields.find((x) => x.k === del.dataset.delRow);
        const tr = del.closest('tr');
        const tbody = tr.parentNode;
        const data = collectTable(root, f).filter((_, idx) => idx !== tr.sectionRowIndex);
        const n = Math.max(data.length, f.minRows || 1);
        let html = '';
        for (let i = 0; i < n; i++) html += tableRow(f, data[i] || {}, i);
        tbody.innerHTML = html;
        root.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      const clr = e.target.closest('[data-clear-radio]');
      if (clr) {
        root.querySelectorAll(`input[name="${clr.dataset.clearRadio}"]`).forEach((r) => (r.checked = false));
        root.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    // 매트릭스 라디오: 같은 칸 다시 누르면 해제
    root.addEventListener('mousedown', (e) => {
      const r = e.target.closest('table.matrix input[type=radio]');
      if (r) r.dataset.was = r.checked ? '1' : '';
    });
    root.addEventListener('click', (e) => {
      const r = e.target.closest('table.matrix input[type=radio]');
      if (r && r.dataset.was === '1') { r.checked = false; r.dataset.was = ''; }
    });
    root.addEventListener('input', (e) => {
      const a = e.target.closest('input.amount');
      if (!a) return;
      const k = a.dataset.amount, sec = a.dataset.sec;
      let t = 0;
      root.querySelectorAll(`input.amount[data-amount="${k}"][data-sec="${sec}"]`).forEach((x) => { const n = Number(x.value) || 0; t += x.dataset.neg === '1' ? -n : n; });
      const out = root.querySelector(`output[data-total="${k}"][data-sec="${sec}"]`);
      if (out) out.textContent = fmtWon(t);
    });
  }

  function collectTable(root, f) {
    const rows = [];
    const tbody = root.querySelector(`table[data-table="${f.k}"] tbody`);
    if (!tbody) return rows;
    Array.from(tbody.rows).forEach((tr, i) => {
      const row = {};
      f.cols.forEach((c) => {
        const el = tr.querySelector(`[name="${f.k}__${i}__${c.k}"]`);
        if (el) row[c.k] = c.type === 'check' ? el.checked : el.value.trim();
      });
      rows.push(row);
    });
    return rows;
  }

  /* 입력값 수집 */
  function collect(root, form) {
    const data = {};
    const q = (name) => root.querySelector(`[name="${CSS.escape(name)}"]`);
    const qa = (name) => Array.from(root.querySelectorAll(`[name="${CSS.escape(name)}"]`));
    form.fields.forEach((f) => {
      if (!f.k) return;
      switch (f.t) {
        case 'text': case 'textarea': case 'date': case 'select': case 'number': {
          const el = q(f.k);
          if (el) data[f.k] = el.value.trim();
          break;
        }
        case 'radio': {
          const el = qa(f.k).find((x) => x.checked);
          data[f.k] = el ? el.value : '';
          if (f.other) data[f.k + '_other'] = (q(f.k + '_other') || {}).value || '';
          break;
        }
        case 'checks':
          data[f.k] = qa(f.k).filter((x) => x.checked).map((x) => x.value);
          if (f.other) data[f.k + '_other'] = ((q(f.k + '_other') || {}).value || '').trim();
          break;
        case 'table':
          data[f.k] = collectTable(root, f).filter((r) => Object.values(r).some((x) => x !== '' && x !== false));
          break;
        case 'grid':
          data[f.k] = f.rowLabels.map((_, i) => {
            const row = {};
            f.cols.forEach((c) => { const el = q(`${f.k}__${i}__${c.k}`); if (el) row[c.k] = c.type === 'check' ? el.checked : el.value.trim(); });
            return row;
          });
          break;
        case 'matrix': {
          const val = {};
          f.groups.forEach((g, gi) => g.items.forEach((_, ii) => {
            const key = `${gi}_${ii}`;
            const el = qa(`${f.k}__${key}`).find((x) => x.checked);
            if (el) val[key] = Number(el.value);
          }));
          data[f.k] = val;
          break;
        }
        case 'compare': {
          const val = {};
          f.rows.forEach((r) => {
            const rv = {};
            ['now', 'future'].forEach((w) => {
              const name = `${f.k}__${r.k}__${w}`;
              if (r.kind === 'text') rv[w] = ((q(name) || {}).value || '').trim();
              else if (r.kind === 'radio') { const el = qa(name).find((x) => x.checked); rv[w] = el ? el.value : ''; }
              else rv[w] = qa(name).filter((x) => x.checked).map((x) => x.value);
              const d = q(name + '_detail');
              if (d) rv[w + '_detail'] = d.value.trim();
            });
            rv.reason = ((q(`${f.k}__${r.k}__reason`) || {}).value || '').trim();
            val[r.k] = rv;
          });
          data[f.k] = val;
          break;
        }
        case 'amounts': {
          const val = {};
          f.sections.forEach((s, si) => s.groups.forEach((g, gi) => g.items.forEach((_, ii) => {
            const key = `${si}_${gi}_${ii}`;
            const rv = {};
            ['amount', 'note', 'ratio'].forEach((c) => { const el = q(`${f.k}__${key}__${c}`); if (el && el.value !== '') rv[c] = el.value.trim(); });
            if (Object.keys(rv).length) val[key] = rv;
          })));
          data[f.k] = val;
          break;
        }
      }
    });
    return data;
  }

  /* 검증 — [{key, message}] */
  function validate(form, data) {
    const errors = [];
    form.fields.forEach((f) => {
      if (!f.k) return;
      const v = data[f.k];
      if (f.required) {
        const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
        if (empty) { errors.push({ key: f.k, message: `${f.label}을(를) 입력하세요.` }); return; }
      }
      if (f.t === 'date' && v && !PPP.isValidDate(v)) errors.push({ key: f.k, message: `${f.label}: 날짜 형식(YYYY-MM-DD)이 올바르지 않습니다.` });
      if (f.t === 'number' && v !== '' && v != null) {
        const n = Number(v);
        if (isNaN(n)) errors.push({ key: f.k, message: `${f.label}: 숫자만 입력하세요.` });
        else if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) errors.push({ key: f.k, message: `${f.label}: ${f.min}~${f.max} 사이 값을 입력하세요.` });
        else if (f.min == null && n < 0) errors.push({ key: f.k, message: `${f.label}: 0 이상의 값을 입력하세요.` });
      }
      if (f.t === 'amounts' && v) {
        if (Object.values(v).some((r) => r.amount != null && (isNaN(Number(r.amount)) || Number(r.amount) < 0))) errors.push({ key: f.k, message: `${f.label}: 금액은 0 이상의 숫자로 입력하세요.` });
      }
    });
    return errors;
  }

  /* ============ 출력(인쇄) 화면 ============ */
  function renderPrint(form, data, opts = {}) {
    const anon = opts.anonymous;
    const show = (f, v) => (f.sensitive && anon && v ? PPP.maskText(v) : v);
    let html = '';
    let kv = [];
    const flush = () => {
      if (!kv.length) return;
      html += `<table class="ptable kv"><tbody>${kv.map((r) => `<tr><th>${esc(r[0])}</th><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
      kv = [];
    };
    const box = (on) => (on ? '■' : '□');
    const nl = (s) => esc(s).replace(/\n/g, '<br>');

    form.fields.forEach((f) => {
      if (f.t === 'part') { flush(); html += `<h3 class="p-part">${esc(titleVars(f.label, data))}</h3>`; return; }
      if (f.t === 'domain') { flush(); html += `<table class="ptable p-domain"><tr><th>${esc(f.label)}</th><td>${esc(f.sub || '')}</td></tr></table>`; return; }
      if (f.t === 'sub') { flush(); html += `<h4 class="p-sub">${esc(f.label)}</h4>`; return; }
      if (f.t === 'note') { flush(); html += `<p class="p-note">${esc(f.label)}</p>`; return; }
      const v = data[f.k];
      switch (f.t) {
        case 'text': case 'textarea': case 'date': case 'select':
          kv.push([f.label, nl(show(f, v))]); return;
        case 'number':
          kv.push([f.label, v !== '' && v != null ? `${esc(v)} ${esc(f.unit || '')}` : '']); return;
        case 'radio': case 'checks': {
          const vals = f.t === 'radio' ? [v] : Array.isArray(v) ? v : [];
          const other = data[f.k + '_other'];
          kv.push([f.label, f.opts.map((o) => `<span class="pchk">${box(vals.includes(o))} ${esc(o)}${o === '기타' && other ? ` (${esc(other)})` : ''}</span>`).join(' ')]);
          return;
        }
      }
      flush();
      html += `<div class="p-block"><div class="p-block-title">${esc(f.label)}</div>${complexPrint(f, v, anon)}</div>`;
    });
    flush();
    return html;
  }

  function complexPrint(f, v, anon) {
    const box = (on) => (on ? '■' : '□');
    const cellVal = (c, val) => (c.type === 'check' ? box(val) : c.sensitive && anon && val ? PPP.maskText(val) : PPP.esc(val).replace(/\n/g, '<br>'));
    if (f.t === 'table') {
      const rows = Array.isArray(v) && v.length ? v : [];
      const n = Math.max(rows.length, f.minRows || 1);
      let body = '';
      for (let i = 0; i < n; i++) body += `<tr>${f.cols.map((c) => `<td>${cellVal(c, (rows[i] || {})[c.k])}</td>`).join('')}</tr>`;
      return `<table class="ptable"><thead><tr>${f.cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    }
    if (f.t === 'grid') {
      const rows = Array.isArray(v) ? v : [];
      return `<table class="ptable"><thead><tr><th>${esc(f.corner || '구분')}</th>${f.cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${f.rowLabels
        .map((rl, i) => `<tr><th>${esc(rl)}</th>${f.cols.map((c) => `<td>${cellVal(c, (rows[i] || {})[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (f.t === 'matrix') {
      const val = v || {};
      let body = '';
      f.groups.forEach((g, gi) => {
        body += `<tr class="grp"><th colspan="${f.scale.length + 1}">${esc(g.name)}</th></tr>`;
        g.items.forEach((it, ii) => { body += `<tr><td class="item">${esc(it)}</td>${f.scale.map((_, si) => `<td class="c">${val[`${gi}_${ii}`] === si ? '●' : ''}</td>`).join('')}</tr>`; });
      });
      return `<table class="ptable matrix"><thead><tr><th>${esc(f.label)}</th>${f.scale.map((s) => `<th class="c">${esc(s)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    }
    if (f.t === 'compare') {
      const val = v || {};
      const cell = (r, rv, w, options) => {
        if (r.kind === 'text') return esc(rv[w]);
        const cur = r.kind === 'radio' ? [rv[w]] : Array.isArray(rv[w]) ? rv[w] : [];
        return options.map((o) => `<span class="pchk">${box(cur.includes(o))} ${esc(o)}</span>`).join('<br>') + (rv[w + '_detail'] ? `<br>(${esc(rv[w + '_detail'])})` : '');
      };
      return `<table class="ptable compare"><thead><tr><th>구분</th><th>현재</th><th>미래</th><th>이유</th></tr></thead><tbody>${f.rows.map((r) => {
        const rv = val[r.k] || {};
        return `<tr><th>${esc(r.label)}</th><td>${cell(r, rv, 'now', r.opts || [])}</td><td>${cell(r, rv, 'future', r.optsFuture || r.opts || [])}</td><td>${esc(rv.reason)}</td></tr>`;
      }).join('')}</tbody></table>`;
    }
    if (f.t === 'amounts') {
      const val = v || {};
      let body = '';
      f.sections.forEach((s, si) => {
        s.groups.forEach((g, gi) => g.items.forEach((it, ii) => {
          const rv = val[`${si}_${gi}_${ii}`] || {};
          body += `<tr>${ii === 0 && gi === 0 ? `<th rowspan="${s.groups.reduce((n, x) => n + x.items.length, 0) + 1}">${esc(s.name)}</th>` : ''}${ii === 0 ? `<th rowspan="${g.items.length}">${esc(g.name)}</th>` : ''}<td class="item">${esc(it)}</td>${f.note ? `<td>${esc(rv.note)}</td>` : ''}<td class="r">${rv.amount ? Number(rv.amount).toLocaleString('ko-KR') : ''}</td>${f.ratio ? `<td class="c">${esc(rv.ratio)}</td>` : ''}</tr>`;
        }));
        body += `<tr class="total"><th colspan="2">총 계</th>${f.note ? '<td></td>' : ''}<td class="r">${sectionTotal(f, val, si).toLocaleString('ko-KR')}</td>${f.ratio ? '<td></td>' : ''}</tr>`;
      });
      return `<table class="ptable amounts"><thead><tr><th colspan="3">항목</th>${f.note ? '<th>내용</th>' : ''}<th>월 평균 금액(원)</th>${f.ratio ? '<th>장애인 지출 비율(5점 만점)</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
    }
    return '';
  }

  /* 서식 작성률 (값이 들어간 입력 항목 비율) */
  function completion(form, data) {
    const inputs = form.fields.filter((f) => f.k);
    const filled = inputs.filter((f) => {
      const v = data[f.k];
      if (v == null || v === '') return false;
      if (Array.isArray(v)) return v.some((x) => (typeof x === 'object' ? Object.values(x || {}).some((y) => y !== '' && y !== false) : x));
      if (typeof v === 'object') return Object.keys(v).length > 0 && Object.values(v).some((x) => (typeof x === 'object' ? Object.values(x).some((y) => (Array.isArray(y) ? y.length : y !== '' && y != null)) : true));
      return true;
    }).length;
    return Math.round((filled / inputs.length) * 100);
  }

  PPP.formEngine = { renderEdit, bindEdit, collect, validate, renderPrint, completion, titleVars };
})();
