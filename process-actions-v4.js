(() => {
  const profile = () => window.atlasCurrentProfile || window.atlasAuth?.getProfile?.() || {};
  const canManage = () => ['admin', 'operacao'].includes(String(profile().role || '').toLowerCase());
  let decorateQueued = false;

  function processIdFrom(container) {
    const trigger = [...container.querySelectorAll('button')].find(btn => /openAtlasV4Process\(/.test(btn.getAttribute('onclick') || ''));
    const match = trigger?.getAttribute('onclick')?.match(/openAtlasV4Process\(['"]([^'"]+)['"]\)/);
    return match?.[1] || '';
  }

  function setEditButton(button) {
    if (!button) return;
    if (button.textContent.trim() !== 'Editar') button.textContent = 'Editar';
    if (button.getAttribute('aria-label') !== 'Editar processo') button.setAttribute('aria-label', 'Editar processo');
  }

  function decorate(root = document) {
    root.querySelectorAll?.('.v4-process-cell-open').forEach(button => {
      if (!canManage()) {
        button.remove();
        return;
      }
      setEditButton(button);
    });

    root.querySelectorAll?.('.v4-row-actions').forEach(container => {
      const openBtn = [...container.querySelectorAll('button')].find(btn => /openAtlasV4Process\(/.test(btn.getAttribute('onclick') || ''));
      if (!openBtn) return;

      if (!canManage()) {
        if (!container.querySelector('.v4-process-consult-only')) {
          container.innerHTML = '<span class="muted v4-process-consult-only">Consulta</span>';
        }
        return;
      }

      setEditButton(openBtn);

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

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    queueMicrotask(() => {
      decorateQueued = false;
      decorate(document);
    });
  }

  const observer = new MutationObserver((mutations) => {
    const hasElementAdded = mutations.some(mutation =>
      [...mutation.addedNodes].some(node => node.nodeType === 1)
    );
    if (hasElementAdded) queueDecorate();
  });

  const start = () => {
    decorate(document);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AtlasV4ProcessActions = { decorate, canManage };
})();
