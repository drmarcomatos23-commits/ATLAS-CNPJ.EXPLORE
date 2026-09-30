(() => {
  const isMobile = () => window.matchMedia('(max-width: 1180px)').matches;

  function elements(){
    return {
      sidebar: document.querySelector('.sidebar'),
      overlay: document.getElementById('mobile-nav-overlay'),
      button: document.getElementById('mobile-menu-btn')
    };
  }

  function setOpen(open){
    const {sidebar,overlay,button}=elements();
    if(!sidebar||!overlay||!button)return;
    sidebar.classList.toggle('mobile-open',open);
    overlay.classList.toggle('open',open);
    document.body.classList.toggle('mobile-menu-open',open);
    button.setAttribute('aria-expanded',open?'true':'false');
    button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    button.textContent=open?'×':'☰';
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

  window.atlasMobile={open:()=>setOpen(true),close,toggle};
})();