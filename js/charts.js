/* SVG 차트 — 도넛(원형), 가로 막대, 세로 막대
 * 범주 색상은 고정 순서로 배정(순환 금지), 9개 이상은 '기타'로 묶는다.
 * 모든 차트는 범례(수치 포함) + '표로 보기'를 함께 제공한다(색상만으로 구분하지 않음).
 */
(function () {
  const PPP = (window.PPP = window.PPP || {});
  const esc = (v) => PPP.esc(v);
  const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  PPP.CHART_COLORS = COLORS;

  let tip;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, x, y) {
    const t = tooltip();
    t.innerHTML = html;
    t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px';
    t.style.top = Math.max(8, y - h - 10) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  // [{label, value}] → 최대 8개, 나머지는 '기타'로 합침. 0값 제거.
  function fold(items, max = 8) {
    const list = items.filter((d) => d.value > 0);
    if (list.length <= max) return list;
    const head = list.slice(0, max - 1);
    const rest = list.slice(max - 1).reduce((n, d) => n + d.value, 0);
    return head.concat([{ label: '기타(묶음)', value: rest }]);
  }

  function tableView(items, unit, title) {
    const total = items.reduce((n, d) => n + d.value, 0);
    return `<details class="chart-table"><summary>표로 보기</summary><table class="dtable"><caption class="sr-only">${esc(title)}</caption><thead><tr><th scope="col">구분</th><th scope="col">${esc(unit)}</th><th scope="col">비율</th></tr></thead><tbody>${items
      .map((d) => `<tr><th scope="row">${esc(d.label)}</th><td class="r">${d.value}</td><td class="r">${total ? Math.round((d.value / total) * 100) : 0}%</td></tr>`).join('')}</tbody></table></details>`;
  }

  /* 도넛 차트 */
  function donut(el, { title, items, unit = '명', colorMap }) {
    const data = fold(items);
    const total = data.reduce((n, d) => n + d.value, 0);
    if (!total) { el.innerHTML = `<div class="chart-empty">표시할 데이터가 없습니다.</div>`; return; }
    const size = 168, r = 72, sw = 26, cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    const gap = data.length > 1 ? 2 : 0; // 조각 사이 2px 여백
    let offset = 0;
    const color = (d, i) => (colorMap && colorMap[d.label]) || COLORS[i % COLORS.length];
    const arcs = data.map((d, i) => {
      const len = (d.value / total) * C;
      const dash = Math.max(0.01, len - gap);
      const s = `<circle class="arc" data-i="${i}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color(d, i)}" stroke-width="${sw}" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" tabindex="0" aria-label="${esc(d.label)} ${d.value}${unit} (${Math.round((d.value / total) * 100)}%)"></circle>`;
      offset += len;
      return s;
    }).join('');
    el.innerHTML = `<div class="donut-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(title)}: 총 ${total}${unit}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"></circle>${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-total">${total}</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-unit">${esc(unit)}</text>
      </svg>
      <ul class="legend">${data.map((d, i) => `<li data-i="${i}"><span class="sw" style="background:${color(d, i)}"></span><span class="lg-label">${esc(d.label)}</span><span class="lg-val">${d.value}${esc(unit)} <span class="muted">${Math.round((d.value / total) * 100)}%</span></span></li>`).join('')}</ul>
    </div>${tableView(data, unit, title)}`;
    const svg = el.querySelector('svg');
    const hl = (i) => {
      el.querySelectorAll('.arc').forEach((a) => a.classList.toggle('dim', i != null && a.dataset.i !== String(i)));
      el.querySelectorAll('.legend li').forEach((l) => l.classList.toggle('on', l.dataset.i === String(i)));
    };
    const tipHtml = (i) => { const d = data[i]; return `<strong>${esc(d.label)}</strong><br>${d.value}${esc(unit)} · ${Math.round((d.value / total) * 100)}%`; };
    svg.addEventListener('mousemove', (e) => {
      const a = e.target.closest('.arc');
      if (!a) { hl(null); hideTip(); return; }
      hl(a.dataset.i); showTip(tipHtml(a.dataset.i), e.clientX, e.clientY);
    });
    svg.addEventListener('mouseleave', () => { hl(null); hideTip(); });
    svg.addEventListener('focusin', (e) => { const a = e.target.closest('.arc'); if (a) { const b = a.getBoundingClientRect(); hl(a.dataset.i); showTip(tipHtml(a.dataset.i), b.right, b.top + 20); } });
    svg.addEventListener('focusout', () => { hl(null); hideTip(); });
    el.querySelectorAll('.legend li').forEach((li) => {
      li.addEventListener('mouseenter', () => hl(li.dataset.i));
      li.addEventListener('mouseleave', () => hl(null));
    });
  }

  /* 가로 막대 (단일 계열 — 범례 없이 제목이 계열을 설명) */
  function hbar(el, { title, items, unit = '명', max }) {
    if (!items.length) { el.innerHTML = `<div class="chart-empty">표시할 데이터가 없습니다.</div>`; return; }
    const m = max || Math.max(1, ...items.map((d) => d.value));
    el.innerHTML = `<div class="hbar" role="img" aria-label="${esc(title)}">${items.map((d, i) => `
      <div class="hbar-row" data-i="${i}">
        <div class="hbar-label" title="${esc(d.label)}">${esc(d.label)}${d.sub ? `<span class="muted"> · ${esc(d.sub)}</span>` : ''}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${(d.value / m) * 100}%;${d.color ? `background:${d.color}` : ''}"></div></div>
        <div class="hbar-val">${d.value}${esc(unit)}</div>
      </div>`).join('')}</div>${tableView(items, unit, title)}`;
    el.querySelectorAll('.hbar-row').forEach((row) => {
      row.addEventListener('mousemove', (e) => { const d = items[row.dataset.i]; showTip(`<strong>${esc(d.label)}</strong><br>${d.value}${esc(unit)}${max ? ` / ${max}${esc(unit)}` : ''}`, e.clientX, e.clientY); });
      row.addEventListener('mouseleave', hideTip);
    });
  }

  /* 세로 막대 (월별 추이 등 단일 계열) */
  function columns(el, { title, items, unit = '건' }) {
    const total = items.reduce((n, d) => n + d.value, 0);
    if (!total) { el.innerHTML = `<div class="chart-empty">표시할 데이터가 없습니다.</div>`; return; }
    const W = 520, H = 200, padL = 32, padB = 26, padT = 18;
    const m = Math.max(1, ...items.map((d) => d.value));
    const niceMax = Math.ceil(m / 5) * 5 || 5;
    const bw = Math.min(24, ((W - padL) / items.length) * 0.5);
    const step = (W - padL) / items.length;
    const y = (v) => H - padB - (v / niceMax) * (H - padB - padT);
    let grid = '';
    for (let t = 0; t <= niceMax; t += niceMax / 5) grid += `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="gridline"></line><text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${t}</text>`;
    const bars = items.map((d, i) => {
      const x = padL + step * i + (step - bw) / 2;
      const top = y(d.value), h = H - padB - top;
      const r = Math.min(4, h);
      const path = h > 0 ? `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z` : '';
      return `<g class="col" data-i="${i}"><rect x="${padL + step * i}" y="${padT}" width="${step}" height="${H - padB - padT}" fill="transparent"></rect>${path ? `<path d="${path}" fill="${COLORS[0]}"></path>` : ''}
        ${d.value ? `<text x="${x + bw / 2}" y="${top - 5}" text-anchor="middle" class="val">${d.value}</text>` : ''}
        <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis">${esc(d.label)}</text></g>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="colchart" role="img" aria-label="${esc(title)}">${grid}<line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" class="baseline"></line>${bars}</svg>${tableView(items, unit, title)}`;
    el.querySelectorAll('.col').forEach((g) => {
      g.addEventListener('mousemove', (e) => { const d = items[g.dataset.i]; showTip(`<strong>${esc(d.full || d.label)}</strong><br>${d.value}${esc(unit)}`, e.clientX, e.clientY); });
      g.addEventListener('mouseleave', hideTip);
    });
  }

  PPP.charts = { donut, hbar, columns, hideTip };
})();
