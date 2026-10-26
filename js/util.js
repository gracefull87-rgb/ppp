/* 공통 유틸리티 */
(function () {
  const PPP = (window.PPP = window.PPP || {});

  const esc = (v) =>
    String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const pad = (n) => String(n).padStart(2, '0');
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '');
  const fmtDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

  // 이름 마스킹: 홍길동 → 홍*동, 김수 → 김*
  const maskName = (name) => {
    const s = String(name || '').trim();
    if (!s) return '';
    if (s.length === 1) return '*';
    if (s.length === 2) return s[0] + '*';
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
  };
  const maskText = (s) => (s ? '●●●' : '');

  const ageFromYear = (y) => (y ? new Date().getFullYear() - Number(y) : null);
  const ageBand = (y) => {
    const a = ageFromYear(y);
    if (a == null || isNaN(a)) return '미입력';
    if (a < 20) return '10대 이하';
    if (a < 30) return '20대';
    if (a < 40) return '30대';
    if (a < 50) return '40대';
    return '50대 이상';
  };

  // 간단 해시 (백업 무결성 확인용, 보안 목적 아님)
  const hash = (str) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  };

  const download = (filename, content, mime) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* 토스트 (aria-live) */
  const toast = (msg, type = 'ok') => {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 7000 : 3500);
  };

  /* 모달 확인창 — Promise<boolean> */
  const confirmDialog = (message, { title = '확인', ok = '확인', cancel = '취소', danger = false } = {}) =>
    new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'dialog';
      dlg.innerHTML = `<form method="dialog">
        <h2 class="dialog-title">${esc(title)}</h2>
        <div class="dialog-body">${esc(message).replace(/\n/g, '<br>')}</div>
        <div class="dialog-actions">
          <button value="cancel" class="btn">${esc(cancel)}</button>
          <button value="ok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(ok)}</button>
        </div></form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'ok'); dlg.remove(); });
      dlg.showModal();
      dlg.querySelector('button[value="ok"]').focus();
    });

  Object.assign(PPP, { esc, uid, today, fmtDate, fmtDateTime, isValidDate, daysBetween, maskName, maskText, ageFromYear, ageBand, hash, download, toast, confirmDialog, pad });
})();
