(() => {
  const SHORT = '/atlas-dashboard-brand.svg?v=4.2';
  const FULL = '/atlas-sidebar-brand.svg?v=4.4';
  const isDashboard = () => !!document.querySelector('[data-page="dashboard"].active');

  const syncProcessOpenButtons = (root = document) => {
    const rows = [];
    if (root?.matches?.('.v4-process-row')) rows.push(root);
    if (root?.querySelectorAll) rows.push(...root.querySelectorAll('.v4-process-row'));
    rows.forEach((row) => {
      const firstCell = row.firstElementChild;
      if (!firstCell || firstCell.querySelector('.v4-process-cell-open')) return;
      const source = row.querySelector('.v4-row-actions .mini-btn');
      if (!source || source.textContent.trim() !== 'Abrir') return;
      const button = source.cloneNode(true);
      button.classList.add('v4-process-cell-open');
      button.style.marginLeft = '8px';
      button.style.whiteSpace = 'nowrap';
      firstCell.classList.add('v4-process-cell');
      firstCell.appendChild(button);
    });
  };

  const ensureNotificationAssets = () => {
    if (!document.querySelector('link[data-atlas-notifications]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/notifications-v4.css?v=4.0';
      link.dataset.atlasNotifications = 'css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-atlas-notifications]')) {
      const script = document.createElement('script');
      script.src = '/notifications-v4.js?v=4.0';
      script.defer = true;
      script.dataset.atlasNotifications = 'js';
      document.head.appendChild(script);
    }
  };

  const sync = () => {
    const dashboard = isDashboard();
    const img = document.querySelector('.brand-logo');
    const subtitle = document.querySelector('.sidebar-footer span:first-of-type');
    if (img) {
      const desired = dashboard ? SHORT : FULL;
      if (img.getAttribute('src') !== desired) img.setAttribute('src', desired);
    }
    if (subtitle) subtitle.hidden = dashboard;
    syncProcessOpenButtons(document);
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-page]')) queueMicrotask(sync);
  });

  document.addEventListener('DOMContentLoaded', () => {
    ensureNotificationAssets();
    sync();
    const img = document.querySelector('.brand-logo');
    if (img) new MutationObserver(sync).observe(img, { attributes: true, attributeFilter: ['src'] });
    const bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) syncProcessOpenButtons(node);
        }
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  });
})();
