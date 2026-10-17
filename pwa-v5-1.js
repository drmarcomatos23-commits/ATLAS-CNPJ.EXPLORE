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
      const registration=await navigator.serviceWorker.register('/sw-v5-1.js?v=5.1',{scope:'/',updateViaCache:'none'});
      registration.update?.();
    }catch(error){
      console.warn('ATLAS PWA: service worker indisponível',error);
    }
  }

  function loadEstablishmentContext(){
    if(window.AtlasEstablishmentContextV51||document.querySelector('script[data-atlas-establishment-v51]'))return;
    const script=document.createElement('script');
    script.src='/establishment-context-v5-1.js?v=5.1';
    script.async=false;
    script.dataset.atlasEstablishmentV51='1';
    document.head.appendChild(script);
  }

  function loadRealDataDashboard(){
    if(window.AtlasRealDataV7||document.querySelector('script[data-atlas-real-data-v7]'))return;
    const script=document.createElement('script');
    script.src='/atlas-real-data-v7.js?v=7.0';
    script.async=false;
    script.dataset.atlasRealDataV7='1';
    document.head.appendChild(script);
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

  window.addEventListener('DOMContentLoaded',()=>{
    ensureInstallButton();
    registerServiceWorker();
    if(isStandalone())document.documentElement.classList.add('atlas-pwa-standalone');
  });
})();
