(() => {
  const mq = window.matchMedia('(max-width:760px)');
  const preferredPages = ['dashboard','processos','clientes','custos'];
  const iconMap = { dashboard:'⌂', processos:'▤', clientes:'▥', custos:'R$', mais:'☰' };

  function sourceFor(page){
    return document.querySelector(`#nav [data-page="${page}"]`);
  }

  function isVisible(el){
    return !!el && !el.classList.contains('hidden');
  }

  function ensureAppTitle(){
    const topbar = document.querySelector('.topbar');
    if(!topbar) return null;
    let title = topbar.querySelector('.mobile-app-title');
    if(!title){
      title = document.createElement('div');
      title.className = 'mobile-app-title';
      title.innerHTML = '<small>ATLAS</small><strong>Dashboard</strong>';
      const menu = document.getElementById('mobile-menu-btn');
      if(menu?.nextSibling) topbar.insertBefore(title, menu.nextSibling);
      else topbar.appendChild(title);
    }
    const pageTitle = document.getElementById('page-title')?.textContent?.trim() || 'Dashboard';
    const strong = title.querySelector('strong');
    if(strong) strong.textContent = pageTitle;
    return title;
  }

  function ensureBottomNav(){
    let nav = document.getElementById('atlas-mobile-bottom-nav');
    if(nav) return nav;
    nav = document.createElement('nav');
    nav.id = 'atlas-mobile-bottom-nav';
    nav.className = 'hidden';
    nav.setAttribute('aria-label','Navegação principal no celular');
    document.body.appendChild(nav);
    return nav;
  }

  function buttonHtml(page,label,active=false){
    const icon = iconMap[page] || '•';
    return `<button type="button" class="atlas-mobile-tab${active?' active':''}" data-mobile-page="${page}" aria-label="${label}"><span class="tab-ico">${icon}</span><span class="tab-label">${label}</span></button>`;
  }

  function currentPage(){
    return document.querySelector('#nav [data-page].active')?.dataset.page || 'dashboard';
  }

  function buildBottomNav(){
    const bottom = ensureBottomNav();
    const app = document.getElementById('app-shell');
    if(!mq.matches || !app || app.classList.contains('hidden')){
      bottom.classList.add('hidden');
      return;
    }

    const available = preferredPages
      .map(page => ({page, source:sourceFor(page)}))
      .filter(item => isVisible(item.source));
    const primary = available.slice(0,3);
    const active = currentPage();
    const labels = primary.map(({source}) => source.querySelector('span:last-child')?.textContent?.trim() || source.dataset.page);

    bottom.innerHTML = primary.map(({page},idx)=>buttonHtml(page,labels[idx],active===page)).join('') + buttonHtml('mais','Mais',!primary.some(x=>x.page===active));
    bottom.classList.remove('hidden');

    bottom.querySelectorAll('[data-mobile-page]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const page = btn.dataset.mobilePage;
        if(page==='mais'){
          window.atlasMobile?.open?.();
          return;
        }
        const source = sourceFor(page);
        if(source && isVisible(source)){
          source.click();
          window.scrollTo({top:0,behavior:'smooth'});
          requestAnimationFrame(syncMobileShell);
        }
      });
    });
  }

  function syncMobileShell(){
    if(!mq.matches){
      document.getElementById('atlas-mobile-bottom-nav')?.classList.add('hidden');
      document.querySelector('.mobile-app-title')?.remove();
      return;
    }
    ensureAppTitle();
    buildBottomNav();
  }

  function bind(){
    syncMobileShell();

    document.addEventListener('click',ev=>{
      if(ev.target.closest?.('#nav [data-page]')) setTimeout(syncMobileShell,0);
    });

    mq.addEventListener?.('change',syncMobileShell);

    const pageTitle = document.getElementById('page-title');
    if(pageTitle) new MutationObserver(syncMobileShell).observe(pageTitle,{childList:true,characterData:true,subtree:true});

    const app = document.getElementById('app-shell');
    if(app) new MutationObserver(syncMobileShell).observe(app,{attributes:true,attributeFilter:['class']});

    const nav = document.getElementById('nav');
    if(nav) new MutationObserver(syncMobileShell).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();

  window.atlasMobileAppV4 = { sync: syncMobileShell };
})();
