(() => {
  const SHORT = '/atlas-dashboard-brand.svg?v=4.2';
  const FULL = '/atlas-sidebar-brand.svg?v=4.4';
  const isDashboard = () => !!document.querySelector('[data-page="dashboard"].active');
  const isPhone = () => window.matchMedia('(max-width:760px)').matches;

  const syncProcessOpenButtons = (root = document) => {
    const rows = [];
    if (root?.matches?.('.v4-process-row')) rows.push(root);
    if (root?.querySelectorAll) rows.push(...root.querySelectorAll('.v4-process-row'));
    rows.forEach((row) => {
      const firstCell = row.firstElementChild;
      if (!firstCell) return;
      if (isPhone()) {
        firstCell.querySelectorAll('.v4-process-cell-open').forEach(btn => btn.remove());
        firstCell.classList.remove('v4-process-cell');
        return;
      }
      if (firstCell.querySelector('.v4-process-cell-open')) return;
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

  const ensureReportBrandPatchV4 = () => {
    if (document.querySelector('script[data-atlas-report-brand-v4]')) return;
    const patch = document.createElement('script');
    patch.src = '/report-brand-patch-v4.js?v=4.6';
    patch.defer = true;
    patch.dataset.atlasReportBrandV4 = '1';
    document.head.appendChild(patch);
  };

  const ensureReportVisualV4 = () => {
    const existing = document.querySelector('script[data-atlas-report-v4]');
    if (existing) {
      if (window.emitAtlasReportV4) ensureReportBrandPatchV4();
      else existing.addEventListener('load', ensureReportBrandPatchV4, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = '/report-emission-v4.js?v=4.0';
    script.defer = true;
    script.dataset.atlasReportV4 = '1';
    script.addEventListener('load', ensureReportBrandPatchV4, { once: true });
    document.head.appendChild(script);
  };

  const ensureCompletionDateV4 = () => {
    if (document.querySelector('script[data-atlas-completion-date-v4]')) return;
    const completion = document.createElement('script');
    completion.src = '/completion-date-v4.js?v=4.1';
    completion.defer = true;
    completion.dataset.atlasCompletionDateV4 = '1';
    document.head.appendChild(completion);
  };

  const ensureMobileAppV4 = () => {
    if (!document.querySelector('link[data-atlas-mobile-app-v4]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/mobile-app-v4.css?v=4.4';
      css.dataset.atlasMobileAppV4 = 'css';
      document.head.appendChild(css);
    }
    if (!document.querySelector('link[data-atlas-process-mobile-fix-v4]')) {
      const fix = document.createElement('link');
      fix.rel = 'stylesheet';
      fix.href = '/process-mobile-fix-v4.css?v=4.4';
      fix.dataset.atlasProcessMobileFixV4 = 'css';
      document.head.appendChild(fix);
    }
    if (!document.querySelector('script[data-atlas-mobile-app-v4]')) {
      const script = document.createElement('script');
      script.src = '/mobile-app-v4.js?v=4.3';
      script.defer = true;
      script.dataset.atlasMobileAppV4 = 'js';
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

  window.addEventListener('resize', () => queueMicrotask(sync));

  document.addEventListener('DOMContentLoaded', () => {
    ensureNotificationAssets();
    ensureReportVisualV4();
    ensureCompletionDateV4();
    ensureMobileAppV4();
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
