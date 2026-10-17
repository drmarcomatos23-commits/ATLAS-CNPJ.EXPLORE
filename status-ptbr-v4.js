(() => {
  const STATUS_PT = {
    open: 'Aberto',
    in_progress: 'Em andamento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    pending: 'Pendente',
    paused: 'Pausado',
    overdue: 'Atrasado'
  };

  function translateText(value){
    const key=String(value||'').trim().toLowerCase().replace(/\s+/g,'_');
    return STATUS_PT[key]||null;
  }

  function translate(root=document){
    const scope=root?.querySelectorAll?root:document;
    scope.querySelectorAll?.('.v4-badge, .status-badge, .badge, [data-status-label]').forEach(el=>{
      const translated=translateText(el.textContent);
      if(translated)el.textContent=translated;
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    translate(document);
    const observer=new MutationObserver(muts=>{
      for(const m of muts){
        for(const n of m.addedNodes){
          if(n.nodeType===1)translate(n);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  });

  window.AtlasStatusPtBr={translate,translateText};
})();
