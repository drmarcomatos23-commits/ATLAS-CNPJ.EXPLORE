(() => {
  const fmt = (v) => {
    if (!v) return '—';
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
  };

  let byCode = new Map();
  let refreshPromise = null;
  const db = () => window.atlasDb?.() || (typeof atlasDb === 'function' ? atlasDb() : null);

  async function refreshCompletionDates() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const client = db();
      if (!client) return byCode;
      const { data, error } = await client.from('processes').select('id,public_code,status,completed_at');
      if (!error) {
        byCode = new Map((data || []).map(p => [String(p.public_code || p.id || '').trim(), p]));
        decorateSystem(document);
      }
      return byCode;
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  function completionText(rec) {
    return rec?.status === 'completed' && rec?.completed_at ? `Data de conclusão: ${fmt(rec.completed_at)}` : '';
  }

  function decorateSystem(root = document) {
    root.querySelectorAll?.('.v4-process-row').forEach(row => {
      const code = row.querySelector('strong')?.textContent?.trim();
      const rec = byCode.get(code);
      const statusCell = row.children?.[6];
      if (!statusCell) return;
      let note = statusCell.querySelector('.v4-completion-date');
      const text = completionText(rec);
      if (!text) { note?.remove(); return; }
      if (!note) {
        note = document.createElement('small');
        note.className = 'v4-completion-date';
        statusCell.appendChild(note);
      }
      note.textContent = text;
    });

    root.querySelectorAll?.('.v4-process-pipeline article').forEach(card => {
      const code = card.querySelector('b')?.textContent?.trim();
      const rec = byCode.get(code);
      let note = card.querySelector('.v4-completion-date');
      const text = completionText(rec);
      if (!text) { note?.remove(); return; }
      if (!note) {
        note = document.createElement('small');
        note.className = 'v4-completion-date';
        card.appendChild(note);
      }
      note.textContent = text;
    });
  }

  function decorateReport(popup) {
    try {
      const table = popup.document?.querySelector?.('table.process-table');
      if (!table || table.dataset.completionDatePatched === '1') return false;
      const head = table.querySelector('thead tr');
      const headers = [...(head?.children || [])];
      const statusIndex = headers.findIndex(th => /status/i.test(th.textContent || ''));
      const insertIndex = statusIndex >= 0 ? statusIndex + 1 : Math.max(0, headers.length - 1);
      const th = popup.document.createElement('th');
      th.textContent = 'Conclusão';
      if (head) head.insertBefore(th, head.children[insertIndex] || null);

      table.querySelectorAll('tbody tr').forEach(tr => {
        if (tr.querySelector('.empty-row')) {
          const td = tr.querySelector('td');
          if (td?.colSpan) td.colSpan += 1;
          return;
        }
        const code = tr.querySelector('td')?.textContent?.trim();
        const rec = byCode.get(code);
        const td = popup.document.createElement('td');
        td.className = 'completion-date-cell';
        td.textContent = rec?.status === 'completed' ? fmt(rec.completed_at) : '—';
        tr.insertBefore(td, tr.children[insertIndex] || null);
      });
      table.dataset.completionDatePatched = '1';
      return true;
    } catch (_) {
      return false;
    }
  }

  function watchReportPopup(popup) {
    if (!popup) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      await refreshCompletionDates();
      if (decorateReport(popup) || tries >= 30 || popup.closed) clearInterval(timer);
    }, 100);
  }

  if (!window.__atlasCompletionWindowOpenPatchedV4) {
    const nativeOpen = window.open.bind(window);
    window.open = function(...args) {
      const popup = nativeOpen(...args);
      watchReportPopup(popup);
      return popup;
    };
    window.__atlasCompletionWindowOpenPatchedV4 = true;
  }

  const style = document.createElement('style');
  style.id = 'atlas-completion-date-v4-style';
  style.textContent = `.v4-completion-date{display:block;margin-top:5px;color:#60778b;font-size:10px;font-weight:700;line-height:1.25}.completion-date-cell{white-space:nowrap;font-weight:700;color:#334e68}`;
  document.head.appendChild(style);

  document.addEventListener('click', ev => {
    if (ev.target.closest?.('[data-page="processos"], [data-page="relatorios"], #process-save, [type="submit"]')) {
      setTimeout(refreshCompletionDates, 250);
      setTimeout(refreshCompletionDates, 900);
    }
  });

  const observer = new MutationObserver(() => decorateSystem(document));
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    refreshCompletionDates();
  });

  window.atlasCompletionDatesRefresh = refreshCompletionDates;
})();
