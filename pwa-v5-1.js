(()=>{
  let deferredInstallPrompt=null;

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  }

  function ensureInstallButton(){
    if(document.getElementById('atlas-pwa-install'))return document.getElementById('atlas-pwa-install');
    const footer=document.querySelector('.sidebar-footer');
    if(!footer)return null;
    const button=document.createElement('button');
    button.id='atlas-pwa-install';
    button.type='button';
    button.className='atlas-pwa-install hidden';
    button.innerHTML='<span>＋</span><strong>Instalar ATLAS</strong>';
    button.setAttribute('aria-label','Instalar ATLAS neste dispositivo');
    button.addEventListener('click',async()=>{
      if(!deferredInstallPrompt)return;
      button.disabled=true;
      try{
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      }finally{
        deferredInstallPrompt=null;
        button.classList.add('hidden');
        button.disabled=false;
      }
    });
    footer.prepend(button);
    return button;
  }

  async function registerServiceWorker(){
    if(!('serviceWorker' in navigator))return;
    try{
      const registration=await navigator.serviceWorker.register('/sw-v5-1.js?v=7.2',{scope:'/',updateViaCache:'none'});
      registration.update?.();
    }catch(error){
      console.warn('ATLAS PWA: service worker indisponível',error);
    }
  }

  function loadScriptOnce(src,datasetKey,globalName){
    if((globalName&&window[globalName])||document.querySelector(`script[data-${datasetKey}]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset[datasetKey.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';
    document.head.appendChild(script);
  }

  function loadEstablishmentContext(){
    loadScriptOnce('/establishment-context-v5-1.js?v=5.1','atlas-establishment-v51','AtlasEstablishmentContextV51');
  }

  function loadRealDataDashboard(){
    if(window.AtlasRealDataV7||document.querySelector('script[data-atlas-real-data-v7]'))return;
    const script=document.createElement('script');
    script.src='/atlas-real-data-v7.js?v=7.0';
    script.async=false;
    script.dataset.atlasRealDataV7='1';
    document.head.appendChild(script);
  }

  function loadOperationalProcessV71(){
    loadScriptOnce('/atlas-ops-v7-process.js?v=7.1','atlas-ops-v71-process','AtlasOpsV71Process');
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    const button=ensureInstallButton();
    if(button&&!isStandalone())button.classList.remove('hidden');
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    document.getElementById('atlas-pwa-install')?.classList.add('hidden');
  });

  loadEstablishmentContext();
  loadRealDataDashboard();
  loadScriptOnce('/atlas-ops-v7-doc-model.js?v=7.2','atlas-ops-v72-doc-model','AtlasOpsV72DocumentModel');
  loadScriptOnce('/atlas-ops-v7-pending.js?v=7.2','atlas-ops-v72-pending','AtlasOpsV72Pending');
  loadOperationalProcessV71();
  loadScriptOnce('/atlas-ops-v7-docs.js?v=7.2-checklist','atlas-ops-v71-docs','AtlasOpsV71Documents');

  window.addEventListener('DOMContentLoaded',()=>{
    ensureInstallButton();
    registerServiceWorker();
    if(isStandalone())document.documentElement.classList.add('atlas-pwa-standalone');
  });
})();
