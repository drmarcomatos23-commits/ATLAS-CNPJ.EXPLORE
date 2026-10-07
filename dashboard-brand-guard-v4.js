(() => {
  const SHORT = '/atlas-dashboard-brand.svg?v=4.2';
  const FULL = '/atlas-sidebar-brand.svg?v=4.4';
  const isDashboard = () => !!document.querySelector('[data-page="dashboard"].active');
  const sync = () => {
    const dashboard = isDashboard();
    const img = document.querySelector('.brand-logo');
    const subtitle = document.querySelector('.sidebar-footer span:first-of-type');
    if (img) {
      const desired = dashboard ? SHORT : FULL;
      if (img.getAttribute('src') !== desired) img.setAttribute('src', desired);
    }
    if (subtitle) subtitle.hidden = dashboard;
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-page]')) queueMicrotask(sync);
  });
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    const img = document.querySelector('.brand-logo');
    if (img) new MutationObserver(sync).observe(img, { attributes: true, attributeFilter: ['src'] });
  });
})();
