(() => {
  function syncGroups(nav) {
    nav.querySelectorAll('.nav-accordion-group').forEach(group => {
      const items = [...group.querySelectorAll('.nav-item')];
      const hasVisible = items.some(item => !item.classList.contains('hidden'));
      group.classList.toggle('hidden', !hasVisible);
      const active = items.some(item => item.classList.contains('active'));
      if (active) setExpanded(group, true);
    });
  }

  function setExpanded(group, expanded) {
    const toggle = group?.querySelector(':scope > .nav-group-toggle');
    const items = group?.querySelector(':scope > .nav-group-items');
    if (!toggle || !items) return;
    toggle.setAttribute('aria-expanded', String(expanded));
    group.classList.toggle('is-open', expanded);
    items.hidden = !expanded;
  }

  function buildAccordion() {
    const nav = document.getElementById('nav');
    if (!nav || nav.dataset.accordionReady === '1') return;
    nav.dataset.accordionReady = '1';

    const titles = [...nav.querySelectorAll(':scope > .nav-group-title')];
    titles.forEach((title, index) => {
      const group = document.createElement('section');
      group.className = 'nav-accordion-group';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-group-title nav-group-toggle';
      toggle.innerHTML = `<span>${title.textContent.trim()}</span><span class="nav-group-chevron" aria-hidden="true">⌄</span>`;
      toggle.setAttribute('aria-expanded', 'false');
      const items = document.createElement('div');
      items.className = 'nav-group-items';
      items.hidden = true;

      let node = title.nextElementSibling;
      while (node && !node.classList.contains('nav-group-title')) {
        const next = node.nextElementSibling;
        items.appendChild(node);
        node = next;
      }
      title.replaceWith(group);
      group.append(toggle, items);

      const shouldOpen = index === 0 || items.querySelector('.nav-item.active');
      setExpanded(group, !!shouldOpen);
      toggle.addEventListener('click', () => setExpanded(group, toggle.getAttribute('aria-expanded') !== 'true'));
    });

    nav.addEventListener('click', ev => {
      const item = ev.target.closest('.nav-item');
      if (item) setExpanded(item.closest('.nav-accordion-group'), true);
    });

    const observer = new MutationObserver(() => syncGroups(nav));
    observer.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    syncGroups(nav);
  }

  const style = document.createElement('style');
  style.id = 'atlas-sidebar-accordion-v4-style';
  style.textContent = `
    .nav-accordion-group{display:block;margin:0 0 4px}.nav-accordion-group.hidden{display:none!important}
    .nav-group-toggle{width:100%;display:flex!important;align-items:center;justify-content:space-between;border:0;background:transparent;cursor:pointer;text-align:left;padding-right:10px!important}
    .nav-group-chevron{font-size:16px;line-height:1;transition:transform .18s ease;opacity:.72}.nav-accordion-group.is-open>.nav-group-toggle .nav-group-chevron{transform:rotate(180deg)}
    .nav-group-items{display:grid;gap:2px}.nav-group-items[hidden]{display:none!important}
    .nav-group-items .nav-item{margin-left:5px;width:calc(100% - 5px)}
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildAccordion);
  else buildAccordion();
})();
