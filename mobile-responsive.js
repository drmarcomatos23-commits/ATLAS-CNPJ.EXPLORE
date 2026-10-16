(() => {
  const isMobile = () => window.matchMedia('(max-width: 1180px)').matches;

  function elements(){
    return {
      sidebar: document.querySelector('.sidebar'),
      overlay: document.getElementById('mobile-nav-overlay'),
      button: document.getElementById('mobile-menu-btn')
    };
  }

  function scrollActiveNavIntoView(){
    const sidebar = document.querySelector('.sidebar');
    const nav = sidebar?.querySelector('.nav-list');
    if (!sidebar || !nav) return;
    const page = document.getElementById('app-shell')?.dataset?.v6Page;
    const active = sidebar.querySelector('.nav-item.active[data-page]') || (page ? sidebar.querySelector(`.nav-item[data-page="${page}"]`) : null);
    requestAnimationFrame(() => {
      if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      else nav.scrollTop = 0;
    });
  }

  function setOpen(open){
    const {sidebar,overlay,button}=elements();
    if(!sidebar||!overlay||!button)return;
    sidebar.classList.toggle('mobile-open',open);
    overlay.classList.toggle('open',open);
    document.body.classList.toggle('mobile-menu-open',open);
    button.setAttribute('aria-expanded',open?'true':'false');
    button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    window.AtlasV51Icons?.applyTopbarIcons?.();
    if(open) scrollActiveNavIntoView();
  }

  function close(){ setOpen(false); }
  function toggle(){ setOpen(!elements().sidebar?.classList.contains('mobile-open')); }

  function bind(){
    const {sidebar,overlay,button}=elements();
    if(!sidebar||!overlay||!button)return;

    button.addEventListener('click',toggle);
    overlay.addEventListener('click',close);

    sidebar.addEventListener('click',e=>{
      if(e.target.closest('[data-page]') && isMobile()) close();
    });

    document.addEventListener('keydown',e=>{
      if(e.key==='Escape') close();
    });

    window.addEventListener('resize',()=>{
      if(!isMobile()) close();
    });

    window.addEventListener('orientationchange',()=>{
      close();
      setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    });

    document.querySelectorAll('.table-wrap').forEach(el=>{
      el.setAttribute('tabindex','0');
      el.setAttribute('aria-label','Tabela com rolagem horizontal no celular');
    });
  }

  const observer=new MutationObserver(()=>{
    document.querySelectorAll('.table-wrap:not([tabindex])').forEach(el=>{
      el.setAttribute('tabindex','0');
      el.setAttribute('aria-label','Tabela com rolagem horizontal no celular');
    });
  });

  function start(){
    bind();
    const content=document.getElementById('page-content');
    if(content) observer.observe(content,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();

  window.atlasMobile={open:()=>setOpen(true),close,toggle,scrollActiveNavIntoView};
})();