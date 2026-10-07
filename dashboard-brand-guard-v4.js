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
  const ensureCertificates = () => {
    if (!document.querySelector('link[href^="/certificates-v4.css"]')) {
      const css=document.createElement('link');css.rel='stylesheet';css.href='/certificates-v4.css?v=4.1';document.head.appendChild(css);
    }
    if (!document.querySelector('script[src^="/certificates-v4.js"]')) {
      const js=document.createElement('script');js.src='/certificates-v4.js?v=4.1';document.head.appendChild(js);
    }
    const nav=document.querySelector('#nav');
    if(nav&&!nav.querySelector('[data-page="certidoes"]')){
      const licenses=nav.querySelector('[data-page="licencas"]');
      const btn=document.createElement('button');
      btn.className='nav-item';btn.dataset.page='certidoes';btn.dataset.roles='admin,operacao,financeiro,auditoria';
      btn.innerHTML='<span class="nav-ico">◉</span><span>Certidões</span>';
      licenses?.insertAdjacentElement('afterend',btn);
    }
  };
  document.addEventListener('click', (e) => {
    const page=e.target.closest?.('[data-page]');
    if(page) queueMicrotask(sync);
    if(page?.dataset.page==='certidoes'){
      const open=()=>window.certificatesPage?.();
      if(window.certificatesPage)queueMicrotask(open);else setTimeout(open,250);
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    sync();ensureCertificates();
    const img = document.querySelector('.brand-logo');
    if (img) new MutationObserver(sync).observe(img, { attributes: true, attributeFilter: ['src'] });
  });
})();
