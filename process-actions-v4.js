(() => {
  const profile = () => window.atlasCurrentProfile || window.atlasAuth?.getProfile?.() || {};
  const canManage = () => ['admin', 'operacao'].includes(String(profile().role || '').toLowerCase());

  function processIdFrom(container) {
    const trigger = [...container.querySelectorAll('button')].find(btn => /openAtlasV4Process\(/.test(btn.getAttribute('onclick') || ''));
    const match = trigger?.getAttribute('onclick')?.match(/openAtlasV4Process\(['"]([^'"]+)['"]\)/);
    return match?.[1] || '';
  }

  function decorate(root = document) {
    root.querySelectorAll?.('.v4-row-actions').forEach(container => {
      const openBtn = [...container.querySelectorAll('button')].find(btn => /openAtlasV4Process\(/.test(btn.getAttribute('onclick') || ''));
      if (!openBtn) return;

      if (!canManage()) {
        container.innerHTML = '<span class="muted">Consulta</span>';
        return;
      }

      openBtn.textContent = 'Editar';
      openBtn.setAttribute('aria-label', 'Editar processo');

      const id = processIdFrom(container);
      if (!id || container.querySelector('.v4-delete-process-btn')) return;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'mini-btn danger v4-delete-process-btn';
      del.textContent = 'Excluir';
      del.setAttribute('aria-label', 'Excluir processo');
      del.addEventListener('click', () => window.deleteProcess?.(id));
      container.appendChild(del);
    });
  }

  const observer = new MutationObserver(() => decorate(document));
  const start = () => {
    decorate(document);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AtlasV4ProcessActions = { decorate, canManage };
})();
